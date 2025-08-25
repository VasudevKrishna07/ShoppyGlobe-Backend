const express = require('express');
const router = express.Router();

// Sample products data for testing
const sampleProducts = [
  {
    _id: '1',
    title: 'Wireless Bluetooth Headphones',
    description: 'High-quality wireless headphones with noise cancellation',
    price: 99.99,
    originalPrice: 129.99,
    category: 'Electronics',
    brand: 'TechBrand',
    image: 'https://via.placeholder.com/300x300?text=Headphones',
    rating: 4.5,
    reviewCount: 128,
    inStock: true,
    stock: 50
  },
  {
    _id: '2',
    title: 'Smart Fitness Watch',
    description: 'Track your fitness goals with this advanced smartwatch',
    price: 199.99,
    originalPrice: 249.99,
    category: 'Electronics',
    brand: 'FitTech',
    image: 'https://via.placeholder.com/300x300?text=Smart+Watch',
    rating: 4.3,
    reviewCount: 89,
    inStock: true,
    stock: 25
  },
  {
    _id: '3',
    title: 'Organic Cotton T-Shirt',
    description: 'Comfortable organic cotton t-shirt in multiple colors',
    price: 29.99,
    originalPrice: 39.99,
    category: 'Clothing',
    brand: 'EcoWear',
    image: 'https://via.placeholder.com/300x300?text=T-Shirt',
    rating: 4.7,
    reviewCount: 203,
    inStock: true,
    stock: 100
  },
  {
    _id: '4',
    title: 'Premium Coffee Beans',
    description: 'Freshly roasted arabica coffee beans from Colombia',
    price: 24.99,
    originalPrice: 34.99,
    category: 'Food',
    brand: 'CoffeeCo',
    image: 'https://via.placeholder.com/300x300?text=Coffee',
    rating: 4.8,
    reviewCount: 156,
    inStock: true,
    stock: 75
  },
  {
    _id: '5',
    title: 'Yoga Mat Premium',
    description: 'Non-slip yoga mat perfect for all types of yoga practice',
    price: 49.99,
    originalPrice: 69.99,
    category: 'Sports',
    brand: 'YogaLife',
    image: 'https://via.placeholder.com/300x300?text=Yoga+Mat',
    rating: 4.6,
    reviewCount: 92,
    inStock: true,
    stock: 30
  },
  {
    _id: '6',
    title: 'Stainless Steel Water Bottle',
    description: 'Insulated water bottle keeps drinks cold for 24 hours',
    price: 34.99,
    originalPrice: 44.99,
    category: 'Accessories',
    brand: 'HydroMax',
    image: 'https://via.placeholder.com/300x300?text=Water+Bottle',
    rating: 4.4,
    reviewCount: 167,
    inStock: true,
    stock: 60
  }
];

// GET /api/products
router.get('/', (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 20;
  const search = req.query.search || '';
  const category = req.query.category || '';
  const sort = req.query.sort || 'createdAt';
  const sortOrder = req.query.sortOrder || 'desc';

  let filtered = sampleProducts;

  if (search) {
    filtered = filtered.filter(p =>
      p.title.toLowerCase().includes(search.toLowerCase()) ||
      p.description.toLowerCase().includes(search.toLowerCase())
    );
  }
  if (category) {
    filtered = filtered.filter(p => p.category.toLowerCase() === category.toLowerCase());
  }

  filtered.sort((a, b) => {
    let aVal = a[sort], bVal = b[sort];
    if (sort === 'price') { aVal = parseFloat(aVal); bVal = parseFloat(bVal); }
    return sortOrder === 'asc' ? (aVal > bVal ? 1 : -1) : (aVal < bVal ? 1 : -1);
  });

  const start = (page - 1) * limit;
  const paginated = filtered.slice(start, start + limit);

  res.json({
    success: true,
    data: {
      products: paginated,
      pagination: {
        page,
        limit,
        total: filtered.length,
        totalPages: Math.ceil(filtered.length / limit),
        hasNext: start + limit < filtered.length,
        hasPrev: page > 1
      }
    }
  });
});

// GET /api/products/:id
router.get('/:id', (req, res) => {
  const product = sampleProducts.find(p => p._id === req.params.id);
  if (!product) {
    return res.status(404).json({ success: false, message: 'Product not found' });
  }
  res.json({ success: true, data: { product } });
});

module.exports = router;
