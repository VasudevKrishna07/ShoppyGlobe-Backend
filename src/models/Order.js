const mongoose = require('mongoose');

/**
 * @swagger
 * components:
 *   schemas:
 *     Order:
 *       type: object
 *       required:
 *         - user
 *         - items
 *         - shippingAddress
 *         - paymentMethod
 *       properties:
 *         _id:
 *           type: string
 *           description: Order ID
 *         orderNumber:
 *           type: string
 *           description: Unique order number
 *         user:
 *           type: string
 *           description: User ID
 *         items:
 *           type: array
 *           items:
 *             type: object
 *             properties:
 *               product:
 *                 type: string
 *                 description: Product ID
 *               title:
 *                 type: string
 *               price:
 *                 type: number
 *               quantity:
 *                 type: number
 *               total:
 *                 type: number
 *         status:
 *           type: string
 *           enum: [pending, confirmed, processing, shipped, delivered, cancelled, refunded]
 *         totalAmount:
 *           type: number
 *         shippingAddress:
 *           $ref: '#/components/schemas/Address'
 *         paymentMethod:
 *           type: string
 *         paymentStatus:
 *           type: string
 *           enum: [pending, paid, failed, refunded]
 *         tracking:
 *           type: object
 *           properties:
 *             provider:
 *               type: string
 *             trackingNumber:
 *               type: string
 *             trackingUrl:
 *               type: string
 *         createdAt:
 *           type: string
 *           format: date-time
 *         updatedAt:
 *           type: string
 *           format: date-time
 */

const orderItemSchema = new mongoose.Schema({
  product: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
    required: true
  },
  title: {
    type: String,
    required: true,
    trim: true
  },
  price: {
    type: Number,
    required: true,
    min: 0
  },
  quantity: {
    type: Number,
    required: true,
    min: 1
  },
  total: {
    type: Number,
    required: true,
    min: 0
  },
  // Store product data at time of order
  productSnapshot: {
    description: String,
    image: String,
    sku: String,
    brand: String
  },
  // Product variants if any
  selectedVariants: [{
    name: String,
    value: String,
    price: Number
  }]
}, {
  _id: false
});

const shippingAddressSchema = new mongoose.Schema({
  firstName: {
    type: String,
    required: true,
    trim: true
  },
  lastName: {
    type: String,
    required: true,
    trim: true
  },
  street: {
    type: String,
    required: true,
    trim: true
  },
  apartment: {
    type: String,
    trim: true
  },
  city: {
    type: String,
    required: true,
    trim: true
  },
  state: {
    type: String,
    required: true,
    trim: true
  },
  zipCode: {
    type: String,
    required: true,
    trim: true
  },
  country: {
    type: String,
    required: true,
    trim: true,
    default: 'India'
  },
  phone: {
    type: String,
    trim: true
  }
}, {
  _id: false
});

const orderSchema = new mongoose.Schema({
  orderNumber: {
    type: String,
    unique: true,
    required: true,
    uppercase: true
  },
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  items: [orderItemSchema],
  
  // Order Status
  status: {
    type: String,
    enum: [
      'pending',     // Order created, awaiting payment
      'confirmed',   // Payment confirmed
      'processing',  // Being prepared for shipment
      'shipped',     // Order shipped
      'delivered',   // Order delivered
      'cancelled',   // Order cancelled
      'refunded'     // Order refunded
    ],
    default: 'pending'
  },
  
  // Pricing
  subtotal: {
    type: Number,
    required: true,
    min: 0
  },
  taxAmount: {
    type: Number,
    default: 0,
    min: 0
  },
  shippingCost: {
    type: Number,
    default: 0,
    min: 0
  },
  discountAmount: {
    type: Number,
    default: 0,
    min: 0
  },
  totalAmount: {
    type: Number,
    required: true,
    min: 0
  },
  
  // Shipping Information
  shippingAddress: shippingAddressSchema,
  shippingMethod: {
    type: String,
    default: 'standard'
  },
  estimatedDelivery: {
    type: Date
  },
  
  // Payment Information
  paymentMethod: {
    type: String,
    required: true,
    enum: ['stripe', 'paypal', 'razorpay', 'cod']
  },
  paymentStatus: {
    type: String,
    enum: ['pending', 'paid', 'failed', 'refunded', 'partially_refunded'],
    default: 'pending'
  },
  paymentDetails: {
    transactionId: String,
    paymentIntentId: String,
    receiptUrl: String,
    refundId: String,
    refundAmount: Number
  },
  
  // Tracking Information
  tracking: {
    provider: String,
    trackingNumber: String,
    trackingUrl: String,
    shippedAt: Date,
    deliveredAt: Date
  },
  
  // Discounts and Coupons
  appliedCoupon: {
    code: String,
    discountType: {
      type: String,
      enum: ['percentage', 'fixed']
    },
    discountValue: Number,
    discountAmount: Number
  },
  
  // Order Notes
  customerNotes: {
    type: String,
    maxlength: 500
  },
  adminNotes: {
    type: String,
    maxlength: 1000
  },
  
  // Status History
  statusHistory: [{
    status: {
      type: String,
      enum: ['pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled', 'refunded']
    },
    timestamp: {
      type: Date,
      default: Date.now
    },
    notes: String,
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    }
  }],
  
  // Cancellation
  cancellation: {
    reason: String,
    cancelledAt: Date,
    cancelledBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    refundStatus: {
      type: String,
      enum: ['none', 'pending', 'completed', 'failed']
    }
  },
  
  // Return/Exchange
  returnRequest: {
    requested: {
      type: Boolean,
      default: false
    },
    requestedAt: Date,
    reason: String,
    status: {
      type: String,
      enum: ['pending', 'approved', 'rejected', 'completed']
    },
    items: [{
      product: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Product'
      },
      quantity: Number,
      reason: String
    }]
  },
  
  // Analytics
  source: {
    type: String,
    default: 'web'
  },
  
  // Timestamps
  confirmedAt: Date,
  processedAt: Date,
  shippedAt: Date,
  deliveredAt: Date,
  cancelledAt: Date

}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes for performance
orderSchema.index({ user: 1, createdAt: -1 });
// orderSchema.index({ orderNumber: 1 });
orderSchema.index({ status: 1 });
orderSchema.index({ paymentStatus: 1 });
orderSchema.index({ createdAt: -1 });
orderSchema.index({ 'tracking.trackingNumber': 1 });

