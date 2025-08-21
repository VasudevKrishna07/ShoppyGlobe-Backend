const jwt = require('jsonwebtoken');
const User = require('../models/User');
const asyncHandler = require('../utils/asyncHandler');
const AppError = require('../utils/appError');
const logger = require('../config/logger');


const protect = asyncHandler(async (req, res, next) => {
  let token;

  // Get token from header
  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith('Bearer')
  ) {
    // Set token from Bearer token in header
    token = req.headers.authorization.split(' ')[1];
  }
  // Get token from cookie
  else if (req.cookies.token) {
    token = req.cookies.token;
  }

  // Make sure token exists
  if (!token) {
    return next(new AppError('Not authorized to access this route', 401));
  }

  try {
    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Get user from token
    const user = await User.findById(decoded.id).select('+passwordChangedAt');

    if (!user) {
      return next(new AppError('No user found with this id', 401));
    }

    // Check if user is active
    if (!user.isActive) {
      return next(new AppError('Your account has been deactivated', 401));
    }

    // Check if user changed password after token was issued
    if (user.changedPasswordAfter(decoded.iat)) {
      return next(
        new AppError('User recently changed password. Please log in again', 401)
      );
    }

    // Grant access to protected route
    req.user = user;
    next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      return next(new AppError('Invalid token', 401));
    } else if (error.name === 'TokenExpiredError') {
      return next(new AppError('Token expired', 401));
    } else {
      return next(new AppError('Not authorized to access this route', 401));
    }
  }
});

/**
 * Middleware to authorize roles
 * @param {...string} roles - Allowed roles
 */
const authorize = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return next(
        new AppError(
          `User role ${req.user.role} is not authorized to access this route`,
          403
        )
      );
    }
    next();
  };
};

/**
 * Middleware to check if email is verified
 */
const requireEmailVerification = (req, res, next) => {
  if (!req.user.isEmailVerified) {
    return next(
      new AppError('Please verify your email address to access this resource', 403)
    );
  }
  next();
};

/**
 * Optional authentication middleware
 * Doesn't fail if no token is provided, but attaches user if valid token exists
 */
const optionalAuth = asyncHandler(async (req, res, next) => {
  let token;

  // Get token from header
  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith('Bearer')
  ) {
    token = req.headers.authorization.split(' ')[1];
  }
  // Get token from cookie
  else if (req.cookies.token) {
    token = req.cookies.token;
  }

  if (token) {
    try {
      // Verify token
      const decoded = jwt.verify(token, process.env.JWT_SECRET);

      // Get user from token
      const user = await User.findById(decoded.id);

      if (user && user.isActive && !user.changedPasswordAfter(decoded.iat)) {
        req.user = user;
      }
    } catch (error) {
      // Silently ignore invalid tokens in optional auth
      logger.warn('Invalid token in optional auth:', error.message);
    }
  }

  next();
});

/**
 * Middleware to check if user owns resource or is admin
 * @param {string} resourceUserField - Field name that contains user ID in the resource
 */
const checkOwnership = (resourceUserField = 'user') => {
  return asyncHandler(async (req, res, next) => {
    // Admin can access any resource
    if (req.user.role === 'admin') {
      return next();
    }

    // For other users, check ownership
    const resourceId = req.params.id;
    const Model = req.model; // Model should be set by the route handler

    if (!Model) {
      return next(new AppError('Resource model not specified', 500));
    }

    const resource = await Model.findById(resourceId);

    if (!resource) {
      return next(new AppError('Resource not found', 404));
    }

    // Check if user owns the resource
    const resourceUserId = resource[resourceUserField];
    if (resourceUserId.toString() !== req.user.id) {
      return next(
        new AppError('Not authorized to access this resource', 403)
      );
    }

    req.resource = resource;
    next();
  });
};

/**
 * Rate limiting middleware for sensitive operations
 */
const sensitiveOperationLimit = (windowMs = 15 * 60 * 1000, max = 5) => {
  const attempts = new Map();

  return (req, res, next) => {
    const key = req.user ? req.user.id : req.ip;
    const now = Date.now();
    const windowStart = now - windowMs;

    // Clean old attempts
    if (attempts.has(key)) {
      attempts.set(
        key,
        attempts.get(key).filter(timestamp => timestamp > windowStart)
      );
    }

    const userAttempts = attempts.get(key) || [];

    if (userAttempts.length >= max) {
      return next(
        new AppError(
          `Too many attempts. Please try again in ${Math.ceil(windowMs / 60000)} minutes`,
          429
        )
      );
    }

    // Add current attempt
    userAttempts.push(now);
    attempts.set(key, userAttempts);

    next();
  };
};

/**
 * Middleware to log user activity
 */
const logUserActivity = (action) => {
  return (req, res, next) => {
    const userId = req.user ? req.user.id : 'anonymous';
    const userEmail = req.user ? req.user.email : 'anonymous';
    const ip = req.ip || req.connection.remoteAddress;
    const userAgent = req.get('User-Agent') || 'unknown';

    logger.info('User Activity', {
      action,
      userId,
      userEmail,
      ip,
      userAgent,
      path: req.path,
      method: req.method,
      timestamp: new Date().toISOString()
    });

    next();
  };
};

/**
 * Middleware to check if user account is locked
 */
const checkAccountLock = asyncHandler(async (req, res, next) => {
  if (req.user.isLocked) {
    const lockTimeRemaining = Math.ceil((req.user.lockUntil - Date.now()) / 1000 / 60);
    return next(
      new AppError(
        `Account is locked. Try again in ${lockTimeRemaining} minutes`,
        423
      )
    );
  }
  next();
});

/**
 * Middleware to ensure HTTPS in production
 */
const requireHTTPS = (req, res, next) => {
  if (process.env.NODE_ENV === 'production' && !req.secure && req.get('x-forwarded-proto') !== 'https') {
    return res.redirect('https://' + req.get('host') + req.url);
  }
  next();
};

/**
 * Middleware to validate API key for external integrations
 */
const validateApiKey = asyncHandler(async (req, res, next) => {
  const apiKey = req.header('X-API-Key');

  if (!apiKey) {
    return next(new AppError('API key is required', 401));
  }

  // In a real application, you would validate against stored API keys
  const validApiKeys = process.env.VALID_API_KEYS ? process.env.VALID_API_KEYS.split(',') : [];

  if (!validApiKeys.includes(apiKey)) {
    return next(new AppError('Invalid API key', 401));
  }

  next();
});

/**
 * Middleware to check user permissions for specific resources
 */
const checkPermission = (permission) => {
  return asyncHandler(async (req, res, next) => {
    // Admin has all permissions
    if (req.user.role === 'admin') {
      return next();
    }

    // Check if user has specific permission
    if (req.user.permissions && req.user.permissions.includes(permission)) {
      return next();
    }

    return next(
      new AppError(`Permission '${permission}' required to access this resource`, 403)
    );
  });
};

module.exports = {
  protect,
  authorize,
  requireEmailVerification,
  optionalAuth,
  checkOwnership,
  sensitiveOperationLimit,
  logUserActivity,
  checkAccountLock,
  requireHTTPS,
  validateApiKey,
  checkPermission
};