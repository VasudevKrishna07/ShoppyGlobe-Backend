const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const User = require('../models/User');
const logger = require('../config/logger');
const asyncHandler = require('../utils/asyncHandler');
const AppError = require('../utils/appError');
const Email = require('../services/emailService');

/**
 * @desc    Register a new user
 * @route   POST /api/auth/register
 * @access  Public
 */
const register = asyncHandler(async (req, res, next) => {
  const { firstName, lastName, email, password, phone, agreeToTerms } = req.body;

  // Check if user already exists
  const existingUser = await User.findByEmail(email);
  if (existingUser) {
    return next(new AppError('User already exists with this email', 400));
  }

  // Create user
  const user = await User.create({
    firstName,
    lastName,
    email,
    password,
    phone,
    agreeToTerms
  });

  // Generate email verification token
  const verificationToken = user.createEmailVerificationToken();
  await user.save({ validateBeforeSave: false });

  const verificationURL = `${req.get('origin') || process.env.CLIENT_URL}/verify-email/${verificationToken}`;

  // Send verification email
  // try {
  //   const verificationURL = `${req.get('origin') || process.env.CLIENT_URL}/verify-email/${verificationToken}`;
    
  //   await new Email(user, verificationURL).sendWelcome();
    
  //     console.log('Email would be sent to:', user.email);
  //     res.status(200).json({
  //       success: true,
  //       message: 'Password reset instructions sent to email'
  //     });
  //   logger.info(`New user registered: ${email}`);
  // } catch (error) {
  //   user.emailVerificationToken = undefined;
  //   user.emailVerificationExpires = undefined;
  //   await user.save({ validateBeforeSave: false });

  //   logger.error('Email sending failed:', error);
  //   return next(new AppError('User created but email could not be sent', 500));
  // }

  Email.sendWelcomeEmail(user, verificationURL)
    .then(() => {
      logger.info(`Verification email sent to ${email}`);
      console.log('Email would be sent to:', user.email);
    })
    .catch(async (error) => {
      // Clean up verification token on email failure
      user.emailVerificationToken = undefined;
      user.emailVerificationExpires = undefined;
      await user.save({ validateBeforeSave: false });
      
      logger.error('Email sending failed:', error);
      // Don't send response here - just log the error
    });

  // const verificationURL = `${req.get('origin')||process.env.CLIENT_URL}/verify-email/${verificationToken}`;
  //   sendVerificationEmail(user, verificationURL)
  //     .then(() => logger.info(`Verification email sent to ${email}`))
  //     .catch(err => {
  //       logger.error('Email sending failed:', err);
  //       // We do NOT send a response here
  //     });

  // Generate JWT token
  const token = user.generateAuthToken();
  const refreshToken = user.generateRefreshToken();

  // Save refresh token
  user.refreshTokens.push({ token: refreshToken });
  await user.save();

  // Set cookie options
  const cookieOptions = {
    expires: new Date(
      Date.now() + process.env.COOKIE_EXPIRE * 24 * 60 * 60 * 1000
    ),
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax'
  };

  res.cookie('refreshToken', refreshToken, cookieOptions);

  // Remove password from output
  user.password = undefined;
  user.refreshTokens = undefined;

  logger.info(`New user registered: ${email}`);

  res.status(201).json({
    success: true,
    message: 'User registered successfully. Please verify your email.',
    data: {
      token,
      user
    }
  });
});

/**
 * @desc    Login user
 * @route   POST /api/auth/login
 * @access  Public
 */
const login = asyncHandler(async (req, res, next) => {
  const { email, password } = req.body;

  // Validate email and password
  if (!email || !password) {
    return next(new AppError('Please provide email and password', 400));
  }

  // Check for user and include password in query
  const user = await User.findOne({ email: email.toLowerCase() })
    .select('+password +loginAttempts +lockUntil');

  if (!user) {
    return next(new AppError('Invalid email or password', 401));
  }

  // Check if account is locked
  if (user.isLocked) {
    return next(new AppError('Account temporarily locked due to too many failed login attempts', 423));
  }

  // Check if account is active
  if (!user.isActive) {
    return next(new AppError('Account has been deactivated', 401));
  }

  // Check if password matches
  const isPasswordMatch = await user.comparePassword(password);

  if (!isPasswordMatch) {
    // Increment login attempts
    await user.incLoginAttempts();
    logger.warn(`Failed login attempt for email: ${email}`);
    return next(new AppError('Invalid email or password', 401));
  }

  // Reset login attempts on successful login
  if (user.loginAttempts && user.loginAttempts > 0) {
    await user.resetLoginAttempts();
  }

  // Update last login
  user.lastLogin = new Date();
  await user.save();

  // Generate tokens
  const token = user.generateAuthToken();
  const refreshToken = user.generateRefreshToken();

  // Save refresh token
  user.refreshTokens.push({ token: refreshToken });
  await user.save();

  // Set cookie
  const cookieOptions = {
    expires: new Date(
      Date.now() + process.env.COOKIE_EXPIRE * 24 * 60 * 60 * 1000
    ),
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax'
  };

  res.cookie('refreshToken', refreshToken, cookieOptions);

  // Remove sensitive data from output
  user.password = undefined;
  user.refreshTokens = undefined;
  user.loginAttempts = undefined;
  user.lockUntil = undefined;

  logger.info(`User logged in: ${email}`);

  res.status(200).json({
    success: true,
    message: 'Logged in successfully',
    data: {
      token,
      user
    }
  });
});

