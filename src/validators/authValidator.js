const Joi = require('joi');

/**
 * Validation middleware factory
 * @param {Object} schema - Joi validation schema
 * @param {string} property - Request property to validate (body, query, params)
 */
const validate = (schema, property = 'body') => {
  return (req, res, next) => {
    const { error, value } = schema.validate(req[property], {
      abortEarly: false,
      allowUnknown: false,
      stripUnknown: true
    });

    if (error) {
      const errors = error.details.map(detail => ({
        field: detail.path.join('.'),
        message: detail.message,
        value: detail.context.value
      }));

      return res.status(400).json({
        success: false,
        message: 'Validation error',
        errors
      });
    }

    // Replace request data with validated and sanitized data
    req[property] = value;
    next();
  };
};

// Common validation schemas
const commonSchemas = {
  objectId: Joi.string().regex(/^[0-9a-fA-F]{24}$/).message('Invalid ObjectId format'),
  email: Joi.string().email().lowercase().trim(),
  password: Joi.string().min(8).max(128).pattern(
    new RegExp('^(?=.*[a-z])(?=.*[A-Z])(?=.*\\d)(?=.*[@$!%*?&])[A-Za-z\\d@$!%*?&]')
  ).message('Password must contain at least 8 characters with uppercase, lowercase, number and special character'),
  phone: Joi.string().pattern(/^[\+]?[1-9][\d]{0,15}$/).message('Invalid phone number format'),
  name: Joi.string().trim().min(1).max(50).pattern(/^[a-zA-Z\s]+$/).message('Name can only contain letters and spaces'),
  price: Joi.number().min(0).precision(2),
  rating: Joi.number().min(0).max(5),
  url: Joi.string().uri(),
  slug: Joi.string().lowercase().pattern(/^[a-z0-9-]+$/).message('Slug can only contain lowercase letters, numbers and hyphens')
};

// Auth validation schemas
const authSchemas = {
  register: Joi.object({
    firstName: commonSchemas.name.required(),
    lastName: commonSchemas.name.required(),
    email: commonSchemas.email.required(),
    password: commonSchemas.password.required(),
    phone: commonSchemas.phone.optional(),
    agreeToTerms: Joi.boolean().valid(true).required().messages({
      'any.only': 'You must agree to the terms and conditions'
    })
  }),

  login: Joi.object({
    email: commonSchemas.email.required(),
    password: Joi.string().required(),
    rememberMe: Joi.boolean().optional()
  }),

  forgotPassword: Joi.object({
    email: commonSchemas.email.required()
  }),

  resetPassword: Joi.object({
    password: commonSchemas.password.required(),
    confirmPassword: Joi.string().valid(Joi.ref('password')).required().messages({
      'any.only': 'Passwords do not match'
    })
  }),

  updatePassword: Joi.object({
    currentPassword: Joi.string().required(),
    newPassword: commonSchemas.password.required(),
    confirmPassword: Joi.string().valid(Joi.ref('newPassword')).required().messages({
      'any.only': 'Passwords do not match'
    })
  }),

  updateProfile: Joi.object({
    firstName: commonSchemas.name.optional(),
    lastName: commonSchemas.name.optional(),
    phone: commonSchemas.phone.optional(),
    preferences: Joi.object({
      newsletter: Joi.boolean().optional(),
      notifications: Joi.boolean().optional(),
      theme: Joi.string().valid('light', 'dark').optional(),
      language: Joi.string().min(2).max(5).optional(),
      currency: Joi.string().length(3).uppercase().optional()
    }).optional()
  })
};

