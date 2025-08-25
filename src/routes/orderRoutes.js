const express = require('express');
const {
  getOrders,
  getOrder,
  createOrder,
  updateOrderStatus,
  addTrackingInfo,
  cancelOrder,
  requestReturn,
  getOrderAnalytics,
  getRecentOrders,
  getOrdersRequiringAction
} = require('../controllers/orderController');
const { protect, authorize } = require('../middleware/auth');
const { 
  validateCreateOrder, 
  validateUpdateOrderStatus, 
  validateObjectId 
} = require('../validators/authValidator');

const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: Orders
 *   description: Order management and tracking
 */

/**
 * @swagger
 * /api/orders:
 *   get:
 *     summary: Get orders (user's own orders or all orders for admin)
 *     tags: [Orders]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [pending, confirmed, processing, shipped, delivered, cancelled, refunded]
 *       - in: query
 *         name: paymentStatus
 *         schema:
 *           type: string
 *           enum: [pending, paid, failed, refunded]
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *           format: date
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *           format: date
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *     responses:
 *       200:
 *         description: Orders retrieved successfully
 */
router.get('/', protect, getOrders);

/**
 * @swagger
 * /api/orders:
 *   post:
 *     summary: Create new order from cart
 *     tags: [Orders]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - shippingAddress
 *               - paymentMethod
 *             properties:
 *               shippingAddress:
 *                 $ref: '#/components/schemas/Address'
 *               paymentMethod:
 *                 type: string
 *                 enum: [stripe, paypal, razorpay, cod]
 *               customerNotes:
 *                 type: string
 *                 maxLength: 500
 *     responses:
 *       201:
 *         description: Order created successfully
 *       400:
 *         description: Cart is empty or validation failed
 */
router.post('/', protect, validateCreateOrder, createOrder);

/**
 * @swagger
 * /api/orders/analytics:
 *   get:
 *     summary: Get order analytics
 *     tags: [Orders]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *           format: date
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *           format: date
 *     responses:
 *       200:
 *         description: Order analytics retrieved successfully
 */
router.get('/analytics', protect, authorize('admin'), getOrderAnalytics);

/**
 * @swagger
 * /api/orders/recent:
 *   get:
 *     summary: Get recent orders
 *     tags: [Orders]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *     responses:
 *       200:
 *         description: Recent orders retrieved successfully
 */
router.get('/recent', protect, authorize('admin'), getRecentOrders);

/**
 * @swagger
 * /api/orders/requiring-action:
 *   get:
 *     summary: Get orders requiring action
 *     tags: [Orders]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Orders requiring action retrieved successfully
 */
router.get('/requiring-action', protect, authorize('admin'), getOrdersRequiringAction);

/**
 * @swagger
 * /api/orders/{id}:
 *   get:
 *     summary: Get single order
 *     tags: [Orders]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Order retrieved successfully
 *       404:
 *         description: Order not found
 */
router.get('/:id', protect, validateObjectId, getOrder);

/**
 * @swagger
 * /api/orders/{id}/status:
 *   put:
 *     summary: Update order status
 *     tags: [Orders]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - status
 *             properties:
 *               status:
 *                 type: string
 *                 enum: [pending, confirmed, processing, shipped, delivered, cancelled, refunded]
 *               notes:
 *                 type: string
 *                 maxLength: 500
 *     responses:
 *       200:
 *         description: Order status updated successfully
 *       404:
 *         description: Order not found
 */
router.put('/:id/status', protect, authorize('admin'), validateObjectId, validateUpdateOrderStatus, updateOrderStatus);

/**
 * @swagger
 * /api/orders/{id}/tracking:
 *   put:
 *     summary: Add tracking information
 *     tags: [Orders]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - provider
 *               - trackingNumber
 *             properties:
 *               provider:
 *                 type: string
 *                 example: BlueDart
 *               trackingNumber:
 *                 type: string
 *                 example: BD123456789
 *               trackingUrl:
 *                 type: string
 *                 example: https://www.bluedart.com/track
 *     responses:
 *       200:
 *         description: Tracking information added successfully
 *       404:
 *         description: Order not found
 */
router.put('/:id/tracking', protect, authorize('admin'), validateObjectId, addTrackingInfo);

/**
 * @swagger
 * /api/orders/{id}/cancel:
 *   put:
 *     summary: Cancel order
 *     tags: [Orders]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               reason:
 *                 type: string
 *                 example: Customer requested cancellation
 *     responses:
 *       200:
 *         description: Order cancelled successfully
 *       400:
 *         description: Order cannot be cancelled at this stage
 *       404:
 *         description: Order not found
 */
router.put('/:id/cancel', protect, validateObjectId, cancelOrder);

/**
 * @swagger
 * /api/orders/{id}/return:
 *   post:
 *     summary: Request return for order
 *     tags: [Orders]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - items
 *               - reason
 *             properties:
 *               items:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     product:
 *                       type: string
 *                     quantity:
 *                       type: number
 *                     reason:
 *                       type: string
 *               reason:
 *                 type: string
 *                 example: Product damaged
 *     responses:
 *       200:
 *         description: Return request submitted successfully
 *       400:
 *         description: Order cannot be returned or return already requested
 *       404:
 *         description: Order not found
 */
router.post('/:id/return', protect, validateObjectId, requestReturn);

module.exports = router;