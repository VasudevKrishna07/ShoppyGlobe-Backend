const multer = require('multer');
const { v2: cloudinary } = require('cloudinary');
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const path = require('path');
const fs = require('fs');
const sharp = require('sharp');
const asyncHandler = require('../utils/asyncHandler');
const AppError = require('../utils/appError');
const logger = require('../config/logger');

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});


const cloudinaryStorage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: async (req, file) => {
    // Determine folder based on file type and user
    let folder = 'shoppyglobe/misc';
    
    if (file.fieldname === 'productImages') {
      folder = 'shoppyglobe/products';
    } else if (file.fieldname === 'categoryImage') {
      folder = 'shoppyglobe/categories';
    } else if (file.fieldname === 'avatar') {
      folder = 'shoppyglobe/avatars';
    } else if (file.fieldname === 'reviewImages') {
      folder = 'shoppyglobe/reviews';
    }

    return {
      folder: folder,
      allowed_formats: ['jpg', 'jpeg', 'png', 'webp'],
      transformation: [
        { 
          width: 1200, 
          height: 1200, 
          crop: 'limit',
          quality: 'auto:best',
          format: 'webp'
        }
      ],
      public_id: `${Date.now()}-${Math.round(Math.random() * 1E9)}`
    };
  }
});

/**
 * Local Storage Configuration (fallback)
 */
const localStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    let uploadPath = 'uploads/misc';
    
    if (file.fieldname === 'productImages') {
      uploadPath = 'uploads/products';
    } else if (file.fieldname === 'categoryImage') {
      uploadPath = 'uploads/categories';
    } else if (file.fieldname === 'avatar') {
      uploadPath = 'uploads/avatars';
    } else if (file.fieldname === 'reviewImages') {
      uploadPath = 'uploads/reviews';
    }

    // Ensure directory exists
    if (!fs.existsSync(uploadPath)) {
      fs.mkdirSync(uploadPath, { recursive: true });
    }

    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

/**
 * File Filter Function
 */
const fileFilter = (req, file, cb) => {
  // Check file type
  const allowedMimes = [
    'image/jpeg',
    'image/jpg', 
    'image/png',
    'image/webp'
  ];

  if (allowedMimes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new AppError('Only image files (JPEG, JPG, PNG, WebP) are allowed', 400), false);
  }
};

/**
 * Multer Configuration
 */
const upload = multer({
  storage: process.env.CLOUDINARY_CLOUD_NAME ? cloudinaryStorage : localStorage,
  fileFilter,
  limits: {
    fileSize: parseInt(process.env.MAX_FILE_SIZE) || 5 * 1024 * 1024, // 5MB default
    files: 10 // Maximum 10 files per request
  }
});

/**
 * Upload Middleware Configurations
 */
const uploadMiddleware = {
  // Single image upload
  single: (fieldName) => upload.single(fieldName),
  
  // Multiple images upload
  multiple: (fieldName, maxCount = 5) => upload.array(fieldName, maxCount),
  
  // Mixed fields upload
  fields: (fields) => upload.fields(fields),

  // Product images upload (up to 8 images)
  productImages: upload.array('productImages', 8),

  // Category image upload
  categoryImage: upload.single('categoryImage'),

  // User avatar upload
  avatar: upload.single('avatar'),

  // Review images upload (up to 5 images)
  reviewImages: upload.array('reviewImages', 5),

  // Generic single file upload
  genericSingle: upload.single('file'),

  // Generic multiple files upload
  genericMultiple: upload.array('files', 10)
};

/**
 * @desc    Upload single image
 * @route   POST /api/upload/single
 * @access  Private
 */
const uploadSingle = asyncHandler(async (req, res, next) => {
  if (!req.file) {
    return next(new AppError('Please upload an image', 400));
  }

  const fileData = {
    fileName: req.file.filename || req.file.public_id,
    originalName: req.file.originalname,
    mimetype: req.file.mimetype,
    size: req.file.size,
    url: req.file.path || req.file.secure_url,
    public_id: req.file.public_id || null
  };

  logger.info('Single file uploaded successfully', {
    fileName: fileData.fileName,
    size: fileData.size,
    userId: req.user?.id
  });

  res.status(200).json({
    success: true,
    message: 'File uploaded successfully',
    data: {
      file: fileData
    }
  });
});

