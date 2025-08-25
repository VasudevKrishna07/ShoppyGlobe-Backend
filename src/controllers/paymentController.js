const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const Order = require('../models/Order');
const Cart = require('../models/Cart');
const User = require('../models/User');
const Product = require('../models/Product');
const asyncHandler = require('../utils/asyncHandler');
const AppError = require('../utils/appError');
const logger = require('../config/logger');
const emailService = require('../services/emailService');

/**
 * @desc    Create payment intent
 * @route   POST /api/payments/create-intent
 * @access  Private
 */
const createPaymentIntent = asyncHandler(async (req, res, next) => {
  const { amount, currency = 'inr', metadata = {} } = req.body;

  if (!amount || amount < 50) { // Minimum amount for Stripe
    return next(new AppError('Invalid amount. Minimum amount is ₹50', 400));
  }

  try {
    // Get user's cart to validate items and calculate actual amount
    const cart = await Cart.findByUser(req.user.id);
    
    if (!cart || cart.items.length === 0) {
      return next(new AppError('Cart is empty', 400));
    }

    // Validate cart items against current product data
    const validationResults = await cart.validateItems();
    
    if (validationResults.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Cart validation failed',
        validationResults
      });
    }

    // Calculate shipping cost (you can implement your logic here)
    const shippingCost = calculateShippingCost(cart);
    const taxAmount = calculateTaxAmount(cart.totalAmount);
    const finalAmount = Math.round((cart.totalAmount + shippingCost + taxAmount) * 100); // Convert to paise

    // Create payment intent
    const paymentIntent = await stripe.paymentIntents.create({
      amount: finalAmount,
      currency: currency.toLowerCase(),
      customer: req.user.stripeCustomerId, // You might want to create Stripe customers
      metadata: {
        userId: req.user.id,
        cartId: cart._id.toString(),
        ...metadata
      },
      automatic_payment_methods: {
        enabled: true
      }
    });

    logger.info('Payment intent created', {
      paymentIntentId: paymentIntent.id,
      amount: finalAmount,
      userId: req.user.id
    });

    res.status(200).json({
      success: true,
      data: {
        clientSecret: paymentIntent.client_secret,
        paymentIntentId: paymentIntent.id,
        amount: finalAmount,
        currency,
        breakdown: {
          subtotal: cart.totalAmount,
          shipping: shippingCost,
          tax: taxAmount,
          total: finalAmount / 100
        }
      }
    });

  } catch (error) {
    logger.error('Payment intent creation failed:', error);
    return next(new AppError('Payment intent creation failed', 500));
  }
});

/**
 * @desc    Confirm payment and create order
 * @route   POST /api/payments/confirm
 * @access  Private
 */
const confirmPayment = asyncHandler(async (req, res, next) => {
  const { paymentIntentId, shippingAddress } = req.body;

  if (!paymentIntentId) {
    return next(new AppError('Payment intent ID is required', 400));
  }

  if (!shippingAddress) {
    return next(new AppError('Shipping address is required', 400));
  }

  try {
    // Retrieve payment intent from Stripe
    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);

    if (paymentIntent.status !== 'succeeded') {
      return next(new AppError('Payment not completed', 400));
    }

    // Get user's cart
    const cart = await Cart.findByUser(req.user.id);
    
    if (!cart || cart.items.length === 0) {
      return next(new AppError('Cart is empty', 400));
    }

    // Create order items with product snapshots
    const orderItems = [];
    
    for (const cartItem of cart.items) {
      const product = await Product.findById(cartItem.product);
      
      if (!product) {
        return next(new AppError(`Product ${cartItem.product} not found`, 400));
      }

      if (product.stock < cartItem.quantity) {
        return next(new AppError(`Insufficient stock for ${product.title}`, 400));
      }

      orderItems.push({
        product: product._id,
        title: product.title,
        price: cartItem.price,
        quantity: cartItem.quantity,
        total: cartItem.total,
        productSnapshot: {
          description: product.description,
          image: product.thumbnail,
          sku: product.sku,
          brand: product.brand
        },
        selectedVariants: cartItem.selectedVariants || []
      });

      // Reserve stock
      await product.reserveStock(cartItem.quantity);
    }

    // Calculate amounts
    const subtotal = cart.totalAmount;
    const shippingCost = calculateShippingCost(cart);
    const taxAmount = calculateTaxAmount(subtotal);
    const totalAmount = subtotal + shippingCost + taxAmount;

    // Create order
    const order = await Order.create({
      user: req.user.id,
      items: orderItems,
      subtotal,
      taxAmount,
      shippingCost,
      totalAmount,
      shippingAddress,
      paymentMethod: 'stripe',
      paymentStatus: 'paid',
      paymentDetails: {
        transactionId: paymentIntent.id,
        paymentIntentId: paymentIntent.id,
        receiptUrl: paymentIntent.charges.data[0]?.receipt_url
      },
      status: 'confirmed'
    });

    // Clear user's cart
    await cart.clearCart();

    // Update user analytics
    await User.findByIdAndUpdate(req.user.id, {
      $inc: {
        totalOrders: 1,
        totalSpent: totalAmount
      },
      lastOrderDate: new Date(),
      averageOrderValue: (req.user.totalSpent + totalAmount) / (req.user.totalOrders + 1)
    });

    // Update product analytics
    for (const item of orderItems) {
      await Product.findByIdAndUpdate(item.product, {
        $inc: {
          purchases: item.quantity,
          revenue: item.total
        }
      });
    }

    // Send order confirmation email
    try {
      await emailService.sendOrderConfirmation(req.user, order);
    } catch (emailError) {
      logger.error('Order confirmation email failed:', emailError);
      // Don't fail the order creation if email fails
    }

    logger.info('Order created successfully', {
      orderId: order._id,
      orderNumber: order.orderNumber,
      userId: req.user.id,
      amount: totalAmount
    });

    res.status(201).json({
      success: true,
      message: 'Order created successfully',
      data: {
        order: {
          id: order._id,
          orderNumber: order.orderNumber,
          status: order.status,
          totalAmount: order.totalAmount,
          items: order.items,
          createdAt: order.createdAt
        }
      }
    });

  } catch (error) {
    logger.error('Payment confirmation failed:', error);
    return next(new AppError('Payment confirmation failed', 500));
  }
});

