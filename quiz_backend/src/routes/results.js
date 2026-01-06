const express = require('express');
const store = require('../store/memoryStore');
const { scoreAttempt } = require('../services/scoring');
const { validateBody, isArray, isNonEmptyString } = require('../utils/validation');
const { notFound, badRequest, forbidden } = require('../utils/errors');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

/**
 * @swagger
 * tags:
 *   - name: Results
 *     description: Attempt submission, scoring, and result retrieval
 */

/**
 * @swagger
 * components:
 *   schemas:
 *     SubmittedAnswer:
 *       type: object
 *       required: [questionId, selectedOptionId]
 *       properties:
 *         questionId: { type: string, example: "q_abc" }
 *         selectedOptionId: { type: string, example: "B" }
 *     Result:
 *       type: object
 *       properties:
 *         id: { type: string, example: "res_abc" }
 *         userId: { type: string, example: "usr_abc" }
 *         quizId: { type: string, example: "quiz_abc" }
 *         attemptId: { type: string, example: "att_abc" }
 *         totalPoints: { type: integer, example: 10 }
 *         earnedPoints: { type: integer, example: 7 }
 *         percent: { type: number, example: 70 }
 *         passed: { type: boolean, example: true }
 *         grade: { type: string, example: "C" }
 *         breakdown:
 *           type: array
 *           items:
 *             type: object
 *             properties:
 *               questionId: { type: string }
 *               selectedOptionId: { type: string, nullable: true }
 *               correctOptionId: { type: string }
 *               isCorrect: { type: boolean }
 *               points: { type: integer }
 *               earnedPoints: { type: integer }
 *         createdAt: { type: string, format: date-time }
 */

/**
 * @swagger
 * /results/submit:
 *   post:
 *     tags: [Results]
 *     summary: Submit an attempt for scoring
 *     security: [{ BearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [attemptId, answers]
 *             properties:
 *               attemptId: { type: string }
 *               answers:
 *                 type: array
 *                 items: { $ref: '#/components/schemas/SubmittedAnswer' }
 *     responses:
 *       201:
 *         description: Created result
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 result: { $ref: '#/components/schemas/Result' }
 *       400:
 *         description: Invalid attempt or answers
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ApiError' }
 *       404:
 *         description: Attempt or quiz not found
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ApiError' }
 */
router.post('/submit', requireAuth, (req, res, next) => {
  try {
    const body = validateBody(req, (b) => {
      const errors = [];
      if (!b || typeof b !== 'object') errors.push({ path: '', message: 'Body must be an object' });
      if (!isNonEmptyString(b?.attemptId)) errors.push({ path: 'attemptId', message: 'attemptId is required' });
      if (!isArray(b?.answers)) errors.push({ path: 'answers', message: 'answers must be an array' });

      if (isArray(b?.answers)) {
        for (let i = 0; i < b.answers.length; i += 1) {
          const a = b.answers[i];
          if (!a || typeof a !== 'object') {
            errors.push({ path: `answers[${i}]`, message: 'answer must be an object' });
            continue;
          }
          if (!isNonEmptyString(a.questionId)) errors.push({ path: `answers[${i}].questionId`, message: 'questionId is required' });
          if (!isNonEmptyString(a.selectedOptionId)) errors.push({ path: `answers[${i}].selectedOptionId`, message: 'selectedOptionId is required' });
        }
      }

      if (errors.length) return { ok: false, errors };
      return { ok: true, value: { attemptId: b.attemptId, answers: b.answers } };
    });

    const attempt = store.getAttempt(body.attemptId);
    if (!attempt) throw notFound('Attempt not found');
    if (attempt.userId !== req.user.id) throw forbidden('Cannot submit another user’s attempt');
    if (attempt.status === 'submitted') throw badRequest('Attempt already submitted');

    const quiz = store.getQuiz(attempt.quizId);
    if (!quiz) throw notFound('Quiz not found');

    const questions = store.listQuestionsForQuiz(quiz.id);
    if (questions.length === 0) throw badRequest('Quiz has no questions');

    // Validate that submitted answers refer to this quiz's questions.
    const questionIds = new Set(questions.map((q) => q.id));
    for (const a of body.answers) {
      if (!questionIds.has(a.questionId)) throw badRequest('Answer contains questionId not in this quiz', { questionId: a.questionId });
    }

    const scored = scoreAttempt({ quiz, questions, answers: body.answers });

    store.finishAttempt(attempt.id);
    const result = store.createResult({
      userId: req.user.id,
      quizId: quiz.id,
      attemptId: attempt.id,
      ...scored,
    });

    return res.status(201).json({ result });
  } catch (err) {
    return next(err);
  }
});

/**
 * @swagger
 * /results:
 *   get:
 *     tags: [Results]
 *     summary: List results for current user (admin can query by userId)
 *     security: [{ BearerAuth: [] }]
 *     parameters:
 *       - in: query
 *         name: userId
 *         schema: { type: string }
 *         description: Admin-only. If provided, returns results for that userId.
 *     responses:
 *       200:
 *         description: Results list
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 results:
 *                   type: array
 *                   items: { $ref: '#/components/schemas/Result' }
 */
router.get('/', requireAuth, (req, res, next) => {
  try {
    const requestedUserId = req.query.userId;
    if (requestedUserId && requestedUserId !== req.user.id && req.user.role !== 'admin') {
      throw forbidden('Admin privileges required to view other users results');
    }
    const userId = requestedUserId && typeof requestedUserId === 'string' ? requestedUserId : req.user.id;
    const results = store.listResultsForUser(userId);
    return res.status(200).json({ results });
  } catch (err) {
    return next(err);
  }
});

/**
 * @swagger
 * /results/{resultId}:
 *   get:
 *     tags: [Results]
 *     summary: Get a single result (owner or admin)
 *     security: [{ BearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: resultId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Result
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 result: { $ref: '#/components/schemas/Result' }
 *       404:
 *         description: Result not found
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ApiError' }
 */
router.get('/:resultId', requireAuth, (req, res, next) => {
  try {
    const result = store.getResult(req.params.resultId);
    if (!result) throw notFound('Result not found');
    if (result.userId !== req.user.id && req.user.role !== 'admin') throw forbidden('Not allowed');
    return res.status(200).json({ result });
  } catch (err) {
    return next(err);
  }
});

module.exports = router;
