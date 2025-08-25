const mongoose = require('mongoose');

/**
 * @swagger
 * components:
 *   schemas:
 *     Review:
 *       type: object
 *       required:
 *         - user
 *         - product
 *         - rating
 *         - title
 *         - comment
 *       properties:
 *         _id:
 *           type: string
 *           description: Review ID
 *         user:
 *           type: string
 *           description: User ID
 *         product:
 *           type: string
 *           description: Product ID
 *         order:
 *           type: string
 *           description: Order ID (if review is from verified purchase)
 *         rating:
 *           type: number
 *           minimum: 1
 *           maximum: 5
 *           description: Rating from 1 to 5 stars
 *         title:
 *           type: string
 *           description: Review title
 *         comment:
 *           type: string
 *           description: Review comment
 *         pros:
 *           type: array
 *           items:
 *             type: string
 *         cons:
 *           type: array
 *           items:
 *             type: string
 *         recommend:
 *           type: boolean
 *           description: Would recommend this product
 *         verifiedPurchase:
 *           type: boolean
 *           description: Review from verified purchase
 *         helpfulCount:
 *           type: number
 *           description: Number of users who found this review helpful
 *         images:
 *           type: array
 *           items:
 *             type: object
 *             properties:
 *               public_id:
 *                 type: string
 *               url:
 *                 type: string
 *         isApproved:
 *           type: boolean
 *           default: true
 *         createdAt:
 *           type: string
 *           format: date-time
 *         updatedAt:
 *           type: string
 *           format: date-time
 */

const reviewSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'User is required']
  },
  product: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
    required: [true, 'Product is required']
  },
  order: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Order'
  },
  rating: {
    type: Number,
    required: [true, 'Rating is required'],
    min: [1, 'Rating must be at least 1'],
    max: [5, 'Rating cannot exceed 5']
  },
  title: {
    type: String,
    required: [true, 'Review title is required'],
    trim: true,
    maxlength: [100, 'Title cannot exceed 100 characters']
  },
  comment: {
    type: String,
    required: [true, 'Review comment is required'],
    trim: true,
    minlength: [10, 'Comment must be at least 10 characters'],
    maxlength: [1000, 'Comment cannot exceed 1000 characters']
  },
  pros: [{
    type: String,
    trim: true,
    maxlength: [100, 'Pro cannot exceed 100 characters']
  }],
  cons: [{
    type: String,
    trim: true,
    maxlength: [100, 'Con cannot exceed 100 characters']
  }],
  recommend: {
    type: Boolean,
    default: true
  },
  verifiedPurchase: {
    type: Boolean,
    default: false
  },
  helpfulCount: {
    type: Number,
    default: 0,
    min: 0
  },
  // Users who marked this review as helpful
  helpfulUsers: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  // Review images (uploaded by user)
  images: [{
    public_id: {
      type: String,
      required: true
    },
    url: {
      type: String,
      required: true
    },
    alt: {
      type: String,
      default: 'Review image'
    }
  }],
  // Moderation
  isApproved: {
    type: Boolean,
    default: true
  },
  isReported: {
    type: Boolean,
    default: false
  },
  reportCount: {
    type: Number,
    default: 0
  },
  moderationNotes: {
    type: String,
    maxlength: 500
  },
  // Reply from seller/admin
  reply: {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    comment: {
      type: String,
      maxlength: 500
    },
    createdAt: {
      type: Date,
      default: Date.now
    }
  },
  // Analytics
  views: {
    type: Number,
    default: 0
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes for performance
reviewSchema.index({ product: 1, createdAt: -1 });
reviewSchema.index({ user: 1, createdAt: -1 });
reviewSchema.index({ rating: 1 });
reviewSchema.index({ isApproved: 1 });
reviewSchema.index({ verifiedPurchase: 1 });
reviewSchema.index({ helpfulCount: -1 });

// Compound indexes
reviewSchema.index({ product: 1, isApproved: 1, createdAt: -1 });
reviewSchema.index({ user: 1, product: 1 }, { unique: true });

// Virtual for review age
reviewSchema.virtual('ageInDays').get(function() {
  return Math.floor((Date.now() - this.createdAt) / (1000 * 60 * 60 * 24));
});

// Virtual for helpful percentage
reviewSchema.virtual('helpfulPercentage').get(function() {
  if (this.views === 0) return 0;
  return Math.round((this.helpfulCount / this.views) * 100);
});

// Pre-save middleware to check for verified purchase
reviewSchema.pre('save', async function(next) {
  if (this.isNew && this.order) {
    const Order = mongoose.model('Order');
    const order = await Order.findOne({
      _id: this.order,
      user: this.user,
      status: 'delivered',
      'items.product': this.product
    });

    if (order) {
      this.verifiedPurchase = true;
    }
  }
  next();
});

// Post-save middleware to update product rating
reviewSchema.post('save', async function() {
  const Product = mongoose.model('Product');
  const product = await Product.findById(this.product);
  
  if (product) {
    await product.updateRating();
  }
});

// Post-remove middleware to update product rating
reviewSchema.post('deleteOne', { document: true }, async function() {
  const Product = mongoose.model('Product');
  const product = await Product.findById(this.product);
  
  if (product) {
    await product.updateRating();
  }
});

// Instance method to mark as helpful
reviewSchema.methods.markAsHelpful = function(userId) {
  if (!this.helpfulUsers.includes(userId)) {
    this.helpfulUsers.push(userId);
    this.helpfulCount += 1;
    return this.save();
  }
  return Promise.resolve(this);
};

// Instance method to unmark as helpful
reviewSchema.methods.unmarkAsHelpful = function(userId) {
  const index = this.helpfulUsers.indexOf(userId);
  if (index > -1) {
    this.helpfulUsers.splice(index, 1);
    this.helpfulCount = Math.max(0, this.helpfulCount - 1);
    return this.save();
  }
  return Promise.resolve(this);
};

// Instance method to add reply
reviewSchema.methods.addReply = function(userId, comment) {
  this.reply = {
    user: userId,
    comment,
    createdAt: new Date()
  };
  return this.save();
};

// Instance method to report review
reviewSchema.methods.reportReview = function() {
  this.isReported = true;
  this.reportCount += 1;
  return this.save();
};

// Instance method to approve review
reviewSchema.methods.approve = function(notes) {
  this.isApproved = true;
  this.moderationNotes = notes;
  return this.save();
};

// Instance method to reject review
reviewSchema.methods.reject = function(notes) {
  this.isApproved = false;
  this.moderationNotes = notes;
  return this.save();
};

// Instance method to increment views
reviewSchema.methods.incrementViews = function() {
  this.views += 1;
  return this.save();
};

// Static method to find reviews by product
reviewSchema.statics.findByProduct = function(productId, options = {}) {
  const {
    page = 1,
    limit = 10,
    sortBy = 'createdAt',
    sortOrder = 'desc',
    rating,
    verifiedOnly = false
  } = options;

  let query = { 
    product: productId, 
    isApproved: true 
  };

  if (rating) {
    query.rating = rating;
  }

  if (verifiedOnly) {
    query.verifiedPurchase = true;
  }

  const sort = {};
  sort[sortBy] = sortOrder === 'desc' ? -1 : 1;

  return this.find(query)
    .populate('user', 'firstName lastName avatar')
    .populate('reply.user', 'firstName lastName')
    .sort(sort)
    .skip((page - 1) * limit)
    .limit(limit);
};

// Static method to find reviews by user
reviewSchema.statics.findByUser = function(userId, options = {}) {
  const { page = 1, limit = 10 } = options;

  return this.find({ user: userId })
    .populate('product', 'title thumbnail')
    .sort({ createdAt: -1 })
    .skip((page - 1) * limit)
    .limit(limit);
};

// Static method to get review statistics for a product
reviewSchema.statics.getProductReviewStats = async function(productId) {
  const stats = await this.aggregate([
    {
      $match: { 
        product: mongoose.Types.ObjectId(productId),
        isApproved: true
      }
    },
    {
      $group: {
        _id: '$rating',
        count: { $sum: 1 }
      }
    },
    {
      $sort: { _id: -1 }
    }
  ]);

  const totalReviews = await this.countDocuments({ 
    product: productId, 
    isApproved: true 
  });

  const averageRating = await this.aggregate([
    {
      $match: { 
        product: mongoose.Types.ObjectId(productId),
        isApproved: true
      }
    },
    {
      $group: {
        _id: null,
        averageRating: { $avg: '$rating' }
      }
    }
  ]);

  const verifiedReviews = await this.countDocuments({
    product: productId,
    isApproved: true,
    verifiedPurchase: true
  });

  const ratingDistribution = {};
  for (let i = 1; i <= 5; i++) {
    ratingDistribution[i] = 0;
  }

  stats.forEach(stat => {
    ratingDistribution[stat._id] = stat.count;
  });

  return {
    totalReviews,
    averageRating: averageRating[0]?.averageRating || 0,
    verifiedReviews,
    verifiedPercentage: totalReviews > 0 ? Math.round((verifiedReviews / totalReviews) * 100) : 0,
    ratingDistribution,
    ratingPercentages: Object.keys(ratingDistribution).reduce((acc, rating) => {
      acc[rating] = totalReviews > 0 
        ? Math.round((ratingDistribution[rating] / totalReviews) * 100) 
        : 0;
      return acc;
    }, {})
  };
};

// Static method to get most helpful reviews
reviewSchema.statics.getMostHelpful = function(productId, limit = 5) {
  return this.find({ 
    product: productId, 
    isApproved: true,
    helpfulCount: { $gt: 0 }
  })
    .populate('user', 'firstName lastName avatar')
    .sort({ helpfulCount: -1, createdAt: -1 })
    .limit(limit);
};

// Static method to get recent reviews
reviewSchema.statics.getRecent = function(limit = 10) {
  return this.find({ isApproved: true })
    .populate('user', 'firstName lastName avatar')
    .populate('product', 'title thumbnail')
    .sort({ createdAt: -1 })
    .limit(limit);
};

// Static method to get reviews requiring moderation
reviewSchema.statics.getReviewsForModeration = function() {
  return this.find({
    $or: [
      { isApproved: false },
      { isReported: true, reportCount: { $gte: 3 } }
    ]
  })
    .populate('user', 'firstName lastName email')
    .populate('product', 'title thumbnail')
    .sort({ createdAt: -1 });
};

// Static method to get review analytics
reviewSchema.statics.getAnalytics = async function(dateRange = {}) {
  const { startDate, endDate } = dateRange;
  const matchStage = { isApproved: true };
  
  if (startDate && endDate) {
    matchStage.createdAt = {
      $gte: new Date(startDate),
      $lte: new Date(endDate)
    };
  }

  const analytics = await this.aggregate([
    { $match: matchStage },
    {
      $group: {
        _id: null,
        totalReviews: { $sum: 1 },
        averageRating: { $avg: '$rating' },
        verifiedReviews: {
          $sum: { $cond: ['$verifiedPurchase', 1, 0] }
        },
        totalHelpfulVotes: { $sum: '$helpfulCount' },
        reviewsWithImages: {
          $sum: { $cond: [{ $gt: [{ $size: '$images' }, 0] }, 1, 0] }
        }
      }
    }
  ]);

  const ratingDistribution = await this.aggregate([
    { $match: matchStage },
    {
      $group: {
        _id: '$rating',
        count: { $sum: 1 }
      }
    },
    { $sort: { _id: 1 } }
  ]);

  const topProducts = await this.aggregate([
    { $match: matchStage },
    {
      $group: {
        _id: '$product',
        reviewCount: { $sum: 1 },
        averageRating: { $avg: '$rating' }
      }
    },
    { $sort: { reviewCount: -1 } },
    { $limit: 10 },
    {
      $lookup: {
        from: 'products',
        localField: '_id',
        foreignField: '_id',
        as: 'product'
      }
    },
    { $unwind: '$product' },
    {
      $project: {
        productId: '$_id',
        productTitle: '$product.title',
        reviewCount: 1,
        averageRating: 1
      }
    }
  ]);

  return {
    overall: analytics[0] || {
      totalReviews: 0,
      averageRating: 0,
      verifiedReviews: 0,
      totalHelpfulVotes: 0,
      reviewsWithImages: 0
    },
    ratingDistribution,
    topProducts
  };
};

// Static method to check if user can review product
reviewSchema.statics.canUserReview = async function(userId, productId) {
  // Check if user already reviewed this product
  const existingReview = await this.findOne({ user: userId, product: productId });
  if (existingReview) {
    return { canReview: false, reason: 'Already reviewed' };
  }

  // Check if user purchased this product
  const Order = mongoose.model('Order');
  const purchase = await Order.findOne({
    user: userId,
    status: 'delivered',
    'items.product': productId
  });

  return {
    canReview: true,
    verifiedPurchase: !!purchase,
    orderId: purchase?._id
  };
};

module.exports = mongoose.model('Review', reviewSchema);