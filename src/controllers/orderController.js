const Order = require('../models/Order');
const User = require('../models/User');
const Cart = require('../models/Cart');
const Product = require('../models/Product');
const asyncHandler = require('../utils/asyncHandler');
const AppError = require('../utils/appError');
const logger = require('../config/logger');
const emailService = require('../services/emailService');

/**
 * @desc    Get all orders with filtering and pagination
 * @route   GET /api/orders
 * @access  Private
 */
const getOrders = asyncHandler(async (req, res, next) => {
  // Build query based on user role
  let query = {};
  
  // If not admin, only show user's own orders
  if (req.user.role !== 'admin') {
    query.user = req.user.id;
  }

  // Apply filters
  const { status, paymentStatus, startDate, endDate, search } = req.query;
  
  if (status) {
    query.status = status;
  }
  
  if (paymentStatus) {
    query.paymentStatus = paymentStatus;
  }
  
  if (startDate && endDate) {
    query.createdAt = {
      $gte: new Date(startDate),
      $lte: new Date(endDate)
    };
  }
  
  if (search) {
    query.$or = [
      { orderNumber: new RegExp(search, 'i') },
      { 'shippingAddress.firstName': new RegExp(search, 'i') },
      { 'shippingAddress.lastName': new RegExp(search, 'i') }
    ];
  }

  // Pagination
  const page = parseInt(req.query.page, 10) || 1;
  const limit = parseInt(req.query.limit, 10) || 20;
  const startIndex = (page - 1) * limit;
  const endIndex = page * limit;
  const total = await Order.countDocuments(query);

  // Execute query
  const orders = await Order.find(query)
    .populate('user', 'firstName lastName email')
    .populate('items.product', 'title thumbnail')
    .sort({ createdAt: -1 })
    .skip(startIndex)
    .limit(limit);

  // Pagination result
  const pagination = {};
  
  if (endIndex < total) {
    pagination.next = {
      page: page + 1,
      limit
    };
  }

  if (startIndex > 0) {
    pagination.prev = {
      page: page - 1,
      limit
    };
  }

  res.status(200).json({
    success: true,
    count: orders.length,
    total,
    pagination,
    data: {
      orders
    }
  });
});

/**
 * @desc    Get single order
 * @route   GET /api/orders/:id
 * @access  Private
 */
const getOrder = asyncHandler(async (req, res, next) => {
  let query = { _id: req.params.id };
  
  // If not admin, ensure user can only access their own orders
  if (req.user.role !== 'admin') {
    query.user = req.user.id;
  }

  const order = await Order.findOne(query)
    .populate('user', 'firstName lastName email phone')
    .populate('items.product', 'title description thumbnail brand sku')
    .populate('statusHistory.updatedBy', 'firstName lastName');

  if (!order) {
    return next(new AppError('Order not found', 404));
  }

  res.status(200).json({
    success: true,
    data: {
      order
    }
  });
});

/**
 * @desc    Create new order from cart
 * @route   POST /api/orders
 * @access  Private
 */
