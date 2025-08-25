#!/usr/bin/env node

require('dotenv').config();
const connectDB = require('../config/database');
const DatabaseSeeder = require('./DatabaseSeeder');
const logger = require('../config/logger');

const seeder = new DatabaseSeeder();

const runSeeder = async () => {
  try {
    // Connect to database
    await connectDB();

    const command = process.argv[2] || 'all';

    switch (command) {
      case 'all':
        await seeder.seedAll();
        break;

      case 'clear':
        await seeder.clearAll();
        logger.info('Database cleared successfully!');
        break;

      case 'users':
        await seeder.seedUsers();
        logger.info('Users seeded successfully!');
        break;

      case 'categories':
        await seeder.seedCategories();
        logger.info('Categories seeded successfully!');
        break;

      case 'products':
        await seeder.seedCategories(); // Categories needed for products
        await seeder.seedProducts();
        logger.info('Products seeded successfully!');
        break;

      default:
        logger.error(`Unknown command: ${command}`);
        logger.info('Available commands: all, clear, users, categories, products');
        process.exit(1);
    }

    logger.info('Seeding operation completed!');
    process.exit(0);

  } catch (error) {
    logger.error('Seeding operation failed:', error);
    process.exit(1);
  }
};

// Handle uncaught exceptions
process.on('uncaughtException', (err) => {
  logger.error('Uncaught Exception:', err);
  process.exit(1);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (err) => {
  logger.error('Unhandled Rejection:', err);
  process.exit(1);
});

// Run the seeder
runSeeder();