// Compound indexes
orderSchema.index({ user: 1, status: 1 });
orderSchema.index({ status: 1, createdAt: -1 });

// Virtual for total items count
orderSchema.virtual('totalItems').get(function() {
  return this.items.reduce((total, item) => total + item.quantity, 0);
});

// Virtual for order age in days
orderSchema.virtual('ageInDays').get(function() {
  return Math.floor((Date.now() - this.createdAt) / (1000 * 60 * 60 * 24));
});

// Virtual for full shipping address
orderSchema.virtual('fullShippingAddress').get(function() {
  const addr = this.shippingAddress;
  return `${addr.street}${addr.apartment ? ', ' + addr.apartment : ''}, ${addr.city}, ${addr.state} ${addr.zipCode}, ${addr.country}`;
});

// Pre-save middleware to generate order number
orderSchema.pre('save', async function(next) {
  if (this.isNew && !this.orderNumber) {
    const currentYear = new Date().getFullYear().toString().substr(-2);
    const currentMonth = (new Date().getMonth() + 1).toString().padStart(2, '0');
    
    // Find the last order number for current month
    const lastOrder = await this.constructor.findOne({
      orderNumber: new RegExp(`^SG${currentYear}${currentMonth}`)
    }).sort({ orderNumber: -1 });

    let sequence = 1;
    if (lastOrder) {
      const lastSequence = parseInt(lastOrder.orderNumber.substr(-4));
      sequence = lastSequence + 1;
    }

    this.orderNumber = `SG${currentYear}${currentMonth}${sequence.toString().padStart(4, '0')}`;
  }
  next();
});

// Pre-save middleware to calculate totals
orderSchema.pre('save', function(next) {
  // Calculate subtotal from items
  this.subtotal = this.items.reduce((total, item) => total + item.total, 0);
  
  // Calculate total amount
  this.totalAmount = this.subtotal + this.taxAmount + this.shippingCost - this.discountAmount;
  
  next();
});

// Pre-save middleware to add status history
orderSchema.pre('save', function(next) {
  if (this.isModified('status') && !this.isNew) {
    this.statusHistory.push({
      status: this.status,
      timestamp: new Date()
    });

    // Set timestamp fields based on status
    switch (this.status) {
      case 'confirmed':
        this.confirmedAt = new Date();
        break;
      case 'processing':
        this.processedAt = new Date();
        break;
      case 'shipped':
        this.shippedAt = new Date();
        break;
      case 'delivered':
        this.deliveredAt = new Date();
        break;
      case 'cancelled':
        this.cancelledAt = new Date();
        break;
    }
  }
  next();
});

// Instance method to update status
orderSchema.methods.updateStatus = function(newStatus, notes, updatedBy) {
  const previousStatus = this.status;
  this.status = newStatus;

  // Add to status history
  this.statusHistory.push({
    status: newStatus,
    timestamp: new Date(),
    notes,
    updatedBy
  });

  // Update specific timestamp fields
  const now = new Date();
  switch (newStatus) {
    case 'confirmed':
      this.confirmedAt = now;
      break;
    case 'processing':
      this.processedAt = now;
      break;
    case 'shipped':
      this.shippedAt = now;
      break;
    case 'delivered':
      this.deliveredAt = now;
      break;
    case 'cancelled':
      this.cancelledAt = now;
      break;
  }

  return this.save();
};