const createOrder = asyncHandler(async (req, res, next) => {
  const { shippingAddress, paymentMethod, customerNotes } = req.body;

  // Get user's cart
  const cart = await Cart.findByUser(req.user.id);
  
  if (!cart || cart.items.length === 0) {
    return next(new AppError('Cart is empty', 400));
  }

  // Validate cart items and stock
  const validationResults = await cart.validateItems();
  
  if (validationResults.length > 0) {
    return res.status(400).json({
      success: false,
      message: 'Cart validation failed',
      validationResults
    });
  }

  // Prepare order items
  const orderItems = [];
  let hasStockIssues = false;
  
  for (const cartItem of cart.items) {
    const product = await Product.findById(cartItem.product);
    
    if (!product) {
      return next(new AppError(`Product ${cartItem.product} not found`, 400));
    }

    if (!product.isActive) {
      return next(new AppError(`Product ${product.title} is no longer available`, 400));
    }

    if (product.stock < cartItem.quantity) {
      hasStockIssues = true;
      return next(new AppError(`Insufficient stock for ${product.title}. Available: ${product.stock}`, 400));
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
  }

  if (hasStockIssues) {
    return next(new AppError('Some items have stock issues', 400));
  }

  // Calculate amounts
  const subtotal = cart.totalAmount;
  const shippingCost = calculateShippingCost(cart);
  const taxAmount = calculateTaxAmount(subtotal);
  const totalAmount = subtotal + shippingCost + taxAmount;

  // For COD, set payment status as pending
  const paymentStatus = paymentMethod === 'cod' ? 'pending' : 'pending';

  try {
    // Create order
    const order = await Order.create({
      user: req.user.id,
      items: orderItems,
      subtotal,
      taxAmount,
      shippingCost,
      totalAmount,
      shippingAddress,
      paymentMethod,
      paymentStatus,
      customerNotes,
      status: paymentMethod === 'cod' ? 'confirmed' : 'pending'
    });

    // Reserve stock for all items
    for (const item of orderItems) {
      await Product.findById(item.product).then(product => {
        if (product) {
          return product.reserveStock(item.quantity);
        }
      });
    }

    // Clear user's cart
    await cart.clearCart();

    // Update user statistics
    await User.findByIdAndUpdate(req.user.id, {
      $inc: { totalOrders: 1, totalSpent: totalAmount },
      lastOrderDate: new Date()
    });

    // Send order confirmation email
    try {
      await emailService.sendOrderConfirmation(req.user, order);
    } catch (emailError) {
      logger.error('Order confirmation email failed:', emailError);
    }

    logger.info('Order created successfully', {
      orderId: order._id,
      orderNumber: order.orderNumber,
      userId: req.user.id,
      totalAmount
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
          paymentMethod: order.paymentMethod,
          createdAt: order.createdAt
        }
      }
    });

  } catch (error) {
    logger.error('Order creation failed:', error);
    return next(new AppError('Order creation failed', 500));
  }
});

/**
 * @desc    Update order status
 * @route   PUT /api/orders/:id/status
 * @access  Private (Admin only)
 */
const updateOrderStatus = asyncHandler(async (req, res, next) => {
  const { status, notes } = req.body;
  
  const order = await Order.findById(req.params.id)
    .populate('user', 'firstName lastName email');

  if (!order) {
    return next(new AppError('Order not found', 404));
  }

  const previousStatus = order.status;

  // Update order status
  await order.updateStatus(status, notes, req.user.id);

  // Handle status-specific logic
  switch (status) {
    case 'confirmed':
      // Send confirmation email if not already sent
      if (previousStatus === 'pending') {
        try {
          await emailService.sendOrderConfirmation(order.user, order);
        } catch (emailError) {
          logger.error('Order confirmation email failed:', emailError);
        }
      }
      break;

    case 'shipped':
      // Send shipping notification
      if (order.tracking && order.tracking.trackingNumber) {
        try {
          await emailService.sendOrderShipped(order.user, order);
        } catch (emailError) {
          logger.error('Order shipped email failed:', emailError);
        }
      }
      break;

    case 'delivered':
      // Update product analytics
      for (const item of order.items) {
        await Product.findByIdAndUpdate(item.product, {
          $inc: { 
            purchases: item.quantity,
            revenue: item.total
          }
        });
      }
      break;

    case 'cancelled':
      // Release reserved stock
      for (const item of order.items) {
        await Product.findById(item.product).then(product => {
          if (product) {
            return product.releaseStock(item.quantity);
          }
        });
      }
      break;
  }

  logger.info('Order status updated', {
    orderId: order._id,
    orderNumber: order.orderNumber,
    previousStatus,
    newStatus: status,
    updatedBy: req.user.id
  });

  res.status(200).json({
    success: true,
    message: 'Order status updated successfully',
    data: {
      order: {
        id: order._id,
        orderNumber: order.orderNumber,
        status: order.status,
        previousStatus
      }
    }
  });
});

/**
 * @desc    Add tracking information
 * @route   PUT /api/orders/:id/tracking
 * @access  Private (Admin only)
 */
const addTrackingInfo = asyncHandler(async (req, res, next) => {
  const { provider, trackingNumber, trackingUrl } = req.body;
  
  const order = await Order.findById(req.params.id)
    .populate('user', 'firstName lastName email');

  if (!order) {
    return next(new AppError('Order not found', 404));
  }

  // Add tracking information
  await order.addTracking({
    provider,
    trackingNumber,
    trackingUrl: trackingUrl || `https://track.${provider.toLowerCase()}.com/${trackingNumber}`
  });

  // Send shipping notification email
  try {
    await emailService.sendOrderShipped(order.user, order);
  } catch (emailError) {
    logger.error('Order shipped email failed:', emailError);
  }

  logger.info('Tracking information added', {
    orderId: order._id,
    orderNumber: order.orderNumber,
    provider,
    trackingNumber
  });

  res.status(200).json({
    success: true,
    message: 'Tracking information added successfully',
    data: {
      tracking: order.tracking
    }
  });
});

