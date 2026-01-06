const express = require('express');
const healthController = require('../controllers/health');

const authRoutes = require('./auth');
const quizRoutes = require('./quizzes');
const questionRoutes = require('./questions');
const resultRoutes = require('./results');

const router = express.Router();

/**
 * @swagger
 * /:
 *   get:
 *     tags: [Health]
 *     summary: Health endpoint
 *     responses:
 *       200:
 *         description: Service health check passed
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: ok
 *                 message:
 *                   type: string
 *                   example: Service is healthy
 *                 timestamp:
 *                   type: string
 *                   format: date-time
 *                 environment:
 *                   type: string
 *                   example: development
 */
router.get('/', healthController.check.bind(healthController));

router.use('/auth', authRoutes);
router.use('/quizzes', quizRoutes);
router.use('/questions', questionRoutes);
router.use('/results', resultRoutes);

module.exports = router;
