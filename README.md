# ShoppyGlobe Backend API

A comprehensive e-commerce backend API built with Node.js, Express, and MongoDB.

## 🚀 Features

- **User Authentication & Authorization**
  - JWT-based authentication
  - Role-based access control (User, Admin, Seller)
  - Email verification
  - Password reset functionality
  - Account lockout protection

- **Product Management**
  - CRUD operations for products
  - Advanced filtering and search
  - Category management
  - Image upload with Cloudinary
  - Stock management
  - Product reviews and ratings

- **Shopping Cart & Orders**
  - Persistent shopping cart
  - Order management
  - Order tracking
  - Payment integration with Stripe

- **Advanced Features**
  - Real-time notifications
  - Email services
  - File uploads
  - Rate limiting
  - Comprehensive logging
  - API documentation with Swagger
  - Data validation
  - Security middleware

## 🛠️ Tech Stack

- **Runtime**: Node.js
- **Framework**: Express.js
- **Database**: MongoDB with Mongoose
- **Authentication**: JWT & bcrypt
- **File Upload**: Multer & Cloudinary
- **Email**: Nodemailer
- **Payment**: Stripe
- **Validation**: Joi
- **Documentation**: Swagger/OpenAPI
- **Testing**: Jest & Supertest
- **Logging**: Winston

## 📋 Prerequisites

- Node.js (v16 or higher)
- MongoDB (local or cloud)
- npm or yarn

## 🔧 Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/yourusername/shoppyglobe-backend.git
   cd shoppyglobe-backend
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Environment Setup**
   ```bash
   cp .env.example .env
   ```
   
   Update the `.env` file with your configuration:
   ```env
   NODE_ENV=development
   PORT=5000
   MONGODB_URI=mongodb://localhost:27017/shoppyglobe
   JWT_SECRET=your-super-secret-jwt-key
   JWT_EXPIRE=30d
   # ... other environment variables
   ```

4. **Start the server**
   ```bash
   # Development
   npm run dev
   
   # Production
   npm start
   ```

## 🗃️ Database Setup

1. **Start MongoDB** (if running locally)
   ```bash
   mongod
   ```

2. **Seed the database** (optional)
   ```bash
   npm run seed
   ```

## 📖 API Documentation

Once the server is running, visit:
- **Swagger UI**: `http://localhost:5000/api-docs`
- **Health Check**: `http://localhost:5000/health`

## 🔐 Authentication

The API uses JWT tokens for authentication. Include the token in the Authorization header:

```
Authorization: Bearer <your-jwt-token>
```

### User Roles

- **User**: Can view products, manage cart, place orders
- **Admin**: Full access to all resources
- **Seller**: Can manage their own products

## 📚 API Endpoints

### Authentication
```
POST   /api/auth/register       - Register new user
POST   /api/auth/login          - Login user
POST   /api/auth/logout         - Logout user
GET    /api/auth/me             - Get current user
PUT    /api/auth/me             - Update user profile
PUT    /api/auth/update-password - Update password
POST   /api/auth/forgot-password - Request password reset
PUT    /api/auth/reset-password/:token - Reset password
GET    /api/auth/verify-email/:token - Verify email
```

### Products
```
GET    /api/products            - Get all products
POST   /api/products            - Create product (Admin/Seller)
GET    /api/products/:id        - Get single product
PUT    /api/products/:id        - Update product (Admin/Seller)
DELETE /api/products/:id        - Delete product (Admin/Seller)
GET    /api/products/search     - Search products
GET    /api/products/featured   - Get featured products
```

### Categories
```
GET    /api/categories          - Get all categories
POST   /api/categories          - Create category (Admin)
GET    /api/categories/:id      - Get single category
PUT    /api/categories/:id      - Update category (Admin)
DELETE /api/categories/:id      - Delete category (Admin)
```

### Cart
```
GET    /api/cart                - Get user cart
POST   /api/cart                - Add item to cart
PUT    /api/cart/:id            - Update cart item
DELETE /api/cart/:id            - Remove item from cart
DELETE /api/cart                - Clear cart
```

### Orders
```
GET    /api/orders              - Get user orders
POST   /api/orders              - Create new order
GET    /api/orders/:id          - Get single order
PUT    /api/orders/:id/status   - Update order status (Admin)
```

### Payments
```
POST   /api/payments/create-intent - Create payment intent
POST   /api/payments/webhook    - Stripe webhook
```

## 🧪 Testing

```bash
# Run tests
npm test

# Run tests with coverage
npm run test:ci

# Run tests in watch mode
npm run test:watch
```

## 📊 Logging

Logs are stored in the `logs/` directory:
- `combined.log` - All logs
- `error.log` - Error logs only
- `exceptions.log` - Uncaught exceptions
- `rejections.log` - Unhandled promise rejections

## 🔒 Security Features

- **Helmet**: Security headers
- **CORS**: Cross-origin resource sharing
- **Rate Limiting**: Prevent abuse
- **Data Sanitization**: Prevent NoSQL injection
- **XSS Protection**: Prevent cross-site scripting
- **Parameter Pollution**: Prevent HPP attacks

## 🚀 Deployment

### Using PM2 (Recommended)

1. **Install PM2**
   ```bash
   npm install -g pm2
   ```

2. **Start application**
   ```bash
   pm2 start ecosystem.config.js
   ```

### Using Docker

1. **Build image**
   ```bash
   docker build -t shoppyglobe-api .
   ```

2. **Run container**
   ```bash
   docker run -p 5000:5000 --env-file .env shoppyglobe-api
   ```

## 📁 Project Structure

```
backend/
├── src/
│   ├── controllers/     # Route handlers
│   ├── models/          # Database models
│   ├── routes/          # API routes
│   ├── middleware/      # Custom middleware
│   ├── services/        # Business logic
│   ├── utils/           # Utility functions
│   ├── config/          # Configuration files
│   ├── validators/      # Request validation
│   └── tests/           # Test files
├── uploads/             # File uploads
├── logs/                # Application logs
├── .env                 # Environment variables
├── server.js            # Entry point
└── package.json         # Dependencies
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🆘 Support

If you have any questions or need help, please:
1. Check the [API documentation](http://localhost:5000/api-docs)
2. Search existing issues
3. Create a new issue with detailed description

## 🔄 Changelog

See [CHANGELOG.md](CHANGELOG.md) for a list of changes and version history.

---

**Made by Anmol Shukla**