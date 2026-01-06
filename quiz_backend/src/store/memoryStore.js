const crypto = require('crypto');

function nowIso() {
  return new Date().toISOString();
}

function newId(prefix) {
  return `${prefix}_${crypto.randomBytes(8).toString('hex')}`;
}

/**
 * In-memory store used until quiz_database schema/container is available.
 * This module provides a small DAO-style interface so it can be swapped later.
 */
class MemoryStore {
  constructor() {
    this.users = new Map(); // id -> {id,email,passwordHash,role,createdAt}
    this.tokens = new Map(); // token -> {userId,createdAt}
    this.quizzes = new Map(); // quizId -> quiz
    this.questions = new Map(); // questionId -> question
    this.results = new Map(); // resultId -> result
    this.attempts = new Map(); // attemptId -> attempt

    // Seed: admin + sample quiz
    const adminId = newId('usr');
    this.users.set(adminId, {
      id: adminId,
      email: 'admin@example.com',
      passwordHash: this.hashPassword('admin123'),
      role: 'admin',
      createdAt: nowIso(),
    });

    const quizId = newId('quiz');
    this.quizzes.set(quizId, {
      id: quizId,
      title: 'Sample Entrance Quiz',
      description: 'A short sample quiz to validate the platform.',
      timeLimitSeconds: 600,
      passingPercent: 60,
      published: true,
      createdAt: nowIso(),
      updatedAt: nowIso(),
    });

    const q1Id = newId('q');
    const q2Id = newId('q');
    this.questions.set(q1Id, {
      id: q1Id,
      quizId,
      type: 'mcq',
      prompt: '2 + 2 = ?',
      options: [
        { id: 'A', text: '3' },
        { id: 'B', text: '4' },
        { id: 'C', text: '5' },
        { id: 'D', text: '22' },
      ],
      correctOptionId: 'B',
      points: 1,
      createdAt: nowIso(),
      updatedAt: nowIso(),
    });
    this.questions.set(q2Id, {
      id: q2Id,
      quizId,
      type: 'mcq',
      prompt: 'Capital of France?',
      options: [
        { id: 'A', text: 'Berlin' },
        { id: 'B', text: 'Madrid' },
        { id: 'C', text: 'Paris' },
        { id: 'D', text: 'Rome' },
      ],
      correctOptionId: 'C',
      points: 1,
      createdAt: nowIso(),
      updatedAt: nowIso(),
    });
  }

  hashPassword(password) {
    // NOTE: For production, replace with bcrypt/argon2; kept simple for stubbed backend.
    return crypto.createHash('sha256').update(password).digest('hex');
  }

  verifyPassword(password, passwordHash) {
    return this.hashPassword(password) === passwordHash;
  }

  issueToken(userId) {
    const token = crypto.randomBytes(24).toString('hex');
    this.tokens.set(token, { userId, createdAt: nowIso() });
    return token;
  }

  revokeToken(token) {
    return this.tokens.delete(token);
  }

  getUserByToken(token) {
    const session = this.tokens.get(token);
    if (!session) return null;
    return this.users.get(session.userId) || null;
  }

  getUserByEmail(email) {
    for (const u of this.users.values()) {
      if (u.email.toLowerCase() === email.toLowerCase()) return u;
    }
    return null;
  }

  createUser({ email, password, role }) {
    const id = newId('usr');
    const user = {
      id,
      email,
      passwordHash: this.hashPassword(password),
      role,
      createdAt: nowIso(),
    };
    this.users.set(id, user);
    return user;
  }

  listQuizzes({ publishedOnly }) {
    const all = Array.from(this.quizzes.values());
    const filtered = publishedOnly ? all.filter((q) => q.published) : all;
    // stable ordering
    filtered.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    return filtered;
  }

  getQuiz(quizId) {
    return this.quizzes.get(quizId) || null;
  }

  createQuiz(data) {
    const id = newId('quiz');
    const quiz = {
      id,
      title: data.title,
      description: data.description || '',
      timeLimitSeconds: data.timeLimitSeconds ?? null,
      passingPercent: data.passingPercent ?? 60,
      published: data.published ?? false,
      createdAt: nowIso(),
      updatedAt: nowIso(),
    };
    this.quizzes.set(id, quiz);
    return quiz;
  }

  updateQuiz(quizId, patch) {
    const quiz = this.getQuiz(quizId);
    if (!quiz) return null;
    const updated = {
      ...quiz,
      ...patch,
      updatedAt: nowIso(),
    };
    this.quizzes.set(quizId, updated);
    return updated;
  }

  deleteQuiz(quizId) {
    const existed = this.quizzes.delete(quizId);
    // cascade questions
    for (const q of this.questions.values()) {
      if (q.quizId === quizId) this.questions.delete(q.id);
    }
    return existed;
  }

  listQuestionsForQuiz(quizId) {
    const qs = Array.from(this.questions.values()).filter((q) => q.quizId === quizId);
    qs.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    return qs;
  }

  getQuestion(questionId) {
    return this.questions.get(questionId) || null;
  }

  createQuestion(data) {
    const id = newId('q');
    const question = {
      id,
      quizId: data.quizId,
      type: data.type,
      prompt: data.prompt,
      options: data.options,
      correctOptionId: data.correctOptionId,
      points: data.points ?? 1,
      createdAt: nowIso(),
      updatedAt: nowIso(),
    };
    this.questions.set(id, question);
    return question;
  }

  updateQuestion(questionId, patch) {
    const q = this.getQuestion(questionId);
    if (!q) return null;
    const updated = {
      ...q,
      ...patch,
      updatedAt: nowIso(),
    };
    this.questions.set(questionId, updated);
    return updated;
  }

  deleteQuestion(questionId) {
    return this.questions.delete(questionId);
  }

  createAttempt({ userId, quizId }) {
    const id = newId('att');
    const attempt = {
      id,
      userId,
      quizId,
      status: 'in_progress',
      startedAt: nowIso(),
      finishedAt: null,
      createdAt: nowIso(),
      updatedAt: nowIso(),
    };
    this.attempts.set(id, attempt);
    return attempt;
  }

  finishAttempt(attemptId) {
    const att = this.attempts.get(attemptId);
    if (!att) return null;
    const updated = {
      ...att,
      status: 'submitted',
      finishedAt: nowIso(),
      updatedAt: nowIso(),
    };
    this.attempts.set(attemptId, updated);
    return updated;
  }

  getAttempt(attemptId) {
    return this.attempts.get(attemptId) || null;
  }

  listAttemptsForUser(userId) {
    const items = Array.from(this.attempts.values()).filter((a) => a.userId === userId);
    items.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    return items;
  }

  createResult(result) {
    const id = newId('res');
    const full = {
      id,
      ...result,
      createdAt: nowIso(),
    };
    this.results.set(id, full);
    return full;
  }

  getResult(resultId) {
    return this.results.get(resultId) || null;
  }

  listResultsForUser(userId) {
    const items = Array.from(this.results.values()).filter((r) => r.userId === userId);
    items.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    return items;
  }
}

module.exports = new MemoryStore();
