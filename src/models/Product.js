const mongoose = require('mongoose');
const slugify = require('slugify');

/**
 * @swagger
 * components:
 *   schemas:
 *     Product:
 *       type: object
 *       required:
 *         - title
 *         - description
 *         - price
 *         - category
 *         - stock
 *       properties:
 *         _id:
 *           type: string
 *           description: Product ID
 *         title:
 *           type: string
 *           description: Product title
 *         description:
 *           type: string
 *           description: Product description
 *         slug:
 *           type: string
 *           description: URL-friendly version of title
 *         price:
 *           type: number
 *           description: Product price
 *         originalPrice:
 *           type: number
 *           description: Original price before discount
 *         discountPercentage:
 *           type: number
 *           description: Discount percentage
 *         category:
 *           type: string
 *           description: Product category ID
 *         subcategory:
 *           type: string
 *           description: Product subcategory
 *         brand:
 *           type: string
 *           description: Product brand
 *         sku:
 *           type: string
 *           description: Stock keeping unit
 *         stock:
 *           type: number
 *           description: Available stock quantity
 *         images:
 *           type: array
 *           items:
 *             type: object
 *             properties:
 *               public_id:
 *                 type: string
 *               url:
 *                 type: string
 *               alt:
 *                 type: string
 *         thumbnail:
 *           type: string
 *           description: Main product image URL
 *         rating:
 *           type: number
 *           description: Average rating
 *         numReviews:
 *           type: number
 *           description: Number of reviews
 *         isActive:
 *           type: boolean
 *           default: true
 *         isFeatured:
 *           type: boolean
 *           default: false
 *         tags:
 *           type: array
 *           items:
 *             type: string
 *         specifications:
 *           type: object
 *         dimensions:
 *           type: object
 *           properties:
 *             length:
 *               type: number
 *             width:
 *               type: number
 *             height:
 *               type: number
 *             weight:
 *               type: number
 *         shipping:
 *           type: object
 *           properties:
 *             free:
 *               type: boolean
 *             cost:
 *               type: number
 *             estimatedDays:
 *               type: number
 *         seo:
 *           type: object
 *           properties:
 *             metaTitle:
 *               type: string
 *             metaDescription:
 *               type: string
 *             metaKeywords:
 *               type: array
 *               items:
 *                 type: string
 *         createdAt:
 *           type: string
 *           format: date-time
 *         updatedAt:
 *           type: string
 *           format: date-time
 */