// Product validation schemas
const productSchemas = {
  create: Joi.object({
    title: Joi.string().trim().min(1).max(200).required(),
    description: Joi.string().trim().min(10).max(2000).required(),
    shortDescription: Joi.string().trim().max(500).optional(),
    price: commonSchemas.price.required(),
    originalPrice: commonSchemas.price.optional(),
    discountPercentage: Joi.number().min(0).max(100).optional(),
    category: commonSchemas.objectId.required(),
    subcategory: Joi.string().trim().max(100).optional(),
    brand: Joi.string().trim().max(100).optional(),
    sku: Joi.string().trim().uppercase().optional(),
    barcode: Joi.string().trim().optional(),
    stock: Joi.number().integer().min(0).required(),
    lowStockThreshold: Joi.number().integer().min(0).optional(),
    isActive: Joi.boolean().optional(),
    isFeatured: Joi.boolean().optional(),
    isDigital: Joi.boolean().optional(),
    tags: Joi.array().items(Joi.string().trim().lowercase().max(50)).max(10).optional(),
    specifications: Joi.object().pattern(
      Joi.string(),
      Joi.string().max(500)
    ).optional(),
    dimensions: Joi.object({
      length: Joi.number().min(0).optional(),
      width: Joi.number().min(0).optional(),
      height: Joi.number().min(0).optional(),
      weight: Joi.number().min(0).optional(),
      unit: Joi.string().valid('cm', 'inch', 'mm').optional(),
      weightUnit: Joi.string().valid('kg', 'g', 'lb', 'oz').optional()
    }).optional(),
    shipping: Joi.object({
      free: Joi.boolean().optional(),
      cost: Joi.number().min(0).optional(),
      estimatedDays: Joi.number().integer().min(1).max(365).optional(),
      weight: Joi.number().min(0).optional()
    }).optional(),
    seo: Joi.object({
      metaTitle: Joi.string().max(60).optional(),
      metaDescription: Joi.string().max(160).optional(),
      metaKeywords: Joi.array().items(Joi.string().trim().lowercase().max(50)).max(10).optional()
    }).optional()
  }),

  update: Joi.object({
    title: Joi.string().trim().min(1).max(200).optional(),
    description: Joi.string().trim().min(10).max(2000).optional(),
    shortDescription: Joi.string().trim().max(500).optional(),
    price: commonSchemas.price.optional(),
    originalPrice: commonSchemas.price.optional(),
    discountPercentage: Joi.number().min(0).max(100).optional(),
    category: commonSchemas.objectId.optional(),
    subcategory: Joi.string().trim().max(100).optional(),
    brand: Joi.string().trim().max(100).optional(),
    stock: Joi.number().integer().min(0).optional(),
    lowStockThreshold: Joi.number().integer().min(0).optional(),
    isActive: Joi.boolean().optional(),
    isFeatured: Joi.boolean().optional(),
    tags: Joi.array().items(Joi.string().trim().lowercase().max(50)).max(10).optional(),
    specifications: Joi.object().pattern(
      Joi.string(),
      Joi.string().max(500)
    ).optional(),
    dimensions: Joi.object({
      length: Joi.number().min(0).optional(),
      width: Joi.number().min(0).optional(),
      height: Joi.number().min(0).optional(),
      weight: Joi.number().min(0).optional(),
      unit: Joi.string().valid('cm', 'inch', 'mm').optional(),
      weightUnit: Joi.string().valid('kg', 'g', 'lb', 'oz').optional()
    }).optional(),
    shipping: Joi.object({
      free: Joi.boolean().optional(),
      cost: Joi.number().min(0).optional(),
      estimatedDays: Joi.number().integer().min(1).max(365).optional(),
      weight: Joi.number().min(0).optional()
    }).optional(),
    seo: Joi.object({
      metaTitle: Joi.string().max(60).optional(),
      metaDescription: Joi.string().max(160).optional(),
      metaKeywords: Joi.array().items(Joi.string().trim().lowercase().max(50)).max(10).optional()
    }).optional()
  }),

  stockUpdate: Joi.object({
    stock: Joi.number().integer().min(0).required(),
    operation: Joi.string().valid('set', 'add', 'subtract').default('set')
  }),

  query: Joi.object({
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(100).default(20),
    sort: Joi.string().optional(),
    fields: Joi.string().optional(),
    search: Joi.string().trim().min(1).max(100).optional(),
    category: Joi.string().optional(),
    brand: Joi.string().optional(),
    minPrice: Joi.number().min(0).optional(),
    maxPrice: Joi.number().min(0).optional(),
    minRating: commonSchemas.rating.optional(),
    inStock: Joi.boolean().optional(),
    featured: Joi.boolean().optional()
  })
};

// Category validation schemas
const categorySchemas = {
  create: Joi.object({
    name: Joi.string().trim().min(1).max(100).required(),
    description: Joi.string().trim().max(500).optional(),
    parent: commonSchemas.objectId.optional(),
    isActive: Joi.boolean().optional(),
    sortOrder: Joi.number().integer().optional(),
    metaTitle: Joi.string().max(60).optional(),
    metaDescription: Joi.string().max(160).optional(),
    metaKeywords: Joi.array().items(Joi.string().trim().lowercase().max(50)).max(10).optional()
  }),

  update: Joi.object({
    name: Joi.string().trim().min(1).max(100).optional(),
    description: Joi.string().trim().max(500).optional(),
    parent: commonSchemas.objectId.allow(null).optional(),
    isActive: Joi.boolean().optional(),
    sortOrder: Joi.number().integer().optional(),
    metaTitle: Joi.string().max(60).optional(),
    metaDescription: Joi.string().max(160).optional(),
    metaKeywords: Joi.array().items(Joi.string().trim().lowercase().max(50)).max(10).optional()
  })
};

// Cart validation schemas
const cartSchemas = {
  addItem: Joi.object({
    productId: commonSchemas.objectId.required(),
    quantity: Joi.number().integer().min(1).max(99).required(),
    variants: Joi.array().items(
      Joi.object({
        name: Joi.string().required(),
        value: Joi.string().required(),
        price: Joi.number().min(0).optional()
      })
    ).optional()
  }),

  updateItem: Joi.object({
    quantity: Joi.number().integer().min(1).max(99).required()
  })
};

