const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const Category = require('../models/Category');
const Product = require('../models/Product');
const logger = require('../config/logger');

/**
 * Database Seeder
 * Seeds the database with initial data for development and testing
 */
class DatabaseSeeder {
  constructor() {
    this.users = [];
    this.categories = [];
    this.products = [];
  }

  /**
   * Run all seeders
   */
  async seedAll() {
    try {
      logger.info('Starting database seeding...');

      // Check if data already exists
      const userCount = await User.countDocuments();
      if (userCount > 0) {
        logger.info('Database already contains data. Skipping seeding.');
        return;
      }

      await this.seedUsers();
      await this.seedCategories();
      await this.seedProducts();

      logger.info('Database seeding completed successfully!');
      logger.info(`Seeded: ${this.users.length} users, ${this.categories.length} categories, ${this.products.length} products`);

    } catch (error) {
      logger.error('Database seeding failed:', error);
      throw error;
    }
  }

  /**
   * Seed users
   */
  async seedUsers() {
    const userData = [
      {
        firstName: 'Admin',
        lastName: 'User',
        email: process.env.ADMIN_EMAIL || 'admin@shoppyglobe.com',
        password: process.env.ADMIN_PASSWORD || 'Admin@123456',
        role: 'admin',
        isActive: true,
        isEmailVerified: true,
        phone: '+919876543210',
        addresses: [{
          type: 'work',
          firstName: 'Admin',
          lastName: 'User',
          street: '123 Admin Street',
          city: 'Mumbai',
          state: 'Maharashtra',
          zipCode: '400001',
          country: 'India',
          phone: '+919876543210',
          isDefault: true
        }]
      },
      {
        firstName: 'John',
        lastName: 'Seller',
        email: 'seller@shoppyglobe.com',
        password: 'Seller@123456',
        role: 'seller',
        isActive: true,
        isEmailVerified: true,
        phone: '+919876543211',
        addresses: [{
          type: 'work',
          firstName: 'John',
          lastName: 'Seller',
          street: '456 Seller Avenue',
          city: 'Delhi',
          state: 'Delhi',
          zipCode: '110001',
          country: 'India',
          phone: '+919876543211',
          isDefault: true
        }]
      },
      {
        firstName: 'Jane',
        lastName: 'Customer',
        email: 'customer@shoppyglobe.com',
        password: 'Customer@123456',
        role: 'user',
        isActive: true,
        isEmailVerified: true,
        phone: '+919876543212',
        addresses: [{
          type: 'home',
          firstName: 'Jane',
          lastName: 'Customer',
          street: '789 Customer Road',
          city: 'Bangalore',
          state: 'Karnataka',
          zipCode: '560001',
          country: 'India',
          phone: '+919876543212',
          isDefault: true
        }]
      }
    ];

    logger.info('Seeding users...');
    this.users = await User.create(userData);
    logger.info(`✅ ${this.users.length} users created`);
  }