/**
 * @desc    Logout user
 * @route   POST /api/auth/logout
 * @access  Private
 */
const logout = asyncHandler(async (req, res, next) => {
  const { refreshToken } = req.cookies;

  if (refreshToken) {
    // Remove refresh token from user's tokens array
    await User.updateOne(
      { _id: req.user.id },
      { $pull: { refreshTokens: { token: refreshToken } } }
    );
  }

  // Clear cookie
  res.cookie('refreshToken', 'none', {
    expires: new Date(Date.now() + 10 * 1000),
    httpOnly: true
  });

  logger.info(`User logged out: ${req.user.email}`);

  res.status(200).json({
    success: true,
    message: 'Logged out successfully'
  });
});

/**
 * @desc    Get current user
 * @route   GET /api/auth/me
 * @access  Private
 */
const getMe = asyncHandler(async (req, res, next) => {
  const user = await User.findById(req.user.id).populate('addresses');

  res.status(200).json({
    success: true,
    data: {
      user
    }
  });
});

/**
 * @desc    Update user details
 * @route   PUT /api/auth/me
 * @access  Private
 */
const updateMe = asyncHandler(async (req, res, next) => {
  // Create a copy of req.body
  const updates = { ...req.body };
  
  // Remove fields that shouldn't be updated via this route
  delete updates.password;
  delete updates.role;
  delete updates.isActive;
  delete updates.isEmailVerified;

  const user = await User.findByIdAndUpdate(
    req.user.id,
    updates,
    {
      new: true,
      runValidators: true
    }
  );

  res.status(200).json({
    success: true,
    message: 'Profile updated successfully',
    data: {
      user
    }
  });
});

/**
 * @desc    Update password
 * @route   PUT /api/auth/update-password
 * @access  Private
 */
const updatePassword = asyncHandler(async (req, res, next) => {
  const { currentPassword, newPassword } = req.body;

  if (!currentPassword || !newPassword) {
    return next(new AppError('Please provide current and new password', 400));
  }

  // Get user with password
  const user = await User.findById(req.user.id).select('+password');

  // Check current password
  const isCurrentPasswordCorrect = await user.comparePassword(currentPassword);
  if (!isCurrentPasswordCorrect) {
    return next(new AppError('Current password is incorrect', 400));
  }

  // Update password
  user.password = newPassword;
  await user.save();

  // Invalidate all refresh tokens
  user.refreshTokens = [];
  await user.save();

  logger.info(`Password updated for user: ${user.email}`);

  res.status(200).json({
    success: true,
    message: 'Password updated successfully'
  });
});

/**
 * @desc    Forgot password
 * @route   POST /api/auth/forgot-password
 * @access  Public
 */
const forgotPassword = asyncHandler(async (req, res, next) => {
  const { email } = req.body;

  if (!email) {
    return next(new AppError('Please provide email address', 400));
  }

  const user = await User.findByEmail(email);
  if (!user) {
    return next(new AppError('No user found with this email address', 404));
  }

  // Generate reset token
  const resetToken = user.createPasswordResetToken();
  await user.save({ validateBeforeSave: false });

  try {
    const resetURL = `${req.get('origin') || process.env.CLIENT_URL}/reset-password/${resetToken}`;
    
    await new Email(user, resetURL).sendPasswordReset();

    logger.info(`Password reset email sent to: ${email}`);

    res.status(200).json({
      success: true,
      message: 'Password reset email sent successfully'
    });
  } catch (error) {
    user.passwordResetToken = undefined;
    user.passwordResetExpires = undefined;
    await user.save({ validateBeforeSave: false });

    logger.error('Password reset email failed:', error);
    return next(new AppError('Email could not be sent', 500));
  }
});