/**
 * @desc    Handle Stripe webhook
 * @route   POST /api/payments/webhook
 * @access  Public (but verified via Stripe signature)
 */
const handleStripeWebhook = asyncHandler(async (req, res, next) => {
  const sig = req.headers['stripe-signature'];
  const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;

  let event;

  try {
    event = stripe.webhooks.constructEvent(req.body, sig, endpointSecret);
  } catch (err) {
    logger.error('Webhook signature verification failed:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  // Handle the event
  switch (event.type) {
    case 'payment_intent.succeeded':
      await handlePaymentSucceeded(event.data.object);
      break;

    case 'payment_intent.payment_failed':
      await handlePaymentFailed(event.data.object);
      break;

    case 'charge.dispute.created':
      await handleChargeDispute(event.data.object);
      break;

    case 'invoice.payment_succeeded':
      await handleInvoicePaymentSucceeded(event.data.object);
      break;

    default:
      logger.info(`Unhandled event type: ${event.type}`);
  }

  res.json({ received: true });
});

/**
 * @desc    Create refund
 * @route   POST /api/payments/refund
 * @access  Private (Admin only)
 */
const createRefund = asyncHandler(async (req, res, next) => {
  const { orderId, amount, reason } = req.body;

  if (!orderId) {
    return next(new AppError('Order ID is required', 400));
  }

  const order = await Order.findById(orderId);
  
  if (!order) {
    return next(new AppError('Order not found', 404));
  }

  if (order.paymentStatus !== 'paid') {
    return next(new AppError('Order payment is not in paid status', 400));
  }

  if (!order.paymentDetails.paymentIntentId) {
    return next(new AppError('Payment intent ID not found', 400));
  }

  try {
    const refundAmount = amount || order.totalAmount * 100; // Convert to paise

    const refund = await stripe.refunds.create({
      payment_intent: order.paymentDetails.paymentIntentId,
      amount: refundAmount,
      reason: reason || 'requested_by_customer',
      metadata: {
        orderId: order._id.toString(),
        adminId: req.user.id
      }
    });

    // Update order
    order.paymentStatus = refundAmount >= (order.totalAmount * 100) ? 'refunded' : 'partially_refunded';
    order.paymentDetails.refundId = refund.id;
    order.paymentDetails.refundAmount = refundAmount / 100;
    order.status = 'refunded';

    await order.save();

    // Restore product stock if full refund
    if (refundAmount >= (order.totalAmount * 100)) {
      for (const item of order.items) {
        await Product.findByIdAndUpdate(item.product, {
          $inc: { stock: item.quantity }
        });
      }
    }

    logger.info('Refund created successfully', {
      refundId: refund.id,
      orderId: order._id,
      amount: refundAmount / 100
    });

    res.status(200).json({
      success: true,
      message: 'Refund created successfully',
      data: {
        refundId: refund.id,
        amount: refundAmount / 100,
        status: refund.status
      }
    });

  } catch (error) {
    logger.error('Refund creation failed:', error);
    return next(new AppError('Refund creation failed', 500));
  }
});

/**
 * @desc    Get payment analytics
 * @route   GET /api/payments/analytics
 * @access  Private (Admin only)
 */
const getPaymentAnalytics = asyncHandler(async (req, res, next) => {
  const { startDate, endDate } = req.query;
  
  try {
    // Define date range
    const dateFilter = {};
    if (startDate && endDate) {
      dateFilter.created = {
        gte: Math.floor(new Date(startDate).getTime() / 1000),
        lte: Math.floor(new Date(endDate).getTime() / 1000)
      };
    }

    // Get payment intents from Stripe
    const paymentIntents = await stripe.paymentIntents.list({
      limit: 100,
      ...dateFilter
    });

    // Get charges for more detailed info
    const charges = await stripe.charges.list({
      limit: 100,
      ...dateFilter
    });

    // Calculate analytics
    const analytics = {
      totalTransactions: paymentIntents.data.length,
      successfulPayments: paymentIntents.data.filter(pi => pi.status === 'succeeded').length,
      failedPayments: paymentIntents.data.filter(pi => pi.status === 'payment_failed').length,
      totalRevenue: paymentIntents.data
        .filter(pi => pi.status === 'succeeded')
        .reduce((sum, pi) => sum + pi.amount, 0) / 100,
      averageTransaction: 0,
      paymentMethods: {},
      successRate: 0
    };

    // Calculate success rate
    if (analytics.totalTransactions > 0) {
      analytics.successRate = (analytics.successfulPayments / analytics.totalTransactions * 100).toFixed(2);
    }

    // Calculate average transaction
    if (analytics.successfulPayments > 0) {
      analytics.averageTransaction = (analytics.totalRevenue / analytics.successfulPayments).toFixed(2);
    }

    // Group by payment method
    charges.data.forEach(charge => {
      const method = charge.payment_method_details?.type || 'unknown';
      analytics.paymentMethods[method] = (analytics.paymentMethods[method] || 0) + 1;
    });

    res.status(200).json({
      success: true,
      data: {
        analytics,
        period: {
          startDate: startDate || 'All time',
          endDate: endDate || 'All time'
        }
      }
    });

  } catch (error) {
    logger.error('Payment analytics failed:', error);
    return next(new AppError('Failed to get payment analytics', 500));
  }
});

// Helper functions

/**
 * Calculate shipping cost based on cart
 */
const calculateShippingCost = (cart) => {
  const freeShippingThreshold = 999; // Free shipping over ₹999
  
  if (cart.totalAmount >= freeShippingThreshold) {
    return 0;
  }

  // Simple shipping calculation - you can make this more complex
  const baseShipping = 99;
  const weightBasedShipping = cart.items.reduce((total, item) => {
    return total + (item.quantity * 10); // ₹10 per item
  }, 0);

  return Math.min(baseShipping + weightBasedShipping, 299); // Max ₹299
};

/**
 * Calculate tax amount
 */
const calculateTaxAmount = (subtotal) => {
  const taxRate = 0.18; // 18% GST
  return Math.round(subtotal * taxRate);
};

/**
 * Handle successful payment webhook
 */
const handlePaymentSucceeded = async (paymentIntent) => {
  try {
    logger.info('Payment succeeded webhook received', {
      paymentIntentId: paymentIntent.id,
      amount: paymentIntent.amount
    });

    // You can add additional logic here if needed
    // For example, updating order status, sending notifications, etc.

  } catch (error) {
    logger.error('Error handling payment succeeded webhook:', error);
  }
};

/**
 * Handle failed payment webhook
 */
const handlePaymentFailed = async (paymentIntent) => {
  try {
    logger.warn('Payment failed webhook received', {
      paymentIntentId: paymentIntent.id,
      lastPaymentError: paymentIntent.last_payment_error
    });

    // Find order and update status
    const order = await Order.findOne({
      'paymentDetails.paymentIntentId': paymentIntent.id
    });

    if (order) {
      order.paymentStatus = 'failed';
      order.status = 'cancelled';
      await order.save();

      // Release reserved stock
      for (const item of order.items) {
        await Product.findByIdAndUpdate(item.product, {
          $inc: { stock: item.quantity }
        });
      }
    }

  } catch (error) {
    logger.error('Error handling payment failed webhook:', error);
  }
};

/**
 * Handle charge dispute webhook
 */
const handleChargeDispute = async (dispute) => {
  try {
    logger.warn('Charge dispute created', {
      disputeId: dispute.id,
      chargeId: dispute.charge,
      amount: dispute.amount,
      reason: dispute.reason
    });

    // You can implement dispute handling logic here
    // For example, notifying admins, updating order status, etc.

  } catch (error) {
    logger.error('Error handling charge dispute webhook:', error);
  }
};

/**
 * Handle invoice payment succeeded (for subscriptions)
 */
const handleInvoicePaymentSucceeded = async (invoice) => {
  try {
    logger.info('Invoice payment succeeded', {
      invoiceId: invoice.id,
      customerId: invoice.customer,
      amount: invoice.amount_paid
    });

    // Handle subscription-related logic if you implement subscriptions

  } catch (error) {
    logger.error('Error handling invoice payment succeeded webhook:', error);
  }
};

module.exports = {
  createPaymentIntent,
  confirmPayment,
  handleStripeWebhook,
  createRefund,
  getPaymentAnalytics
};