const productSchema = new mongoose.Schema({
  title: {
    type: String,
    required: [true, 'Product title is required'],
    trim: true,
    maxlength: [200, 'Title cannot exceed 200 characters']
  },
  slug: {
    type: String,
    unique: true,
    lowercase: true
  },
  description: {
    type: String,
    required: [true, 'Product description is required'],
    maxlength: [2000, 'Description cannot exceed 2000 characters']
  },
  shortDescription: {
    type: String,
    maxlength: [500, 'Short description cannot exceed 500 characters']
  },
  price: {
    type: Number,
    required: [true, 'Product price is required'],
    min: [0, 'Price cannot be negative']
  },
  originalPrice: {
    type: Number,
    min: [0, 'Original price cannot be negative']
  },
  discountPercentage: {
    type: Number,
    min: [0, 'Discount cannot be negative'],
    max: [100, 'Discount cannot exceed 100%'],
    default: 0
  },
  category: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Category',
    required: [true, 'Product category is required']
  },
  subcategory: {
    type: String,
    trim: true
  },
  brand: {
    type: String,
    trim: true,
    maxlength: [100, 'Brand name cannot exceed 100 characters']
  },
  sku: {
    type: String,
    unique: true,
    trim: true,
    uppercase: true
  },
  barcode: {
    type: String,
    trim: true
  },
  stock: {
    type: Number,
    required: [true, 'Stock quantity is required'],
    min: [0, 'Stock cannot be negative'],
    default: 0
  },
  lowStockThreshold: {
    type: Number,
    default: 10
  },
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
      default: ''
    },
    isPrimary: {
      type: Boolean,
      default: false
    }
  }],
  thumbnail: {
    type: String,
    required: [true, 'Product thumbnail is required']
  },
  rating: {
    type: Number,
    default: 0,
    min: [0, 'Rating cannot be negative'],
    max: [5, 'Rating cannot exceed 5']
  },
  numReviews: {
    type: Number,
    default: 0
  },
  reviews: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Review'
  }],
  isActive: {
    type: Boolean,
    default: true
  },
  isFeatured: {
    type: Boolean,
    default: false
  },
  isDigital: {
    type: Boolean,
    default: false
  },
  downloadUrl: {
    type: String // For digital products
  },
  tags: [{
    type: String,
    trim: true,
    lowercase: true
  }],
  specifications: {
    type: Map,
    of: String
  },
  variants: [{
    name: {
      type: String,
      required: true
    },
    options: [{
      value: String,
      price: Number,
      stock: Number,
      sku: String
    }]
  }],
  dimensions: {
    length: {
      type: Number,
      min: 0
    },
    width: {
      type: Number,
      min: 0
    },
    height: {
      type: Number,
      min: 0
    },
    weight: {
      type: Number,
      min: 0
    },
    unit: {
      type: String,
      enum: ['cm', 'inch', 'mm'],
      default: 'cm'
    },
    weightUnit: {
      type: String,
      enum: ['kg', 'g', 'lb', 'oz'],
      default: 'kg'
    }
  },
  shipping: {
    free: {
      type: Boolean,
      default: false
    },
    cost: {
      type: Number,
      min: 0,
      default: 0
    },
    estimatedDays: {
      type: Number,
      min: 1,
      default: 5
    },
    weight: {
      type: Number,
      min: 0
    },
    dimensions: {
      length: Number,
      width: Number,
      height: Number
    }
  },
  seo: {
    metaTitle: {
      type: String,
      maxlength: [60, 'Meta title cannot exceed 60 characters']
    },
    metaDescription: {
      type: String,
      maxlength: [160, 'Meta description cannot exceed 160 characters']
    },
    metaKeywords: [{
      type: String,
      trim: true,
      lowercase: true
    }]
  },
  // Analytics
  views: {
    type: Number,
    default: 0
  },
  purchases: {
    type: Number,
    default: 0
  },
  revenue: {
    type: Number,
    default: 0
  },
  // Admin fields
  seller: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  approvalStatus: {
    type: String,
    enum: ['pending', 'approved', 'rejected'],
    default: 'approved'
  },
  rejectionReason: {
    type: String
  },
  // Timestamps for stock updates
  lastStockUpdate: {
    type: Date,
    default: Date.now
  },
  // Related products
  relatedProducts: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product'
  }],
  // Seasonal/promotional
  isSeasonalDiscount: {
    type: Boolean,
    default: false
  },
  seasonalDiscountStart: {
    type: Date
  },
  seasonalDiscountEnd: {
    type: Date
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes for performance
productSchema.index({ title: 'text', description: 'text', tags: 'text' });
productSchema.index({ category: 1 });
productSchema.index({ brand: 1 });
productSchema.index({ price: 1 });
productSchema.index({ rating: -1 });
productSchema.index({ createdAt: -1 });
productSchema.index({ isActive: 1 });
productSchema.index({ isFeatured: 1 });
// productSchema.index({ slug: 1 });
// productSchema.index({ sku: 1 });
productSchema.index({ stock: 1 });

// Compound indexes
productSchema.index({ category: 1, isActive: 1 });
productSchema.index({ price: 1, rating: -1 });
productSchema.index({ isActive: 1, isFeatured: 1 });

// Virtual for stock status
productSchema.virtual('stockStatus').get(function() {
  if (this.stock === 0) return 'outOfStock';
  if (this.stock <= this.lowStockThreshold) return 'lowStock';
  return 'inStock';
});

// Virtual for discount amount
productSchema.virtual('discountAmount').get(function() {
  if (this.originalPrice && this.discountPercentage > 0) {
    return this.originalPrice - this.price;
  }
  return 0;
});

// Virtual for primary image
productSchema.virtual('primaryImage').get(function() {
  const primary = this.images.find(img => img.isPrimary);
  return primary ? primary.url : this.thumbnail;
});

// Pre-save middleware to generate slug
productSchema.pre('save', function(next) {
  if (this.isModified('title')) {
    this.slug = slugify(this.title, {
      lower: true,
      strict: true,
      remove: /[*+~.()'"!:@]/g
    });
  }
  next();
});

// Pre-save middleware to generate SKU if not provided
productSchema.pre('save', function(next) {
  if (!this.sku && this.isNew) {
    const prefix = this.brand ? this.brand.substring(0, 3).toUpperCase() : 'PRD';
    const random = Math.random().toString(36).substring(2, 8).toUpperCase();
    this.sku = `${prefix}-${random}`;
  }
  next();
});

// Pre-save middleware to set original price
productSchema.pre('save', function(next) {
  if (this.isModified('price') && !this.originalPrice) {
    this.originalPrice = this.price;
  }
  next();
});

// Pre-save middleware to calculate discount
productSchema.pre('save', function(next) {
  if (this.originalPrice && this.price < this.originalPrice) {
    this.discountPercentage = Math.round(
      ((this.originalPrice - this.price) / this.originalPrice) * 100
    );
  }
  next();
});

// Pre-save middleware to set primary image
productSchema.pre('save', function(next) {
  if (this.isModified('images') && this.images.length > 0) {
    // If no primary image is set, make the first one primary
    const hasPrimary = this.images.some(img => img.isPrimary);
    if (!hasPrimary) {
      this.images[0].isPrimary = true;
    }
    
    // Set thumbnail to primary image
    const primaryImage = this.images.find(img => img.isPrimary);
    if (primaryImage) {
      this.thumbnail = primaryImage.url;
    }
  }
  next();
});

// Pre-save middleware to update stock timestamp
productSchema.pre('save', function(next) {
  if (this.isModified('stock')) {
    this.lastStockUpdate = new Date();
  }
  next();
});

// Instance method to update rating
productSchema.methods.updateRating = async function() {
  const Review = mongoose.model('Review');
  const stats = await Review.aggregate([
    {
      $match: { product: this._id }
    },
    {
      $group: {
        _id: '$product',
        numReviews: { $sum: 1 },
        averageRating: { $avg: '$rating' }
      }
    }
  ]);

  if (stats.length > 0) {
    this.rating = Math.round(stats[0].averageRating * 10) / 10;
    this.numReviews = stats[0].numReviews;
  } else {
    this.rating = 0;
    this.numReviews = 0;
  }

  await this.save();
};

// Instance method to check if in stock
productSchema.methods.isInStock = function(quantity = 1) {
  return this.stock >= quantity;
};

// Instance method to reserve stock
productSchema.methods.reserveStock = function(quantity) {
  if (!this.isInStock(quantity)) {
    throw new Error('Insufficient stock');
  }
  this.stock -= quantity;
  return this.save();
};

// Instance method to release stock
productSchema.methods.releaseStock = function(quantity) {
  this.stock += quantity;
  return this.save();
};

// Instance method to increment view count
productSchema.methods.incrementViews = function() {
  this.views += 1;
  return this.save();
};

// Static method to find by category
productSchema.statics.findByCategory = function(categoryId) {
  return this.find({ category: categoryId, isActive: true });
};

// Static method to find featured products
productSchema.statics.findFeatured = function(limit = 10) {
  return this.find({ isFeatured: true, isActive: true })
    .limit(limit)
    .populate('category', 'name');
};

// Static method to find products by price range
productSchema.statics.findByPriceRange = function(minPrice, maxPrice) {
  return this.find({
    price: { $gte: minPrice, $lte: maxPrice },
    isActive: true
  });
};

// Static method to search products
productSchema.statics.search = function(query, options = {}) {
  const {
    category,
    brand,
    minPrice,
    maxPrice,
    inStock = true,
    sortBy = 'createdAt',
    sortOrder = 'desc',
    page = 1,
    limit = 20
  } = options;

  const searchQuery = { isActive: true };

  // Text search
  if (query) {
    searchQuery.$text = { $search: query };
  }

  // Category filter
  if (category) {
    searchQuery.category = category;
  }

  // Brand filter
  if (brand) {
    searchQuery.brand = new RegExp(brand, 'i');
  }

  // Price range filter
  if (minPrice !== undefined || maxPrice !== undefined) {
    searchQuery.price = {};
    if (minPrice !== undefined) searchQuery.price.$gte = minPrice;
    if (maxPrice !== undefined) searchQuery.price.$lte = maxPrice;
  }

  // Stock filter
  if (inStock) {
    searchQuery.stock = { $gt: 0 };
  }

  const sort = {};
  sort[sortBy] = sortOrder === 'desc' ? -1 : 1;

  return this.find(searchQuery)
    .populate('category', 'name')
    .sort(sort)
    .skip((page - 1) * limit)
    .limit(limit);
};

// Static method to get low stock products
productSchema.statics.getLowStockProducts = function() {
  return this.find({
    $expr: { $lte: ['$stock', '$lowStockThreshold'] },
    isActive: true
  });
};

module.exports = mongoose.model('Product', productSchema);