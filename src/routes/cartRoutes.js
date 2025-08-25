const express = require('express');
const router = express.Router();

// Sample cart for testing
let sampleCart = {
  _id: 'cart123',
  user: 'user123',
  items: [],
  totalItems: 0,
  totalPrice: 0
};

// GET /api/cart
router.get('/', (req, res) => {
  res.json({ success: true, data: { cart: sampleCart } });
});

// POST /api/cart
router.post('/', (req, res) => {
  const { productId, quantity = 1, price, title, image } = req.body;
  const idx = sampleCart.items.findIndex(i => i.productId === productId);

  if (idx > -1) {
    sampleCart.items[idx].quantity += quantity;
    sampleCart.items[idx].subtotal = sampleCart.items[idx].price * sampleCart.items[idx].quantity;
  } else {
    sampleCart.items.push({
      _id: `item_${Date.now()}`,
      productId,
      quantity,
      price,
      title,
      image,
      subtotal: price * quantity
    });
  }

  sampleCart.totalItems = sampleCart.items.reduce((sum, i) => sum + i.quantity, 0);
  sampleCart.totalPrice = sampleCart.items.reduce((sum, i) => sum + i.subtotal, 0);

  res.json({ success: true, message: 'Item added to cart', data: { cart: sampleCart } });
});

// PUT /api/cart/:itemId
router.put('/:itemId', (req, res) => {
  const { quantity } = req.body;
  const idx = sampleCart.items.findIndex(i => i._id === req.params.itemId);
  if (idx === -1) {
    return res.status(404).json({ success: false, message: 'Cart item not found' });
  }
  if (quantity <= 0) {
    sampleCart.items.splice(idx, 1);
  } else {
    sampleCart.items[idx].quantity = quantity;
    sampleCart.items[idx].subtotal = sampleCart.items[idx].price * quantity;
  }
  sampleCart.totalItems = sampleCart.items.reduce((sum, i) => sum + i.quantity, 0);
  sampleCart.totalPrice = sampleCart.items.reduce((sum, i) => sum + i.subtotal, 0);
  res.json({ success: true, message: 'Cart updated', data: { cart: sampleCart } });
});

// DELETE /api/cart/:itemId
router.delete('/:itemId', (req, res) => {
  const idx = sampleCart.items.findIndex(i => i._id === req.params.itemId);
  if (idx === -1) {
    return res.status(404).json({ success: false, message: 'Cart item not found' });
  }
  sampleCart.items.splice(idx, 1);
  sampleCart.totalItems = sampleCart.items.reduce((sum, i) => sum + i.quantity, 0);
  sampleCart.totalPrice = sampleCart.items.reduce((sum, i) => sum + i.subtotal, 0);
  res.json({ success: true, message: 'Item removed from cart', data: { cart: sampleCart } });
});

// DELETE /api/cart
router.delete('/', (req, res) => {
  sampleCart.items = [];
  sampleCart.totalItems = 0;
  sampleCart.totalPrice = 0;
  res.json({ success: true, message: 'Cart cleared', data: { cart: sampleCart } });
});

const clearSampleCart = () => {
  sampleCart.items = [];
  sampleCart.totalItems = 0;
  sampleCart.totalPrice = 0;
};

module.exports = {
  router,
  clearSampleCart
};