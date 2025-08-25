const express = require('express');
const {
  createPaymentIntent,
  confirmPayment,
  handleStripeWebhook,
  createRefund,
  getPaymentAnalytics
} = require('../controllers/paymentController');
const { protect, authorize } = require('../middleware/auth');

const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: Payments
 *   description: Payment processing and management
 */

/**
 * @swagger
 * /api/payments/create-intent:
 *   post:
 *     summary: Create payment intent
 *     tags: [Payments]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - amount
 *             properties:
 *               amount:
 *                 type: number
 *                 description: Amount in smallest currency unit (paise for INR)
 *               currency:
 *                 type: string
 *                 default: inr
 *               metadata:
 *                 type: object
 *     responses:
 *       200:
 *         description: Payment intent created successfully
 *       400:
 *         description: Invalid amount or cart validation failed
 */
router.post('/create-intent', protect, createPaymentIntent);

/**
 * @swagger
 * /api/payments/confirm:
 *   post:
 *     summary: Confirm payment and create order
 *     tags: [Payments]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - paymentIntentId
 *               - shippingAddress
 *             properties:
 *               paymentIntentId:
 *                 type: string
 *               shippingAddress:
 *                 $ref: '#/components/schemas/Address'
 *     responses:
 *       201:
 *         description: Order created successfully
 *       400:
 *         description: Payment not completed or validation failed
 */
router.post('/confirm', protect, confirmPayment);

/**
 * @swagger
 * /api/payments/webhook:
 *   post:
 *     summary: Handle Stripe webhook
 *     tags: [Payments]
 *     description: Webhook endpoint for Stripe events (signature verified)
 *     responses:
 *       200:
 *         description: Webhook processed successfully
 *       400:
 *         description: Webhook signature verification failed
 */
router.post('/webhook', express.raw({ type: 'application/json' }), handleStripeWebhook);

/**
 * @swagger
 * /api/payments/refund:
 *   post:
 *     summary: Create refund
 *     tags: [Payments]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - orderId
 *             properties:
 *               orderId:
 *                 type: string
 *               amount:
 *                 type: number
 *                 description: Refund amount (defaults to full order amount)
 *               reason:
 *                 type: string
 *     responses:
 *       200:
 *         description: Refund created successfully
 *       400:
 *         description: Invalid order or refund not possible
 */
router.post('/refund', protect, authorize('admin'), createRefund);

/**
 * @swagger
 * /api/payments/analytics:
 *   get:
 *     summary: Get payment analytics
 *     tags: [Payments]
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
 *         description: Payment analytics retrieved successfully
 */
router.get('/analytics', protect, authorize('admin'), getPaymentAnalytics);

module.exports = router;