  /**
   * Seed categories
   */
  async seedCategories() {
    const categoriesData = [
      {
        name: 'Electronics',
        description: 'Electronic devices, gadgets, and accessories',
        metaTitle: 'Electronics - Latest Gadgets & Devices',
        metaDescription: 'Shop the latest electronic devices, smartphones, laptops, and accessories at ShoppyGlobe',
        metaKeywords: ['electronics', 'gadgets', 'smartphones', 'laptops'],
        sortOrder: 1
      },
      {
        name: 'Clothing',
        description: 'Fashion clothing for men, women, and kids',
        metaTitle: 'Clothing - Fashion & Apparel',
        metaDescription: 'Discover trendy clothing, fashion apparel, and accessories for all ages',
        metaKeywords: ['clothing', 'fashion', 'apparel', 'shirts', 'dresses'],
        sortOrder: 2
      },
      {
        name: 'Home & Kitchen',
        description: 'Home decor, kitchen appliances, and household items',
        metaTitle: 'Home & Kitchen - Decor & Appliances',
        metaDescription: 'Transform your home with our collection of decor items and kitchen appliances',
        metaKeywords: ['home', 'kitchen', 'decor', 'appliances', 'furniture'],
        sortOrder: 3
      },
      {
        name: 'Books',
        description: 'Books, eBooks, and educational materials',
        metaTitle: 'Books - Literature & Educational Materials',
        metaDescription: 'Explore our vast collection of books, novels, and educational materials',
        metaKeywords: ['books', 'novels', 'education', 'literature', 'ebooks'],
        sortOrder: 4
      },
      {
        name: 'Sports & Outdoors',
        description: 'Sports equipment, outdoor gear, and fitness accessories',
        metaTitle: 'Sports & Outdoors - Equipment & Gear',
        metaDescription: 'Find sports equipment, outdoor gear, and fitness accessories for active lifestyle',
        metaKeywords: ['sports', 'outdoors', 'fitness', 'equipment', 'gear'],
        sortOrder: 5
      },
      {
        name: 'Beauty & Personal Care',
        description: 'Cosmetics, skincare, and personal care products',
        metaTitle: 'Beauty & Personal Care - Cosmetics & Skincare',
        metaDescription: 'Discover premium beauty products, cosmetics, and personal care items',
        metaKeywords: ['beauty', 'cosmetics', 'skincare', 'personal care', 'makeup'],
        sortOrder: 6
      }
    ];

    // Create subcategories
    logger.info('Seeding categories...');
    this.categories = await Category.create(categoriesData);

    // Create subcategories for Electronics
    const electronicsSubcategories = [
      { name: 'Smartphones', parent: this.categories[0]._id, sortOrder: 1 },
      { name: 'Laptops', parent: this.categories[0]._id, sortOrder: 2 },
      { name: 'Headphones', parent: this.categories[0]._id, sortOrder: 3 },
      { name: 'Cameras', parent: this.categories[0]._id, sortOrder: 4 }
    ];

    // Create subcategories for Clothing
    const clothingSubcategories = [
      { name: 'Men\'s Clothing', parent: this.categories[1]._id, sortOrder: 1 },
      { name: 'Women\'s Clothing', parent: this.categories[1]._id, sortOrder: 2 },
      { name: 'Kids\' Clothing', parent: this.categories[1]._id, sortOrder: 3 },
      { name: 'Accessories', parent: this.categories[1]._id, sortOrder: 4 }
    ];

    const subcategories = await Category.create([
      ...electronicsSubcategories,
      ...clothingSubcategories
    ]);

    this.categories = [...this.categories, ...subcategories];
    logger.info(`✅ ${this.categories.length} categories created`);
  }

