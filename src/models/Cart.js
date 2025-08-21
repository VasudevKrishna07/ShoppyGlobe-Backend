const mongoose = require('mongoose');

/**
 * @swagger
 * components:
 *   schemas:
 *     Cart:
 *       type: object
 *       properties:
 *         _id:
 *           type: string
 *           description: Cart ID
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
 *               quantity:
 *                 type: number
 *                 minimum: 1
 *               price:
 *                 type: number
 *               total:
 *                 type: number
 *               addedAt:
 *                 type: string
 *                 format: date-time
 *         totalItems:
 *           type: number
 *         totalAmount:
 *           type: number
 *         lastModified:
 *           type: string
 *           format: date-time
 *         createdAt:
 *           type: string
 *           format: date-time
 *         updatedAt:
 *           type: string
 *           format: date-time
 */

const cartItemSchema = new mongoose.Schema({
  product: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
    required: true
  },
  quantity: {
    type: Number,
    required: true,
    min: [1, 'Quantity must be at least 1'],
    max: [99, 'Quantity cannot exceed 99']
  },
  price: {
    type: Number,
    required: true,
    min: 0
  },
  total: {
    type: Number,
    required: true,
    min: 0
  },
  addedAt: {
    type: Date,
    default: Date.now
  },
  // For product variants
  selectedVariants: [{
    name: String,
    value: String,
    price: Number
  }]
}, {
  _id: false
});

const cartSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true
  },
  items: [cartItemSchema],
  totalItems: {
    type: Number,
    default: 0,
    min: 0
  },
  totalAmount: {
    type: Number,
    default: 0,
    min: 0
  },
  lastModified: {
    type: Date,
    default: Date.now
  },
  // For abandoned cart recovery
  isAbandoned: {
    type: Boolean,
    default: false
  },
  abandonedAt: {
    type: Date
  },
  // Session ID for guest users (future enhancement)
  sessionId: {
    type: String,
    sparse: true
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes
cartSchema.index({ user: 1 });
cartSchema.index({ sessionId: 1 });
cartSchema.index({ lastModified: 1 });
cartSchema.index({ isAbandoned: 1, abandonedAt: 1 });

// Virtual for cart item count
cartSchema.virtual('itemCount').get(function() {
  return this.items.reduce((total, item) => total + item.quantity, 0);
});

// Pre-save middleware to calculate totals
cartSchema.pre('save', function(next) {
  if (this.items && this.items.length > 0) {
    // Calculate item totals
    this.items.forEach(item => {
      item.total = item.price * item.quantity;
    });

    // Calculate cart totals
    this.totalItems = this.items.reduce((total, item) => total + item.quantity, 0);
    this.totalAmount = this.items.reduce((total, item) => total + item.total, 0);
  } else {
    this.totalItems = 0;
    this.totalAmount = 0;
  }

  this.lastModified = new Date();
  next();
});

// Instance method to add item to cart
cartSchema.methods.addItem = function(productId, quantity, price, variants = []) {
  const existingItemIndex = this.items.findIndex(
    item => item.product.toString() === productId.toString()
  );

  if (existingItemIndex > -1) {
    // Update existing item
    this.items[existingItemIndex].quantity += quantity;
    this.items[existingItemIndex].addedAt = new Date();
  } else {
    // Add new item
    this.items.push({
      product: productId,
      quantity,
      price,
      total: price * quantity,
      selectedVariants: variants,
      addedAt: new Date()
    });
  }

  return this.save();
};

// Instance method to update item quantity
cartSchema.methods.updateItemQuantity = function(productId, quantity) {
  const item = this.items.find(
    item => item.product.toString() === productId.toString()
  );

  if (!item) {
    throw new Error('Item not found in cart');
  }

  if (quantity <= 0) {
    // Remove item if quantity is 0 or negative
    this.items = this.items.filter(
      item => item.product.toString() !== productId.toString()
    );
  } else {
    item.quantity = quantity;
    item.addedAt = new Date();
  }

  return this.save();
};

// Instance method to remove item from cart
cartSchema.methods.removeItem = function(productId) {
  this.items = this.items.filter(
    item => item.product.toString() !== productId.toString()
  );

  return this.save();
};

// Instance method to clear cart
cartSchema.methods.clearCart = function() {
  this.items = [];
  return this.save();
};

// Instance method to check if product is in cart
cartSchema.methods.hasProduct = function(productId) {
  return this.items.some(
    item => item.product.toString() === productId.toString()
  );
};

// Instance method to get item by product ID
cartSchema.methods.getItem = function(productId) {
  return this.items.find(
    item => item.product.toString() === productId.toString()
  );
};

// Instance method to validate cart items against current product data
cartSchema.methods.validateItems = async function() {
  const Product = mongoose.model('Product');
  const validationResults = [];

  for (const item of this.items) {
    const product = await Product.findById(item.product);
    
    if (!product) {
      validationResults.push({
        productId: item.product,
        issue: 'Product not found',
        action: 'remove'
      });
      continue;
    }

    if (!product.isActive) {
      validationResults.push({
        productId: item.product,
        issue: 'Product no longer available',
        action: 'remove'
      });
      continue;
    }

    if (product.stock < item.quantity) {
      validationResults.push({
        productId: item.product,
        issue: `Only ${product.stock} items in stock`,
        action: 'update_quantity',
        availableStock: product.stock
      });
      continue;
    }

    if (product.price !== item.price) {
      validationResults.push({
        productId: item.product,
        issue: 'Price has changed',
        action: 'update_price',
        oldPrice: item.price,
        newPrice: product.price
      });
    }
  }

  return validationResults;
};

// Instance method to apply validation results
cartSchema.methods.applyValidation = async function(validationResults) {
  const Product = mongoose.model('Product');

  for (const result of validationResults) {
    switch (result.action) {
      case 'remove':
        await this.removeItem(result.productId);
        break;

      case 'update_quantity':
        await this.updateItemQuantity(result.productId, result.availableStock);
        break;

      case 'update_price':
        const item = this.getItem(result.productId);
        if (item) {
          item.price = result.newPrice;
        }
        break;
    }
  }

  return this.save();
};

// Instance method to mark cart as abandoned
cartSchema.methods.markAsAbandoned = function() {
  this.isAbandoned = true;
  this.abandonedAt = new Date();
  return this.save();
};

// Static method to find cart by user
cartSchema.statics.findByUser = function(userId) {
  return this.findOne({ user: userId }).populate({
    path: 'items.product',
    select: 'title price thumbnail stock isActive'
  });
};

// Static method to get abandoned carts
cartSchema.statics.getAbandonedCarts = function(daysAgo = 1) {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - daysAgo);

  return this.find({
    lastModified: { $lt: cutoffDate },
    items: { $ne: [] },
    isAbandoned: false
  }).populate('user', 'firstName lastName email');
};

