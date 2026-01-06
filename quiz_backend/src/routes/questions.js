const express = require('express');
const store = require('../store/memoryStore');
const { notFound } = require('../utils/errors');
const { validateBody, isNonEmptyString, isArray, isInt, validateEnum } = require('../utils/validation');
const { requireAuth, requireAdmin } = require('../middleware/auth');

const router = express.Router();

/**
 * @swagger
 * tags:
 *   - name: Questions
 *     description: Quiz question management and retrieval
 */

/**
 * @swagger
 * components:
 *   schemas:
 *     QuestionOption:
 *       type: object
 *       properties:
 *         id: { type: string, example: "A" }
 *         text: { type: string, example: "Option text" }
 *     Question:
 *       type: object
 *       properties:
 *         id: { type: string, example: "q_abc" }
 *         quizId: { type: string, example: "quiz_abc" }
 *         type: { type: string, enum: [mcq], example: mcq }
 *         prompt: { type: string, example: "2 + 2 = ?" }
 *         options:
 *           type: array
 *           items: { $ref: '#/components/schemas/QuestionOption' }
 *         correctOptionId: { type: string, example: "B" }
 *         points: { type: integer, example: 1 }
 *         createdAt: { type: string, format: date-time }
 *         updatedAt: { type: string, format: date-time }
 *     QuestionPublic:
 *       type: object
 *       properties:
 *         id: { type: string }
 *         quizId: { type: string }
 *         type: { type: string, enum: [mcq] }
 *         prompt: { type: string }
 *         options:
 *           type: array
 *           items: { $ref: '#/components/schemas/QuestionOption' }
 *         points: { type: integer }
 */

function toPublicQuestion(q) {
  return {
    id: q.id,
    quizId: q.quizId,
    type: q.type,
    prompt: q.prompt,
    options: q.options,
    points: q.points,
  };
}

/**
 * @swagger
 * /questions:
 *   get:
 *     tags: [Questions]
 *     summary: List questions for a quiz
 *     parameters:
 *       - in: query
 *         name: quizId
 *         required: true
 *         schema: { type: string }
 *       - in: query
 *         name: includeAnswers
 *         schema: { type: boolean, default: false }
 *         description: If true, includes correctOptionId; requires admin.
 *     responses:
 *       200:
 *         description: Questions list
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 questions:
 *                   type: array
 *                   items:
 *                     oneOf:
 *                       - { $ref: '#/components/schemas/QuestionPublic' }
 *                       - { $ref: '#/components/schemas/Question' }
 *       404:
 *         description: Quiz not found
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ApiError' }
 */
router.get('/', (req, res, next) => {
  try {
    const quizId = req.query.quizId;
    if (!quizId || typeof quizId !== 'string') throw notFound('Quiz not found');

    const quiz = store.getQuiz(quizId);
    if (!quiz) throw notFound('Quiz not found');

    const includeAnswers = req.query.includeAnswers === 'true';
    const questions = store.listQuestionsForQuiz(quizId);
    return res.status(200).json({
      questions: includeAnswers ? questions : questions.map(toPublicQuestion),
    });
  } catch (err) {
    return next(err);
  }
});

/**
 * @swagger
 * /questions:
 *   post:
 *     tags: [Questions]
 *     summary: Create a question (admin)
 *     security: [{ BearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [quizId, type, prompt, options, correctOptionId]
 *             properties:
 *               quizId: { type: string }
 *               type: { type: string, enum: [mcq] }
 *               prompt: { type: string }
 *               options:
 *                 type: array
 *                 minItems: 2
 *                 items: { $ref: '#/components/schemas/QuestionOption' }
 *               correctOptionId: { type: string }
 *               points: { type: integer, example: 1 }
 *     responses:
 *       201:
 *         description: Created question
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 question: { $ref: '#/components/schemas/Question' }
 *       404:
 *         description: Quiz not found
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ApiError' }
 */