/**
 * @desc    Upload multiple images
 * @route   POST /api/upload/multiple
 * @access  Private
 */
const uploadMultiple = asyncHandler(async (req, res, next) => {
  if (!req.files || req.files.length === 0) {
    return next(new AppError('Please upload at least one image', 400));
  }

  const filesData = req.files.map(file => ({
    fileName: file.filename || file.public_id,
    originalName: file.originalname,
    mimetype: file.mimetype,
    size: file.size,
    url: file.path || file.secure_url,
    public_id: file.public_id || null
  }));

  logger.info('Multiple files uploaded successfully', {
    count: filesData.length,
    totalSize: filesData.reduce((sum, file) => sum + file.size, 0),
    userId: req.user?.id
  });

  res.status(200).json({
    success: true,
    message: `${filesData.length} files uploaded successfully`,
    data: {
      files: filesData
    }
  });
});

/**
 * @desc    Upload and optimize product images
 * @route   POST /api/upload/product-images
 * @access  Private (Admin/Seller)
 */
const uploadProductImages = asyncHandler(async (req, res, next) => {
  if (!req.files || req.files.length === 0) {
    return next(new AppError('Please upload at least one product image', 400));
  }

  const processedImages = [];

  for (const file of req.files) {
    let imageData = {
      public_id: file.public_id || file.filename,
      url: file.secure_url || file.path,
      alt: req.body.alt || `Product image`,
      isPrimary: false
    };

    // If using local storage, optimize image with Sharp
    if (!process.env.CLOUDINARY_CLOUD_NAME && file.path) {
      try {
        const optimizedPath = file.path.replace(path.extname(file.path), '-optimized.webp');
        
        await sharp(file.path)
          .resize(800, 800, { 
            fit: 'inside',
            withoutEnlargement: true 
          })
          .webp({ quality: 85 })
          .toFile(optimizedPath);

        // Delete original file
        fs.unlinkSync(file.path);
        
        imageData.url = optimizedPath;
      } catch (error) {
        logger.error('Image optimization failed:', error);
      }
    }

    processedImages.push(imageData);
  }

  // Set first image as primary
  if (processedImages.length > 0) {
    processedImages[0].isPrimary = true;
  }

  logger.info('Product images uploaded successfully', {
    count: processedImages.length,
    userId: req.user?.id
  });

  res.status(200).json({
    success: true,
    message: `${processedImages.length} product images uploaded successfully`,
    data: {
      images: processedImages
    }
  });
});

/**
 * @desc    Upload user avatar
 * @route   POST /api/upload/avatar
 * @access  Private
 */
const uploadAvatar = asyncHandler(async (req, res, next) => {
  if (!req.file) {
    return next(new AppError('Please upload an avatar image', 400));
  }

  const User = require('../models/User');

  // Delete old avatar from Cloudinary if exists
  const user = await User.findById(req.user.id);
  if (user.avatar?.public_id) {
    try {
      await cloudinary.uploader.destroy(user.avatar.public_id);
    } catch (error) {
      logger.warn('Failed to delete old avatar:', error);
    }
  }

  const avatarData = {
    public_id: req.file.public_id || req.file.filename,
    url: req.file.secure_url || req.file.path
  };

  // Update user avatar
  await User.findByIdAndUpdate(req.user.id, {
    avatar: avatarData
  });

  logger.info('Avatar uploaded successfully', {
    userId: req.user.id,
    public_id: avatarData.public_id
  });

  res.status(200).json({
    success: true,
    message: 'Avatar uploaded successfully',
    data: {
      avatar: avatarData
    }
  });
});