// Static method to clean up old empty carts
cartSchema.statics.cleanupEmptyCarts = function(daysAgo = 30) {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - daysAgo);

  return this.deleteMany({
    $or: [
      { items: { $size: 0 } },
      { items: { $exists: false } }
    ],
    lastModified: { $lt: cutoffDate }
  });
};

// Static method to get cart statistics
cartSchema.statics.getStatistics = async function() {
  const stats = await this.aggregate([
    {
      $group: {
        _id: null,
        totalCarts: { $sum: 1 },
        totalItems: { $sum: '$totalItems' },
        totalValue: { $sum: '$totalAmount' },
        averageCartValue: { $avg: '$totalAmount' },
        averageItemsPerCart: { $avg: '$totalItems' }
      }
    }
  ]);

  const abandonedCarts = await this.countDocuments({ isAbandoned: true });
  const activeCarts = await this.countDocuments({ 
    items: { $ne: [] }, 
    isAbandoned: false 
  });

  return {
    total: stats[0]?.totalCarts || 0,
    active: activeCarts,
    abandoned: abandonedCarts,
    totalItems: stats[0]?.totalItems || 0,
    totalValue: stats[0]?.totalValue || 0,
    averageCartValue: stats[0]?.averageCartValue || 0,
    averageItemsPerCart: stats[0]?.averageItemsPerCart || 0,
    abandonmentRate: stats[0]?.totalCarts > 0 
      ? ((abandonedCarts / stats[0].totalCarts) * 100).toFixed(2) 
      : 0
  };
};

module.exports = mongoose.model('Cart', cartSchema);