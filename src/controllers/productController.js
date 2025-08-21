const Product = require('../models/Product');
const Category = require('../models/Category');
const asyncHandler = require('../utils/asyncHandler');
const AppError = require('../utils/appError');
const logger = require('../config/logger');

/**
 * @desc    Get all products with filtering, sorting, and pagination
 * @route   GET /api/products
 * @access  Public
 */
const getProducts = asyncHandler(async (req, res, next) => {
  // Build query
  const queryObj = { ...req.query };
  const excludedFields = ['page', 'sort', 'limit', 'fields', 'search'];
  excludedFields.forEach(el => delete queryObj[el]);

  // Add active filter by default
  queryObj.isActive = true;

  // Advanced filtering
  let queryStr = JSON.stringify(queryObj);
  queryStr = queryStr.replace(/\b(gte|gt|lte|lt|in)\b/g, match => `$${match}`);
  
  let query = Product.find(JSON.parse(queryStr));

  // Text search
  if (req.query.search) {
    query = query.find({
      $text: { $search: req.query.search }
    });
  }

  // Category filter
  if (req.query.category) {
    const categories = req.query.category.split(',');
    query = query.find({ category: { $in: categories } });
  }

  // Brand filter
  if (req.query.brand) {
    const brands = req.query.brand.split(',');
    query = query.find({ brand: { $in: brands } });
  }

  // Price range filter
  if (req.query.minPrice || req.query.maxPrice) {
    const priceFilter = {};
    if (req.query.minPrice) priceFilter.$gte = parseFloat(req.query.minPrice);
    if (req.query.maxPrice) priceFilter.$lte = parseFloat(req.query.maxPrice);
    query = query.find({ price: priceFilter });
  }

  // Rating filter
  if (req.query.minRating) {
    query = query.find({ rating: { $gte: parseFloat(req.query.minRating) } });
  }

  // In stock filter
  if (req.query.inStock === 'true') {
    query = query.find({ stock: { $gt: 0 } });
  }

  // Featured products filter
  if (req.query.featured === 'true') {
    query = query.find({ isFeatured: true });
  }

  // Sorting
  if (req.query.sort) {
    const sortBy = req.query.sort.split(',').join(' ');
    query = query.sort(sortBy);
  } else {
    query = query.sort('-createdAt');
  }

  // Field limiting
  if (req.query.fields) {
    const fields = req.query.fields.split(',').join(' ');
    query = query.select(fields);
  } else {
    query = query.select('-__v');
  }

  // Pagination
  const page = parseInt(req.query.page, 10) || 1;
  const limit = parseInt(req.query.limit, 10) || 20;
  const startIndex = (page - 1) * limit;
  const endIndex = page * limit;
  const total = await Product.countDocuments(JSON.parse(queryStr.replace(/\b(gte|gt|lte|lt|in)\b/g, match => `$${match}`)));

  query = query.skip(startIndex).limit(limit);

  // Populate category
  query = query.populate('category', 'name slug');

  // Execute query
  const products = await query;

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
    count: products.length,
    total,
    pagination,
    data: {
      products
    }
  });
});

/**
 * @desc    Get single product
 * @route   GET /api/products/:id
 * @access  Public
 */
const getProduct = asyncHandler(async (req, res, next) => {
  const product = await Product.findById(req.params.id)
    .populate('category', 'name slug')
    .populate({
      path: 'reviews',
      populate: {
        path: 'user',
        select: 'firstName lastName avatar'
      }
    })
    .populate('relatedProducts', 'title price thumbnail rating');

  if (!product) {
    return next(new AppError('Product not found', 404));
  }

  // Increment view count
  await product.incrementViews();

  res.status(200).json({
    success: true,
    data: {
      product
    }
  });
});

/**
 * @desc    Create new product
 * @route   POST /api/products
 * @access  Private (Admin/Seller)
 */
const createProduct = asyncHandler(async (req, res, next) => {
  // Add user to req.body
  req.body.seller = req.user.id;

  // Verify category exists
  const category = await Category.findById(req.body.category);
  if (!category) {
    return next(new AppError('Category not found', 404));
  }

  const product = await Product.create(req.body);

  logger.info(`New product created: ${product.title} by ${req.user.email}`);

  res.status(201).json({
    success: true,
    message: 'Product created successfully',
    data: {
      product
    }
  });
});

