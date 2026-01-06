const express = require('express');
const store = require('../store/memoryStore');
const { notFound } = require('../utils/errors');
const { validateBody, isNonEmptyString, isBoolean, isFiniteNumber, isInt } = require('../utils/validation');
const { requireAuth, requireAdmin } = require('../middleware/auth');

const router = express.Router();

/**
 * @swagger
 * tags:
 *   - name: Quizzes
 *     description: Quiz management and attempt start
 */

/**
 * @swagger
 * components:
 *   schemas:
 *     Quiz:
 *       type: object
 *       properties:
 *         id: { type: string, example: "quiz_abc" }
 *         title: { type: string, example: "Math Entrance Quiz" }
 *         description: { type: string, example: "Basic arithmetic." }
 *         timeLimitSeconds: { type: integer, nullable: true, example: 900 }
 *         passingPercent: { type: number, example: 60 }
 *         published: { type: boolean, example: true }
 *         createdAt: { type: string, format: date-time }
 *         updatedAt: { type: string, format: date-time }
 *     Attempt:
 *       type: object
 *       properties:
 *         id: { type: string, example: "att_abc" }
 *         userId: { type: string, example: "usr_abc" }
 *         quizId: { type: string, example: "quiz_abc" }
 *         status: { type: string, enum: [in_progress, submitted] }
 *         startedAt: { type: string, format: date-time }
 *         finishedAt: { type: string, format: date-time, nullable: true }
 */

/**
 * @swagger
 * /quizzes:
 *   get:
 *     tags: [Quizzes]
 *     summary: List quizzes
 *     parameters:
 *       - in: query
 *         name: publishedOnly
 *         schema: { type: boolean, default: true }
 *         description: If true, returns only published quizzes.
 *     responses:
 *       200:
 *         description: List of quizzes
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 quizzes:
 *                   type: array
 *                   items: { $ref: '#/components/schemas/Quiz' }
 */
router.get('/', (req, res) => {
  const publishedOnly = req.query.publishedOnly === undefined ? true : req.query.publishedOnly === 'true';
  const quizzes = store.listQuizzes({ publishedOnly });
  return res.status(200).json({ quizzes });
});

/**
 * @swagger
 * /quizzes/{quizId}:
 *   get:
 *     tags: [Quizzes]
 *     summary: Get quiz detail
 *     parameters:
 *       - in: path
 *         name: quizId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Quiz detail
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 quiz: { $ref: '#/components/schemas/Quiz' }
 *       404:
 *         description: Quiz not found
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ApiError' }
 */
router.get('/:quizId', (req, res, next) => {
  try {
    const quiz = store.getQuiz(req.params.quizId);
    if (!quiz) throw notFound('Quiz not found');
    return res.status(200).json({ quiz });
  } catch (err) {
    return next(err);
  }
});

/**
 * @swagger
 * /quizzes:
 *   post:
 *     tags: [Quizzes]
 *     summary: Create a quiz (admin)
 *     security: [{ BearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [title]
 *             properties:
 *               title: { type: string }
 *               description: { type: string }
 *               timeLimitSeconds: { type: integer, nullable: true }
 *               passingPercent: { type: number, example: 60 }
 *               published: { type: boolean, example: false }
 *     responses:
 *       201:
 *         description: Created quiz
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 quiz: { $ref: '#/components/schemas/Quiz' }
 */
router.post('/', requireAuth, requireAdmin, (req, res, next) => {
  try {
    const body = validateBody(req, (b) => {
      const errors = [];
      if (!b || typeof b !== 'object') errors.push({ path: '', message: 'Body must be an object' });
      if (!isNonEmptyString(b?.title)) errors.push({ path: 'title', message: 'title is required' });
      if (b?.timeLimitSeconds !== undefined && b.timeLimitSeconds !== null && !isInt(b.timeLimitSeconds)) {
        errors.push({ path: 'timeLimitSeconds', message: 'timeLimitSeconds must be an integer or null' });
      }
      if (b?.passingPercent !== undefined && !isFiniteNumber(b.passingPercent)) {
        errors.push({ path: 'passingPercent', message: 'passingPercent must be a number' });
      }
      if (b?.published !== undefined && !isBoolean(b.published)) {
        errors.push({ path: 'published', message: 'published must be a boolean' });
      }
      if (errors.length) return { ok: false, errors };
      return {
        ok: true,
        value: {
          title: b.title.trim(),
          description: typeof b.description === 'string' ? b.description : '',
          timeLimitSeconds: b.timeLimitSeconds ?? null,
          passingPercent: b.passingPercent ?? 60,
          published: b.published ?? false,
        },
      };
    });

    const quiz = store.createQuiz(body);
    return res.status(201).json({ quiz });
  } catch (err) {
    return next(err);
  }
});