// Instance method to add tracking information
orderSchema.methods.addTracking = function(trackingData) {
  this.tracking = {
    ...this.tracking,
    ...trackingData,
    shippedAt: new Date()
  };

  if (this.status === 'processing') {
    this.status = 'shipped';
  }

  return this.save();
};

// Instance method to cancel order
orderSchema.methods.cancelOrder = function(reason, cancelledBy) {
  this.status = 'cancelled';
  this.cancellation = {
    reason,
    cancelledAt: new Date(),
    cancelledBy,
    refundStatus: this.paymentStatus === 'paid' ? 'pending' : 'none'
  };

  return this.save();
};

// Instance method to request return
orderSchema.methods.requestReturn = function(items, reason) {
  this.returnRequest = {
    requested: true,
    requestedAt: new Date(),
    reason,
    status: 'pending',
    items
  };

  return this.save();
};

// Instance method to calculate refund amount
orderSchema.methods.calculateRefundAmount = function(items = null) {
  if (!items) {
    // Full refund
    return this.totalAmount;
  }

  // Partial refund - calculate based on returned items
  let refundAmount = 0;
  items.forEach(returnItem => {
    const orderItem = this.items.find(item => 
      item.product.toString() === returnItem.product.toString()
    );
    if (orderItem) {
      const itemRefund = (orderItem.total / orderItem.quantity) * returnItem.quantity;
      refundAmount += itemRefund;
    }
  });

  return refundAmount;
};

// Instance method to check if order can be cancelled
orderSchema.methods.canBeCancelled = function() {
  return ['pending', 'confirmed', 'processing'].includes(this.status);
};

// Instance method to check if order can be returned
orderSchema.methods.canBeReturned = function() {
  if (this.status !== 'delivered') return false;
  
  // Check if within return window (e.g., 30 days)
  const returnWindow = 30 * 24 * 60 * 60 * 1000; // 30 days in milliseconds
  return (Date.now() - this.deliveredAt.getTime()) < returnWindow;
};

// Static method to find orders by user
orderSchema.statics.findByUser = function(userId, options = {}) {
  const { status, limit = 20, page = 1 } = options;
  
  let query = { user: userId };
  if (status) query.status = status;

  return this.find(query)
    .sort({ createdAt: -1 })
    .limit(limit)
    .skip((page - 1) * limit)
    .populate('items.product', 'title thumbnail');
};

// Static method to find orders by status
orderSchema.statics.findByStatus = function(status) {
  return this.find({ status })
    .populate('user', 'firstName lastName email')
    .sort({ createdAt: -1 });
};

// Static method to get order statistics
orderSchema.statics.getStatistics = async function(dateRange = {}) {
  const { startDate, endDate } = dateRange;
  const matchStage = {};
  
  if (startDate && endDate) {
    matchStage.createdAt = {
      $gte: new Date(startDate),
      $lte: new Date(endDate)
    };
  }

  const stats = await this.aggregate([
    { $match: matchStage },
    {
      $group: {
        _id: null,
        totalOrders: { $sum: 1 },
        totalRevenue: { $sum: '$totalAmount' },
        averageOrderValue: { $avg: '$totalAmount' },
        totalItems: { $sum: { $sum: '$items.quantity' } }
      }
    }
  ]);

  const statusStats = await this.aggregate([
    { $match: matchStage },
    {
      $group: {
        _id: '$status',
        count: { $sum: 1 }
      }
    }
  ]);

  const paymentStats = await this.aggregate([
    { $match: matchStage },
    {
      $group: {
        _id: '$paymentMethod',
        count: { $sum: 1 },
        revenue: { $sum: '$totalAmount' }
      }
    }
  ]);

  return {
    overall: stats[0] || {
      totalOrders: 0,
      totalRevenue: 0,
      averageOrderValue: 0,
      totalItems: 0
    },
    byStatus: statusStats,
    byPaymentMethod: paymentStats
  };
};

// Static method to get recent orders
orderSchema.statics.getRecentOrders = function(limit = 10) {
  return this.find()
    .populate('user', 'firstName lastName email')
    .populate('items.product', 'title thumbnail')
    .sort({ createdAt: -1 })
    .limit(limit);
};

// Static method to find orders requiring action
orderSchema.statics.getOrdersRequiringAction = function() {
  const threeDaysAgo = new Date();
  threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);

  return this.aggregate([
    {
      $match: {
        $or: [
          // Orders pending for more than 3 days
          { 
            status: 'pending', 
            createdAt: { $lt: threeDaysAgo } 
          },
          // Orders processing for more than 5 days
          { 
            status: 'processing', 
            processedAt: { $lt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000) } 
          },
          // Return requests pending
          { 
            'returnRequest.requested': true,
            'returnRequest.status': 'pending'
          }
        ]
      }
    },
    {
      $lookup: {
        from: 'users',
        localField: 'user',
        foreignField: '_id',
        as: 'user'
      }
    },
    {
      $unwind: '$user'
    }
  ]);
};

module.exports = mongoose.model('Order', orderSchema);