/**
 * @desc    Update product
 * @route   PUT /api/products/:id
 * @access  Private (Admin/Seller - Own products)
 */
const updateProduct = asyncHandler(async (req, res, next) => {
  let product = await Product.findById(req.params.id);

  if (!product) {
    return next(new AppError('Product not found', 404));
  }

  // Make sure user is product owner or admin
  if (product.seller.toString() !== req.user.id && req.user.role !== 'admin') {
    return next(new AppError('Not authorized to update this product', 403));
  }

  // Verify category exists if being updated
  if (req.body.category) {
    const category = await Category.findById(req.body.category);
    if (!category) {
      return next(new AppError('Category not found', 404));
    }
  }

  product = await Product.findByIdAndUpdate(req.params.id, req.body, {
    new: true,
    runValidators: true
  }).populate('category', 'name slug');

  logger.info(`Product updated: ${product.title} by ${req.user.email}`);

  res.status(200).json({
    success: true,
    message: 'Product updated successfully',
    data: {
      product
    }
  });
});

/**
 * @desc    Delete product
 * @route   DELETE /api/products/:id
 * @access  Private (Admin/Seller - Own products)
 */
const deleteProduct = asyncHandler(async (req, res, next) => {
  const product = await Product.findById(req.params.id);

  if (!product) {
    return next(new AppError('Product not found', 404));
  }

  // Make sure user is product owner or admin
  if (product.seller.toString() !== req.user.id && req.user.role !== 'admin') {
    return next(new AppError('Not authorized to delete this product', 403));
  }

  await product.deleteOne();

  logger.info(`Product deleted: ${product.title} by ${req.user.email}`);

  res.status(200).json({
    success: true,
    message: 'Product deleted successfully'
  });
});

/**
 * @desc    Get products by category
 * @route   GET /api/products/category/:categoryId
 * @access  Public
 */
const getProductsByCategory = asyncHandler(async (req, res, next) => {
  const category = await Category.findById(req.params.categoryId);
  
  if (!category) {
    return next(new AppError('Category not found', 404));
  }

  const page = parseInt(req.query.page, 10) || 1;
  const limit = parseInt(req.query.limit, 10) || 20;
  const startIndex = (page - 1) * limit;

  const products = await Product.find({ 
    category: req.params.categoryId, 
    isActive: true 
  })
    .populate('category', 'name slug')
    .sort('-createdAt')
    .skip(startIndex)
    .limit(limit);

  const total = await Product.countDocuments({ 
    category: req.params.categoryId, 
    isActive: true 
  });

  res.status(200).json({
    success: true,
    count: products.length,
    total,
    category: category.name,
    data: {
      products
    }
  });
});

/**
 * @desc    Search products
 * @route   GET /api/products/search
 * @access  Public
 */
const searchProducts = asyncHandler(async (req, res, next) => {
  const { q, category, brand, minPrice, maxPrice, minRating, sortBy } = req.query;
  
  if (!q) {
    return next(new AppError('Search query is required', 400));
  }

  const options = {
    category,
    brand,
    minPrice: minPrice ? parseFloat(minPrice) : undefined,
    maxPrice: maxPrice ? parseFloat(maxPrice) : undefined,
    minRating: minRating ? parseFloat(minRating) : undefined,
    sortBy: sortBy || 'relevance',
    page: parseInt(req.query.page, 10) || 1,
    limit: parseInt(req.query.limit, 10) || 20
  };

  const products = await Product.search(q, options);
  const total = await Product.countDocuments({
    $text: { $search: q },
    isActive: true
  });

  res.status(200).json({
    success: true,
    count: products.length,
    total,
    query: q,
    data: {
      products
    }
  });
});

/**
 * @desc    Get featured products
 * @route   GET /api/products/featured
 * @access  Public
 */
