const express = require('express');
const store = require('../store/memoryStore');
const { conflict, unauthorized, badRequest } = require('../utils/errors');
const { validateBody, isNonEmptyString, validateEnum } = require('../utils/validation');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

/**
 * @swagger
 * tags:
 *   - name: Auth
 *     description: User authentication endpoints (stubbed tokens until DB integration)
 */

/**
 * @swagger
 * components:
 *   securitySchemes:
 *     BearerAuth:
 *       type: http
 *       scheme: bearer
 *       bearerFormat: token
 *   schemas:
 *     ApiError:
 *       type: object
 *       properties:
 *         status: { type: string, example: error }
 *         code: { type: string, example: VALIDATION_ERROR }
 *         message: { type: string, example: Invalid request body }
 *         requestId: { type: string, nullable: true }
 *         details: { type: object, nullable: true }
 *     AuthTokenResponse:
 *       type: object
 *       properties:
 *         token: { type: string, example: "a1b2c3..." }
 *         user:
 *           type: object
 *           properties:
 *             id: { type: string, example: "usr_123" }
 *             email: { type: string, example: "student@example.com" }
 *             role: { type: string, example: "student" }
 */

/**
 * @swagger
 * /auth/register:
 *   post:
 *     tags: [Auth]
 *     summary: Register a new user (student by default)
 *     description: Creates a user and returns an auth token. In-memory until quiz_database is integrated.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, password]
 *             properties:
 *               email: { type: string, example: "student@example.com" }
 *               password: { type: string, minLength: 6, example: "secret123" }
 *               role: { type: string, enum: [student, admin], example: student }
 *     responses:
 *       201:
 *         description: Registered
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/AuthTokenResponse' }
 *       409:
 *         description: Email already registered
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ApiError' }
 */
router.post('/register', (req, res, next) => {
  try {
    const body = validateBody(req, (b) => {
      const errors = [];
      if (!b || typeof b !== 'object') errors.push({ path: '', message: 'Body must be an object' });
      if (!isNonEmptyString(b?.email)) errors.push({ path: 'email', message: 'email is required' });
      if (!isNonEmptyString(b?.password) || b.password.length < 6) {
        errors.push({ path: 'password', message: 'password must be at least 6 characters' });
      }
      if (b?.role !== undefined && !validateEnum(b.role, ['student', 'admin'])) {
        errors.push({ path: 'role', message: 'role must be student or admin' });
      }
      if (errors.length) return { ok: false, errors };
      return {
        ok: true,
        value: { email: b.email.trim(), password: b.password, role: b.role ?? 'student' },
      };
    });

    const existing = store.getUserByEmail(body.email);
    if (existing) throw conflict('Email already registered');

    const user = store.createUser(body);
    const token = store.issueToken(user.id);

    return res.status(201).json({
      token,
      user: { id: user.id, email: user.email, role: user.role },
    });
  } catch (err) {
    return next(err);
  }
});

/**
 * @swagger
 * /auth/login:
 *   post:
 *     tags: [Auth]
 *     summary: Login
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, password]
 *             properties:
 *               email: { type: string, example: "student@example.com" }
 *               password: { type: string, example: "secret123" }
 *     responses:
 *       200:
 *         description: Logged in
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/AuthTokenResponse' }
 *       401:
 *         description: Invalid credentials
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ApiError' }
 */
router.post('/login', (req, res, next) => {
  try {
    const body = validateBody(req, (b) => {
      const errors = [];
      if (!b || typeof b !== 'object') errors.push({ path: '', message: 'Body must be an object' });
      if (!isNonEmptyString(b?.email)) errors.push({ path: 'email', message: 'email is required' });
      if (!isNonEmptyString(b?.password)) errors.push({ path: 'password', message: 'password is required' });
      if (errors.length) return { ok: false, errors };
      return { ok: true, value: { email: b.email.trim(), password: b.password } };
    });

    const user = store.getUserByEmail(body.email);
    if (!user || !store.verifyPassword(body.password, user.passwordHash)) {
      throw unauthorized('Invalid email or password');
    }

    const token = store.issueToken(user.id);
    return res.status(200).json({
      token,
      user: { id: user.id, email: user.email, role: user.role },
    });
  } catch (err) {
    return next(err);
  }
});

/**
 * @swagger
 * /auth/me:
 *   get:
 *     tags: [Auth]
 *     summary: Get current user
 *     security: [{ BearerAuth: [] }]
 *     responses:
 *       200:
 *         description: Current user
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 user:
 *                   type: object
 *                   properties:
 *                     id: { type: string }
 *                     email: { type: string }
 *                     role: { type: string }
 *       401:
 *         description: Not authenticated
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ApiError' }
 */
router.get('/me', requireAuth, (req, res) => {
  return res.status(200).json({ user: req.user });
});

/**
 * @swagger
 * /auth/logout:
 *   post:
 *     tags: [Auth]
 *     summary: Logout (revoke current token)
 *     security: [{ BearerAuth: [] }]
 *     responses:
 *       204:
 *         description: Logged out
 *       401:
 *         description: Not authenticated
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ApiError' }
 */
router.post('/logout', requireAuth, (req, res, next) => {
  try {
    if (!req.token) throw badRequest('Missing token context');
    store.revokeToken(req.token);
    return res.status(204).send();
  } catch (err) {
    return next(err);
  }
});

module.exports = router;