router.post('/', requireAuth, requireAdmin, (req, res, next) => {
  try {
    const body = validateBody(req, (b) => {
      const errors = [];
      if (!b || typeof b !== 'object') errors.push({ path: '', message: 'Body must be an object' });
      if (!isNonEmptyString(b?.quizId)) errors.push({ path: 'quizId', message: 'quizId is required' });
      if (!validateEnum(b?.type, ['mcq'])) errors.push({ path: 'type', message: 'type must be mcq' });
      if (!isNonEmptyString(b?.prompt)) errors.push({ path: 'prompt', message: 'prompt is required' });
      if (!isArray(b?.options) || b.options.length < 2) errors.push({ path: 'options', message: 'options must be an array with at least 2 items' });
      if (!isNonEmptyString(b?.correctOptionId)) errors.push({ path: 'correctOptionId', message: 'correctOptionId is required' });
      if (b?.points !== undefined && !isInt(b.points)) errors.push({ path: 'points', message: 'points must be an integer' });

      if (isArray(b?.options)) {
        const ids = new Set();
        for (let i = 0; i < b.options.length; i += 1) {
          const opt = b.options[i];
          if (!opt || typeof opt !== 'object') {
            errors.push({ path: `options[${i}]`, message: 'option must be an object' });
            continue;
          }
          if (!isNonEmptyString(opt.id)) errors.push({ path: `options[${i}].id`, message: 'id is required' });
          if (!isNonEmptyString(opt.text)) errors.push({ path: `options[${i}].text`, message: 'text is required' });
          if (isNonEmptyString(opt.id)) {
            if (ids.has(opt.id)) errors.push({ path: `options[${i}].id`, message: 'duplicate option id' });
            ids.add(opt.id);
          }
        }
      }

      if (errors.length) return { ok: false, errors };

      return {
        ok: true,
        value: {
          quizId: b.quizId,
          type: b.type,
          prompt: b.prompt,
          options: b.options,
          correctOptionId: b.correctOptionId,
          points: b.points ?? 1,
        },
      };
    });

    const quiz = store.getQuiz(body.quizId);
    if (!quiz) throw notFound('Quiz not found');

    const question = store.createQuestion(body);
    return res.status(201).json({ question });
  } catch (err) {
    return next(err);
  }
});

/**
 * @swagger
 * /questions/{questionId}:
 *   patch:
 *     tags: [Questions]
 *     summary: Update a question (admin)
 *     security: [{ BearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: questionId
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               prompt: { type: string }
 *               options:
 *                 type: array
 *                 minItems: 2
 *                 items: { $ref: '#/components/schemas/QuestionOption' }
 *               correctOptionId: { type: string }
 *               points: { type: integer }
 *     responses:
 *       200:
 *         description: Updated question
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 question: { $ref: '#/components/schemas/Question' }
 *       404:
 *         description: Question not found
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ApiError' }
 */
router.patch('/:questionId', requireAuth, requireAdmin, (req, res, next) => {
  try {
    const questionId = req.params.questionId;
    const existing = store.getQuestion(questionId);
    if (!existing) throw notFound('Question not found');

    const patch = validateBody(req, (b) => {
      const errors = [];
      if (!b || typeof b !== 'object') errors.push({ path: '', message: 'Body must be an object' });
      if (b?.prompt !== undefined && !isNonEmptyString(b.prompt)) errors.push({ path: 'prompt', message: 'prompt must be non-empty' });
      if (b?.options !== undefined && (!isArray(b.options) || b.options.length < 2)) {
        errors.push({ path: 'options', message: 'options must be an array with at least 2 items' });
      }
      if (b?.correctOptionId !== undefined && !isNonEmptyString(b.correctOptionId)) {
        errors.push({ path: 'correctOptionId', message: 'correctOptionId must be non-empty' });
      }
      if (b?.points !== undefined && !isInt(b.points)) errors.push({ path: 'points', message: 'points must be an integer' });

      if (isArray(b?.options)) {
        const ids = new Set();
        for (let i = 0; i < b.options.length; i += 1) {
          const opt = b.options[i];
          if (!opt || typeof opt !== 'object') {
            errors.push({ path: `options[${i}]`, message: 'option must be an object' });
            continue;
          }
          if (!isNonEmptyString(opt.id)) errors.push({ path: `options[${i}].id`, message: 'id is required' });
          if (!isNonEmptyString(opt.text)) errors.push({ path: `options[${i}].text`, message: 'text is required' });
          if (isNonEmptyString(opt.id)) {
            if (ids.has(opt.id)) errors.push({ path: `options[${i}].id`, message: 'duplicate option id' });
            ids.add(opt.id);
          }
        }
      }

      if (errors.length) return { ok: false, errors };

      const out = {};
      if (b.prompt !== undefined) out.prompt = b.prompt;
      if (b.options !== undefined) out.options = b.options;
      if (b.correctOptionId !== undefined) out.correctOptionId = b.correctOptionId;
      if (b.points !== undefined) out.points = b.points;

      return { ok: true, value: out };
    });

    const updated = store.updateQuestion(questionId, patch);
    return res.status(200).json({ question: updated });
  } catch (err) {
    return next(err);
  }
});

/**
 * @swagger
 * /questions/{questionId}:
 *   delete:
 *     tags: [Questions]
 *     summary: Delete a question (admin)
 *     security: [{ BearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: questionId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       204:
 *         description: Deleted
 *       404:
 *         description: Question not found
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ApiError' }
 */
router.delete('/:questionId', requireAuth, requireAdmin, (req, res, next) => {
  try {
    const questionId = req.params.questionId;
    const existing = store.getQuestion(questionId);
    if (!existing) throw notFound('Question not found');
    store.deleteQuestion(questionId);
    return res.status(204).send();
  } catch (err) {
    return next(err);
  }
});

module.exports = router;