const getFeaturedProducts = asyncHandler(async (req, res, next) => {
  const limit = parseInt(req.query.limit, 10) || 10;
  
  const products = await Product.findFeatured(limit);

  res.status(200).json({
    success: true,
    count: products.length,
    data: {
      products
    }
  });
});

/**
 * @desc    Get related products
 * @route   GET /api/products/:id/related
 * @access  Public
 */
const getRelatedProducts = asyncHandler(async (req, res, next) => {
  const product = await Product.findById(req.params.id);
  
  if (!product) {
    return next(new AppError('Product not found', 404));
  }

  const limit = parseInt(req.query.limit, 10) || 6;

  // Find products in same category, excluding current product
  const relatedProducts = await Product.find({
    category: product.category,
    _id: { $ne: product._id },
    isActive: true
  })
    .limit(limit)
    .select('title price thumbnail rating numReviews')
    .sort('-rating');

  res.status(200).json({
    success: true,
    count: relatedProducts.length,
    data: {
      products: relatedProducts
    }
  });
});

/**
 * @desc    Update product stock
 * @route   PUT /api/products/:id/stock
 * @access  Private (Admin/Seller - Own products)
 */
const updateProductStock = asyncHandler(async (req, res, next) => {
  const { stock, operation } = req.body;
  
  if (typeof stock !== 'number' || stock < 0) {
    return next(new AppError('Valid stock quantity is required', 400));
  }

  const product = await Product.findById(req.params.id);

  if (!product) {
    return next(new AppError('Product not found', 404));
  }

  // Make sure user is product owner or admin
  if (product.seller.toString() !== req.user.id && req.user.role !== 'admin') {
    return next(new AppError('Not authorized to update this product', 403));
  }

  if (operation === 'add') {
    product.stock += stock;
  } else if (operation === 'subtract') {
    product.stock = Math.max(0, product.stock - stock);
  } else {
    product.stock = stock;
  }

  await product.save();

  logger.info(`Product stock updated: ${product.title} by ${req.user.email}`);

  res.status(200).json({
    success: true,
    message: 'Product stock updated successfully',
    data: {
      product: {
        id: product._id,
        title: product.title,
        stock: product.stock,
        stockStatus: product.stockStatus
      }
    }
  });
});

/**
 * @desc    Get low stock products
 * @route   GET /api/products/low-stock
 * @access  Private (Admin/Seller)
 */
const getLowStockProducts = asyncHandler(async (req, res, next) => {
  let query = {};

  // If user is seller, only show their products
  if (req.user.role === 'seller') {
    query.seller = req.user.id;
  }

  const products = await Product.find({
    ...query,
    $expr: { $lte: ['$stock', '$lowStockThreshold'] },
    isActive: true
  })
    .select('title stock lowStockThreshold sku')
    .populate('seller', 'firstName lastName email');

  res.status(200).json({
    success: true,
    count: products.length,
    data: {
      products
    }
  });
});

/**
 * @desc    Get product analytics
 * @route   GET /api/products/:id/analytics
 * @access  Private (Admin/Seller - Own products)
 */
const getProductAnalytics = asyncHandler(async (req, res, next) => {
  const product = await Product.findById(req.params.id);

  if (!product) {
    return next(new AppError('Product not found', 404));
  }

  // Make sure user is product owner or admin
  if (product.seller.toString() !== req.user.id && req.user.role !== 'admin') {
    return next(new AppError('Not authorized to view analytics for this product', 403));
  }

  const analytics = {
    views: product.views,
    purchases: product.purchases,
    revenue: product.revenue,
    rating: product.rating,
    numReviews: product.numReviews,
    conversionRate: product.views > 0 ? ((product.purchases / product.views) * 100).toFixed(2) : 0,
    averageOrderValue: product.purchases > 0 ? (product.revenue / product.purchases).toFixed(2) : 0
  };

  res.status(200).json({
    success: true,
    data: {
      analytics
    }
  });
});

module.exports = {
  getProducts,
  getProduct,
  createProduct,
  updateProduct,
  deleteProduct,
  getProductsByCategory,
  searchProducts,
  getFeaturedProducts,
  getRelatedProducts,
  updateProductStock,
  getLowStockProducts,
  getProductAnalytics
};