  /**
   * Seed products
   */
  async seedProducts() {
    const sellerUser = this.users.find(user => user.role === 'seller');
    const electronicsCategory = this.categories.find(cat => cat.name === 'Electronics');
    const clothingCategory = this.categories.find(cat => cat.name === 'Clothing');
    const homeCategory = this.categories.find(cat => cat.name === 'Home & Kitchen');
    const booksCategory = this.categories.find(cat => cat.name === 'Books');
    const sportsCategory = this.categories.find(cat => cat.name === 'Sports & Outdoors');
    const beautyCategory = this.categories.find(cat => cat.name === 'Beauty & Personal Care');

    const productsData = [
      // Electronics
      {
        title: 'iPhone 15 Pro',
        description: 'Latest iPhone with advanced features, A17 Pro chip, and Pro camera system',
        shortDescription: 'Apple iPhone 15 Pro with titanium design',
        price: 134900,
        originalPrice: 139900,
        discountPercentage: 4,
        category: electronicsCategory._id,
        brand: 'Apple',
        sku: 'APL-IP15P-256',
        stock: 25,
        lowStockThreshold: 5,
        isFeatured: true,
        thumbnail: 'https://images.unsplash.com/photo-1592750475338-74b7b21085ab?w=500',
        images: [
          { 
            public_id: 'iphone15pro_1', 
            url: 'https://images.unsplash.com/photo-1592750475338-74b7b21085ab?w=500',
            isPrimary: true 
          }
        ],
        tags: ['smartphone', 'apple', 'ios', 'pro', 'camera'],
        specifications: new Map([
          ['Display', '6.1-inch Super Retina XDR'],
          ['Chip', 'A17 Pro'],
          ['Storage', '256GB'],
          ['Camera', 'Pro camera system'],
          ['Battery', 'Up to 23 hours video playback']
        ]),
        rating: 4.8,
        numReviews: 127,
        seller: sellerUser._id
      },
      {
        title: 'MacBook Pro 16-inch',
        description: 'Powerful laptop with M3 Pro chip, perfect for professional work and creative tasks',
        shortDescription: 'MacBook Pro with M3 Pro chip',
        price: 249900,
        category: electronicsCategory._id,
        brand: 'Apple',
        sku: 'APL-MBP16-512',
        stock: 15,
        isFeatured: true,
        thumbnail: 'https://images.unsplash.com/photo-1517336714731-489689fd1ca8?w=500',
        images: [
          { 
            public_id: 'macbookpro_1', 
            url: 'https://images.unsplash.com/photo-1517336714731-489689fd1ca8?w=500',
            isPrimary: true 
          }
        ],
        tags: ['laptop', 'apple', 'macbook', 'professional', 'm3'],
        specifications: new Map([
          ['Display', '16.2-inch Liquid Retina XDR'],
          ['Chip', 'M3 Pro'],
          ['Memory', '18GB unified memory'],
          ['Storage', '512GB SSD'],
          ['Battery', 'Up to 22 hours']
        ]),
        rating: 4.9,
        numReviews: 89,
        seller: sellerUser._id
      },

      // Clothing
      {
        title: 'Cotton Casual T-Shirt',
        description: 'Comfortable cotton t-shirt perfect for casual wear. Available in multiple colors.',
        shortDescription: '100% cotton casual t-shirt',
        price: 799,
        originalPrice: 999,
        discountPercentage: 20,
        category: clothingCategory._id,
        brand: 'FashionHub',
        sku: 'FH-TSHIRT-001',
        stock: 100,
        thumbnail: 'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=500',
        images: [
          { 
            public_id: 'tshirt_1', 
            url: 'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=500',
            isPrimary: true 
          }
        ],
        tags: ['tshirt', 'cotton', 'casual', 'comfortable'],
        variants: [
          {
            name: 'Size',
            options: [
              { value: 'S', stock: 25 },
              { value: 'M', stock: 30 },
              { value: 'L', stock: 25 },
              { value: 'XL', stock: 20 }
            ]
          },
          {
            name: 'Color',
            options: [
              { value: 'Black', stock: 40 },
              { value: 'White', stock: 30 },
              { value: 'Navy', stock: 30 }
            ]
          }
        ],
        rating: 4.3,
        numReviews: 56,
        seller: sellerUser._id
      },

      // Home & Kitchen
      {
        title: 'Non-Stick Cookware Set',
        description: '5-piece non-stick cookware set perfect for everyday cooking. Includes frying pans and saucepans.',
        shortDescription: 'Professional non-stick cookware set',
        price: 2999,
        originalPrice: 3999,
        discountPercentage: 25,
        category: homeCategory._id,
        brand: 'KitchenPro',
        sku: 'KP-COOKSET-001',
        stock: 40,
        isFeatured: true,
        thumbnail: 'https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?w=500',
        images: [
          { 
            public_id: 'cookware_1', 
            url: 'https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?w=500',
            isPrimary: true 
          }
        ],
        tags: ['cookware', 'kitchen', 'non-stick', 'cooking'],
        specifications: new Map([
          ['Material', 'Aluminum with non-stick coating'],
          ['Set Includes', '2 Frying Pans, 2 Saucepans, 1 Stock Pot'],
          ['Dishwasher Safe', 'Yes'],
          ['Oven Safe', 'Up to 350°F']
        ]),
        rating: 4.5,
        numReviews: 78,
        seller: sellerUser._id
      },

      // Books
      {
        title: 'The Psychology of Programming',
        description: 'Classic book on software development psychology and best practices for programmers.',
        shortDescription: 'Essential reading for developers',
        price: 1299,
        category: booksCategory._id,
        brand: 'TechBooks',
        sku: 'TB-PSYCHPROG-001',
        stock: 50,
        isDigital: false,
        thumbnail: 'https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?w=500',
        images: [
          { 
            public_id: 'book_1', 
            url: 'https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?w=500',
            isPrimary: true 
          }
        ],
        tags: ['programming', 'psychology', 'development', 'technical'],
        specifications: new Map([
          ['Author', 'Gerald M. Weinberg'],
          ['Pages', '352'],
          ['Language', 'English'],
          ['Publisher', 'Dorset House'],
          ['Edition', '2nd Edition']
        ]),
        rating: 4.7,
        numReviews: 34,
        seller: sellerUser._id
      },

      // Sports & Outdoors
      {
        title: 'Yoga Mat Premium',
        description: 'High-quality yoga mat with excellent grip and cushioning. Perfect for all types of yoga practice.',
        shortDescription: 'Premium non-slip yoga mat',
        price: 1999,
        originalPrice: 2499,
        discountPercentage: 20,
        category: sportsCategory._id,
        brand: 'YogaLife',
        sku: 'YL-MAT-PREM-001',
        stock: 75,
        thumbnail: 'https://images.unsplash.com/photo-1544367567-0f2fcb009e0b?w=500',
        images: [
          { 
            public_id: 'yogamat_1', 
            url: 'https://images.unsplash.com/photo-1544367567-0f2fcb009e0b?w=500',
            isPrimary: true 
          }
        ],
        tags: ['yoga', 'fitness', 'exercise', 'mat'],
        specifications: new Map([
          ['Thickness', '6mm'],
          ['Material', 'High-density EVA foam'],
          ['Size', '183cm x 61cm'],
          ['Weight', '1.2kg'],
          ['Non-slip', 'Yes']
        ]),
        rating: 4.4,
        numReviews: 92,
        seller: sellerUser._id
      },

      // Beauty & Personal Care
      {
        title: 'Natural Face Moisturizer',
        description: 'Organic face moisturizer with natural ingredients. Suitable for all skin types.',
        shortDescription: 'Organic moisturizer for all skin types',
        price: 1599,
        category: beautyCategory._id,
        brand: 'NaturalGlow',
        sku: 'NG-MOIST-001',
        stock: 60,
        thumbnail: 'https://images.unsplash.com/photo-1556228453-efd6c1ff04f6?w=500',
        images: [
          { 
            public_id: 'moisturizer_1', 
            url: 'https://images.unsplash.com/photo-1556228453-efd6c1ff04f6?w=500',
            isPrimary: true 
          }
        ],
        tags: ['skincare', 'moisturizer', 'natural', 'organic'],
        specifications: new Map([
          ['Volume', '50ml'],
          ['Skin Type', 'All skin types'],
          ['Ingredients', 'Hyaluronic acid, Aloe vera, Vitamin E'],
          ['Paraben Free', 'Yes'],
          ['Cruelty Free', 'Yes']
        ]),
        rating: 4.6,
        numReviews: 45,
        seller: sellerUser._id
      }
    ];

    logger.info('Seeding products...');
    this.products = await Product.create(productsData);
    logger.info(`✅ ${this.products.length} products created`);
  }

  /**
   * Clear all data
   */
  async clearAll() {
    try {
      logger.info('Clearing database...');
      
      await User.deleteMany({});
      await Category.deleteMany({});
      await Product.deleteMany({});

      logger.info('Database cleared successfully!');
    } catch (error) {
      logger.error('Database clearing failed:', error);
      throw error;
    }
  }
}

module.exports = DatabaseSeeder;