/**
 * @swagger
 * /quizzes/{quizId}:
 *   patch:
 *     tags: [Quizzes]
 *     summary: Update quiz (admin)
 *     security: [{ BearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: quizId
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               title: { type: string }
 *               description: { type: string }
 *               timeLimitSeconds: { type: integer, nullable: true }
 *               passingPercent: { type: number }
 *               published: { type: boolean }
 *     responses:
 *       200:
 *         description: Updated quiz
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 quiz: { $ref: '#/components/schemas/Quiz' }
 *       404:
 *         description: Quiz not found
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ApiError' }
 */
router.patch('/:quizId', requireAuth, requireAdmin, (req, res, next) => {
  try {
    const quizId = req.params.quizId;
    const existing = store.getQuiz(quizId);
    if (!existing) throw notFound('Quiz not found');

    const body = validateBody(req, (b) => {
      const errors = [];
      if (!b || typeof b !== 'object') errors.push({ path: '', message: 'Body must be an object' });
      if (b?.title !== undefined && !isNonEmptyString(b.title)) errors.push({ path: 'title', message: 'title must be non-empty' });
      if (b?.timeLimitSeconds !== undefined && b.timeLimitSeconds !== null && !isInt(b.timeLimitSeconds)) {
        errors.push({ path: 'timeLimitSeconds', message: 'timeLimitSeconds must be an integer or null' });
      }
      if (b?.passingPercent !== undefined && !isFiniteNumber(b.passingPercent)) {
        errors.push({ path: 'passingPercent', message: 'passingPercent must be a number' });
      }
      if (b?.published !== undefined && !isBoolean(b.published)) {
        errors.push({ path: 'published', message: 'published must be a boolean' });
      }
      if (errors.length) return { ok: false, errors };

      const patch = {};
      if (b.title !== undefined) patch.title = b.title.trim();
      if (b.description !== undefined) patch.description = typeof b.description === 'string' ? b.description : '';
      if (b.timeLimitSeconds !== undefined) patch.timeLimitSeconds = b.timeLimitSeconds;
      if (b.passingPercent !== undefined) patch.passingPercent = b.passingPercent;
      if (b.published !== undefined) patch.published = b.published;

      return { ok: true, value: patch };
    });

    const updated = store.updateQuiz(quizId, body);
    return res.status(200).json({ quiz: updated });
  } catch (err) {
    return next(err);
  }
});

/**
 * @swagger
 * /quizzes/{quizId}:
 *   delete:
 *     tags: [Quizzes]
 *     summary: Delete quiz (admin)
 *     security: [{ BearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: quizId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       204:
 *         description: Deleted
 *       404:
 *         description: Quiz not found
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ApiError' }
 */
router.delete('/:quizId', requireAuth, requireAdmin, (req, res, next) => {
  try {
    const quizId = req.params.quizId;
    const existing = store.getQuiz(quizId);
    if (!existing) throw notFound('Quiz not found');
    store.deleteQuiz(quizId);
    return res.status(204).send();
  } catch (err) {
    return next(err);
  }
});

/**
 * @swagger
 * /quizzes/{quizId}/start:
 *   post:
 *     tags: [Quizzes]
 *     summary: Start an attempt for a quiz (authenticated user)
 *     security: [{ BearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: quizId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       201:
 *         description: Attempt created
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 attempt: { $ref: '#/components/schemas/Attempt' }
 *       404:
 *         description: Quiz not found
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ApiError' }
 */
router.post('/:quizId/start', requireAuth, (req, res, next) => {
  try {
    const quiz = store.getQuiz(req.params.quizId);
    if (!quiz) throw notFound('Quiz not found');
    const attempt = store.createAttempt({ userId: req.user.id, quizId: quiz.id });
    return res.status(201).json({ attempt });
  } catch (err) {
    return next(err);
  }
});

module.exports = router;
