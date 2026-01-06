const crypto = require('crypto');

// PUBLIC_INTERFACE
function requestContext(req, res, next) {
  /** Adds req.requestId and optionally enforces a request timeout. */
  req.requestId = crypto.randomBytes(8).toString('hex');
  res.setHeader('X-Request-Id', req.requestId);

  const timeoutMs = Number(process.env.REQUEST_TIMEOUT_MS || 30000);
  if (Number.isFinite(timeoutMs) && timeoutMs > 0) {
    res.setTimeout(timeoutMs, () => {
      // Let Express error handler deal with the response if still possible.
      try {
        res.status(504).json({
          status: 'error',
          code: 'REQUEST_TIMEOUT',
          message: 'Request timed out',
          requestId: req.requestId,
        });
      } catch (_) {
        // ignore
      }
    });
  }

  return next();
}

module.exports = {
  requestContext,
};
