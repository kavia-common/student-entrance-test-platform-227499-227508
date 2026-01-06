const store = require('../store/memoryStore');
const { unauthorized, forbidden } = require('../utils/errors');

function getBearerToken(req) {
  const h = req.headers.authorization;
  if (!h || typeof h !== 'string') return null;
  const [scheme, token] = h.split(' ');
  if (scheme !== 'Bearer' || !token) return null;
  return token;
}

// PUBLIC_INTERFACE
function requireAuth(req, res, next) {
  /** Express middleware: requires Authorization: Bearer <token> and sets req.user */
  const token = getBearerToken(req);
  if (!token) return next(unauthorized('Missing bearer token'));
  const user = store.getUserByToken(token);
  if (!user) return next(unauthorized('Invalid or expired token'));

  req.user = { id: user.id, email: user.email, role: user.role };
  req.token = token;
  return next();
}

// PUBLIC_INTERFACE
function requireAdmin(req, res, next) {
  /** Express middleware: requires authenticated user to have role=admin. */
  if (!req.user) return next(unauthorized('Not authenticated'));
  if (req.user.role !== 'admin') return next(forbidden('Admin privileges required'));
  return next();
}

module.exports = {
  requireAuth,
  requireAdmin,
};
