const mongoose = require('mongoose');
const logger = require('./logger');

/**
 * Connect to MongoDB Database
 */
const connectDB = async () => {
  try {
    // DEBUG: Check environment variables
    console.log('NODE_ENV:', process.env.NODE_ENV);
    console.log('MONGODB_URI:', process.env.MONGODB_URI);
    console.log('MONGODB_URI_PROD:', process.env.MONGODB_URI_PROD);
    
    const mongoURI = process.env.NODE_ENV === 'production' 
      ? process.env.MONGODB_URI_PROD 
      : process.env.MONGODB_URI;
      
    console.log('Selected mongoURI:', mongoURI);

    if (!mongoURI) {
      throw new Error('MongoDB URI is not defined in environment variables');
    }

    // Updated connection options (removed deprecated ones)
    const options = {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      maxPoolSize: 10, // Maintain up to 10 socket connections
      serverSelectionTimeoutMS: 5000, // Keep trying to send operations for 5 seconds
      socketTimeoutMS: 45000, // Close sockets after 45 seconds of inactivity
      // Removed deprecated options:
      // bufferMaxEntries: 0, // DEPRECATED - not supported
      // bufferCommands: false, // DEPRECATED - not supported
    };

    const conn = await mongoose.connect(mongoURI, options);

    console.log('✅ MongoDB Connected Successfully!');
    logger.info(`MongoDB Connected: ${conn.connection.host}:${conn.connection.port}/${conn.connection.name}`);

    // Handle connection events
    mongoose.connection.on('error', (err) => {
      logger.error('MongoDB connection error:', err);
    });

    mongoose.connection.on('disconnected', () => {
      logger.warn('MongoDB disconnected');
    });

    mongoose.connection.on('reconnected', () => {
      logger.info('MongoDB reconnected');
    });

    // Handle process termination
    process.on('SIGINT', async () => {
      try {
        await mongoose.connection.close();
        logger.info('MongoDB connection closed through app termination');
        process.exit(0);
      } catch (err) {
        logger.error('Error closing MongoDB connection:', err);
        process.exit(1);
      }
    });

  } catch (error) {
    console.error('Database connection failed - Full error:', error);
    logger.error('Database connection failed:', error.message);
    process.exit(1);
  }
};

module.exports = connectDB;