const { toApiError } = require('../utils/errors');

// PUBLIC_INTERFACE
function errorHandler(err, req, res, next) {
  /** Express error handler returning consistent API error envelope. */
  const apiErr = toApiError(err);
  const requestId = req.requestId || null;

  // Avoid leaking internals by default; include details only for 4xx.
  const includeDetails = apiErr.statusCode >= 400 && apiErr.statusCode < 500;

  return res.status(apiErr.statusCode).json({
    status: 'error',
    code: apiErr.code,
    message: apiErr.message,
    requestId,
    ...(includeDetails && apiErr.details ? { details: apiErr.details } : {}),
  });
}

module.exports = {
  errorHandler,
};