/**
 * @desc    Delete image from Cloudinary
 * @route   DELETE /api/upload/:public_id
 * @access  Private
 */
const deleteImage = asyncHandler(async (req, res, next) => {
  const { public_id } = req.params;

  if (!public_id) {
    return next(new AppError('Public ID is required', 400));
  }

  try {
    // Delete from Cloudinary
    const result = await cloudinary.uploader.destroy(public_id);

    if (result.result === 'ok') {
      logger.info('Image deleted successfully', {
        public_id,
        userId: req.user?.id
      });

      res.status(200).json({
        success: true,
        message: 'Image deleted successfully'
      });
    } else {
      return next(new AppError('Failed to delete image', 400));
    }
  } catch (error) {
    logger.error('Image deletion failed:', error);
    return next(new AppError('Failed to delete image', 500));
  }
});

/**
 * @desc    Get image transformation URL
 * @route   GET /api/upload/transform/:public_id
 * @access  Public
 */
const getTransformedImage = asyncHandler(async (req, res, next) => {
  const { public_id } = req.params;
  const { width, height, crop = 'fill', quality = 'auto' } = req.query;

  if (!public_id) {
    return next(new AppError('Public ID is required', 400));
  }

  try {
    const transformedUrl = cloudinary.url(public_id, {
      width: width ? parseInt(width) : undefined,
      height: height ? parseInt(height) : undefined,
      crop,
      quality,
      format: 'webp'
    });

    res.status(200).json({
      success: true,
      data: {
        transformedUrl
      }
    });
  } catch (error) {
    logger.error('Image transformation failed:', error);
    return next(new AppError('Failed to generate transformed image URL', 500));
  }
});

/**
 * @desc    Get upload statistics
 * @route   GET /api/upload/stats
 * @access  Private (Admin only)
 */
const getUploadStats = asyncHandler(async (req, res, next) => {
  try {
    // Get Cloudinary usage statistics
    const usage = await cloudinary.api.usage();

    const stats = {
      totalImages: usage.resources,
      storageUsed: usage.bytes,
      storageUsedMB: Math.round(usage.bytes / (1024 * 1024)),
      transformations: usage.transformations,
      bandwidth: usage.bandwidth,
      bandwidthMB: Math.round(usage.bandwidth / (1024 * 1024)),
      requests: usage.requests
    };

    res.status(200).json({
      success: true,
      data: {
        stats
      }
    });
  } catch (error) {
    logger.error('Failed to get upload stats:', error);
    return next(new AppError('Failed to get upload statistics', 500));
  }
});

/**
 * Image Processing Utilities
 */
const imageUtils = {
  /**
   * Generate thumbnail URL
   */
  getThumbnail: (public_id, size = 150) => {
    return cloudinary.url(public_id, {
      width: size,
      height: size,
      crop: 'fill',
      quality: 'auto',
      format: 'webp'
    });
  },

  /**
   * Generate responsive image URLs
   */
  getResponsiveUrls: (public_id) => {
    const sizes = [400, 600, 800, 1200];
    const urls = {};

    sizes.forEach(size => {
      urls[`w${size}`] = cloudinary.url(public_id, {
        width: size,
        quality: 'auto',
        format: 'webp'
      });
    });

    return urls;
  },

  /**
   * Validate image dimensions
   */
  validateDimensions: async (filePath, minWidth = 300, minHeight = 300) => {
    try {
      const metadata = await sharp(filePath).metadata();
      
      if (metadata.width < minWidth || metadata.height < minHeight) {
        throw new Error(`Image must be at least ${minWidth}x${minHeight} pixels`);
      }

      return true;
    } catch (error) {
      throw new AppError(error.message, 400);
    }
  }
};

module.exports = {
  // Middleware
  uploadMiddleware,
  
  // Controllers
  uploadSingle,
  uploadMultiple,
  uploadProductImages,
  uploadAvatar,
  deleteImage,
  getTransformedImage,
  getUploadStats,
  
  // Utilities
  imageUtils,
  
  // Cloudinary instance
  cloudinary
};