/**
 * @desc    Cancel order
 * @route   PUT /api/orders/:id/cancel
 * @access  Private
 */
const cancelOrder = asyncHandler(async (req, res, next) => {
  const { reason } = req.body;
  
  let query = { _id: req.params.id };
  
  // If not admin, ensure user can only cancel their own orders
  if (req.user.role !== 'admin') {
    query.user = req.user.id;
  }

  const order = await Order.findOne(query);

  if (!order) {
    return next(new AppError('Order not found', 404));
  }

  if (!order.canBeCancelled()) {
    return next(new AppError('Order cannot be cancelled at this stage', 400));
  }

  // Cancel order
  await order.cancelOrder(reason, req.user.id);

  logger.info('Order cancelled', {
    orderId: order._id,
    orderNumber: order.orderNumber,
    reason,
    cancelledBy: req.user.id
  });

  res.status(200).json({
    success: true,
    message: 'Order cancelled successfully',
    data: {
      order: {
        id: order._id,
        orderNumber: order.orderNumber,
        status: order.status,
        cancellation: order.cancellation
      }
    }
  });
});

/**
 * @desc    Request return
 * @route   POST /api/orders/:id/return
 * @access  Private
 */
const requestReturn = asyncHandler(async (req, res, next) => {
  const { items, reason } = req.body;
  
  let query = { _id: req.params.id };
  
  // If not admin, ensure user can only return their own orders
  if (req.user.role !== 'admin') {
    query.user = req.user.id;
  }

  const order = await Order.findOne(query);

  if (!order) {
    return next(new AppError('Order not found', 404));
  }

  if (!order.canBeReturned()) {
    return next(new AppError('Order cannot be returned', 400));
  }

  if (order.returnRequest.requested) {
    return next(new AppError('Return request already exists for this order', 400));
  }

  // Request return
  await order.requestReturn(items, reason);

  logger.info('Return requested', {
    orderId: order._id,
    orderNumber: order.orderNumber,
    reason,
    requestedBy: req.user.id
  });

  res.status(200).json({
    success: true,
    message: 'Return request submitted successfully',
    data: {
      returnRequest: order.returnRequest
    }
  });
});

/**
 * @desc    Get order statistics
 * @route   GET /api/orders/analytics
 * @access  Private (Admin only)
 */
const getOrderAnalytics = asyncHandler(async (req, res, next) => {
  const { startDate, endDate } = req.query;
  
  const dateRange = {};
  if (startDate && endDate) {
    dateRange.startDate = startDate;
    dateRange.endDate = endDate;
  }

  const analytics = await Order.getStatistics(dateRange);

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
});

/**
 * @desc    Get recent orders
 * @route   GET /api/orders/recent
 * @access  Private (Admin only)
 */
const getRecentOrders = asyncHandler(async (req, res, next) => {
  const limit = parseInt(req.query.limit, 10) || 10;
  
  const orders = await Order.getRecentOrders(limit);

  res.status(200).json({
    success: true,
    count: orders.length,
    data: {
      orders
    }
  });
});

/**
 * @desc    Get orders requiring action
 * @route   GET /api/orders/requiring-action
 * @access  Private (Admin only)
 */
const getOrdersRequiringAction = asyncHandler(async (req, res, next) => {
  const orders = await Order.getOrdersRequiringAction();

  res.status(200).json({
    success: true,
    count: orders.length,
    data: {
      orders
    }
  });
});

// Helper functions

/**
 * Calculate shipping cost
 */
const calculateShippingCost = (cart) => {
  const freeShippingThreshold = 999;
  
  if (cart.totalAmount >= freeShippingThreshold) {
    return 0;
  }

  const baseShipping = 99;
  const weightBasedShipping = cart.items.reduce((total, item) => {
    return total + (item.quantity * 10);
  }, 0);

  return Math.min(baseShipping + weightBasedShipping, 299);
};

/**
 * Calculate tax amount
 */
const calculateTaxAmount = (subtotal) => {
  const taxRate = 0.18; // 18% GST
  return Math.round(subtotal * taxRate);
};

module.exports = {
  getOrders,
  getOrder,
  createOrder,
  updateOrderStatus,
  addTrackingInfo,
  cancelOrder,
  requestReturn,
  getOrderAnalytics,
  getRecentOrders,
  getOrdersRequiringAction
};