/**
 * @desc    Reset password
 * @route   PUT /api/auth/reset-password/:token
 * @access  Public
 */
const resetPassword = asyncHandler(async (req, res, next) => {
  // Get hashed token
  const hashedToken = crypto
    .createHash('sha256')
    .update(req.params.token)
    .digest('hex');

  const user = await User.findOne({
    passwordResetToken: hashedToken,
    passwordResetExpires: { $gt: Date.now() }
  });

  if (!user) {
    return next(new AppError('Password reset token is invalid or has expired', 400));
  }

  // Set new password
  user.password = req.body.password;
  user.passwordResetToken = undefined;
  user.passwordResetExpires = undefined;
  user.refreshTokens = []; // Invalidate all refresh tokens
  
  await user.save();

  logger.info(`Password reset successful for user: ${user.email}`);

  res.status(200).json({
    success: true,
    message: 'Password reset successful'
  });
});

/**
 * @desc    Verify email
 * @route   GET /api/auth/verify-email/:token
 * @access  Public
 */
const verifyEmail = asyncHandler(async (req, res, next) => {
  // Get hashed token
  const hashedToken = crypto
    .createHash('sha256')
    .update(req.params.token)
    .digest('hex');

  const user = await User.findOne({
    emailVerificationToken: hashedToken,
    emailVerificationExpires: { $gt: Date.now() }
  });

  if (!user) {
    return next(new AppError('Email verification token is invalid or has expired', 400));
  }

  // Update user
  user.isEmailVerified = true;
  user.emailVerificationToken = undefined;
  user.emailVerificationExpires = undefined;
  
  await user.save();

  logger.info(`Email verified for user: ${user.email}`);

  res.status(200).json({
    success: true,
    message: 'Email verified successfully'
  });
});

/**
 * @desc    Resend email verification
 * @route   POST /api/auth/resend-verification
 * @access  Private
 */
const resendEmailVerification = asyncHandler(async (req, res, next) => {
  const user = await User.findById(req.user.id);

  if (user.isEmailVerified) {
    return next(new AppError('Email is already verified', 400));
  }

  // Generate new verification token
  const verificationToken = user.createEmailVerificationToken();
  await user.save({ validateBeforeSave: false });

  try {
    const verificationURL = `${req.get('origin') || process.env.CLIENT_URL}/verify-email/${verificationToken}`;
    
    await new Email(user, verificationURL).sendEmailVerification();

    logger.info(`Verification email resent to: ${user.email}`);

    res.status(200).json({
      success: true,
      message: 'Verification email sent successfully'
    });
  } catch (error) {
    user.emailVerificationToken = undefined;
    user.emailVerificationExpires = undefined;
    await user.save({ validateBeforeSave: false });

    logger.error('Verification email failed:', error);
    return next(new AppError('Email could not be sent', 500));
  }
});

/**
 * @desc    Refresh token
 * @route   POST /api/auth/refresh-token
 * @access  Public
 */
const refreshToken = asyncHandler(async (req, res, next) => {
  const { refreshToken } = req.cookies;

  if (!refreshToken) {
    return next(new AppError('No refresh token provided', 401));
  }

  // Verify refresh token
  let decoded;
  try {
    decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);
  } catch (error) {
    return next(new AppError('Invalid refresh token', 401));
  }

  // Find user and check if refresh token exists
  const user = await User.findById(decoded.id);
  if (!user) {
    return next(new AppError('User no longer exists', 401));
  }

  const tokenExists = user.refreshTokens.some(token => token.token === refreshToken);
  if (!tokenExists) {
    return next(new AppError('Invalid refresh token', 401));
  }

  // Generate new tokens
  const newToken = user.generateAuthToken();
  const newRefreshToken = user.generateRefreshToken();

  // Remove old refresh token and add new one
  user.refreshTokens = user.refreshTokens.filter(token => token.token !== refreshToken);
  user.refreshTokens.push({ token: newRefreshToken });
  await user.save();

  // Set new cookie
  const cookieOptions = {
    expires: new Date(
      Date.now() + process.env.COOKIE_EXPIRE * 24 * 60 * 60 * 1000
    ),
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax'
  };

  res.cookie('refreshToken', newRefreshToken, cookieOptions);

  res.status(200).json({
    success: true,
    message: 'Token refreshed successfully',
    data: {
      token: newToken
    }
  });
});

module.exports = {
  register,
  login,
  logout,
  getMe,
  updateMe,
  updatePassword,
  forgotPassword,
  resetPassword,
  verifyEmail,
  resendEmailVerification,
  refreshToken
};