// Order validation schemas
const orderSchemas = {
  create: Joi.object({
    shippingAddress: Joi.object({
      firstName: commonSchemas.name.required(),
      lastName: commonSchemas.name.required(),
      street: Joi.string().trim().min(1).max(200).required(),
      apartment: Joi.string().trim().max(100).optional(),
      city: Joi.string().trim().min(1).max(100).required(),
      state: Joi.string().trim().min(1).max(100).required(),
      zipCode: Joi.string().trim().min(3).max(20).required(),
      country: Joi.string().trim().min(1).max(100).required(),
      phone: commonSchemas.phone.optional()
    }).required(),
    paymentMethod: Joi.string().valid('stripe', 'paypal', 'cod').required(),
    notes: Joi.string().trim().max(500).optional()
  }),

  updateStatus: Joi.object({
    status: Joi.string().valid(
      'pending',
      'confirmed',
      'processing',
      'shipped',
      'delivered',
      'cancelled',
      'refunded'
    ).required(),
    notes: Joi.string().trim().max(500).optional()
  })
};

// Review validation schemas
const reviewSchemas = {
  create: Joi.object({
    product: commonSchemas.objectId.required(),
    rating: Joi.number().integer().min(1).max(5).required(),
    title: Joi.string().trim().min(1).max(100).required(),
    comment: Joi.string().trim().min(10).max(1000).required(),
    recommend: Joi.boolean().optional()
  }),

  update: Joi.object({
    rating: Joi.number().integer().min(1).max(5).optional(),
    title: Joi.string().trim().min(1).max(100).optional(),
    comment: Joi.string().trim().min(10).max(1000).optional(),
    recommend: Joi.boolean().optional()
  })
};

// Address validation schemas
const addressSchemas = {
  create: Joi.object({
    type: Joi.string().valid('home', 'work', 'other').default('home'),
    firstName: commonSchemas.name.required(),
    lastName: commonSchemas.name.required(),
    street: Joi.string().trim().min(1).max(200).required(),
    apartment: Joi.string().trim().max(100).optional(),
    city: Joi.string().trim().min(1).max(100).required(),
    state: Joi.string().trim().min(1).max(100).required(),
    zipCode: Joi.string().trim().min(3).max(20).required(),
    country: Joi.string().trim().min(1).max(100).required(),
    phone: commonSchemas.phone.optional(),
    isDefault: Joi.boolean().optional()
  }),

  update: Joi.object({
    type: Joi.string().valid('home', 'work', 'other').optional(),
    firstName: commonSchemas.name.optional(),
    lastName: commonSchemas.name.optional(),
    street: Joi.string().trim().min(1).max(200).optional(),
    apartment: Joi.string().trim().max(100).optional(),
    city: Joi.string().trim().min(1).max(100).optional(),
    state: Joi.string().trim().min(1).max(100).optional(),
    zipCode: Joi.string().trim().min(3).max(20).optional(),
    country: Joi.string().trim().min(1).max(100).optional(),
    phone: commonSchemas.phone.optional(),
    isDefault: Joi.boolean().optional()
  })
};

// Create validation middleware functions
const validateRegister = validate(authSchemas.register);
const validateLogin = validate(authSchemas.login);
const validateForgotPassword = validate(authSchemas.forgotPassword);
const validateResetPassword = validate(authSchemas.resetPassword);
const validateUpdatePassword = validate(authSchemas.updatePassword);
const validateUpdateProfile = validate(authSchemas.updateProfile);

const validateCreateProduct = validate(productSchemas.create);
const validateUpdateProduct = validate(productSchemas.update);
const validateProductStockUpdate = validate(productSchemas.stockUpdate);
const validateProductQuery = validate(productSchemas.query, 'query');

const validateCreateCategory = validate(categorySchemas.create);
const validateUpdateCategory = validate(categorySchemas.update);

const validateAddToCart = validate(cartSchemas.addItem);
const validateUpdateCartItem = validate(cartSchemas.updateItem);

const validateCreateOrder = validate(orderSchemas.create);
const validateUpdateOrderStatus = validate(orderSchemas.updateStatus);

const validateCreateReview = validate(reviewSchemas.create);
const validateUpdateReview = validate(reviewSchemas.update);

const validateCreateAddress = validate(addressSchemas.create);
const validateUpdateAddress = validate(addressSchemas.update);

// Param validation
const validateObjectId = validate(
  Joi.object({
    id: commonSchemas.objectId.required()
  }),
  'params'
);

module.exports = {
  // Validation middleware
  validate,
  
  // Auth validations
  validateRegister,
  validateLogin,
  validateForgotPassword,
  validateResetPassword,
  validateUpdatePassword,
  validateUpdateProfile,
  
  // Product validations
  validateCreateProduct,
  validateUpdateProduct,
  validateProductStockUpdate,
  validateProductQuery,
  
  // Category validations
  validateCreateCategory,
  validateUpdateCategory,
  
  // Cart validations
  validateAddToCart,
  validateUpdateCartItem,
  
  // Order validations
  validateCreateOrder,
  validateUpdateOrderStatus,
  
  // Review validations
  validateCreateReview,
  validateUpdateReview,
  
  // Address validations
  validateCreateAddress,
  validateUpdateAddress,
  
  // Param validations
  validateObjectId,
  
  // Common schemas for reuse
  commonSchemas
};