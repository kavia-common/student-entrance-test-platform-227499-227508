class ApiError extends Error {
  constructor(statusCode, code, message, details) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
  }
}

const errorCodes = {
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  NOT_FOUND: 'NOT_FOUND',
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  CONFLICT: 'CONFLICT',
  RATE_LIMITED: 'RATE_LIMITED',
  INTERNAL: 'INTERNAL',
};

// PUBLIC_INTERFACE
function badRequest(message, details) {
  /** Create a 400 error with a stable machine-readable code. */
  return new ApiError(400, errorCodes.VALIDATION_ERROR, message, details);
}

// PUBLIC_INTERFACE
function notFound(message, details) {
  /** Create a 404 error with a stable machine-readable code. */
  return new ApiError(404, errorCodes.NOT_FOUND, message, details);
}

// PUBLIC_INTERFACE
function unauthorized(message, details) {
  /** Create a 401 error with a stable machine-readable code. */
  return new ApiError(401, errorCodes.UNAUTHORIZED, message, details);
}

// PUBLIC_INTERFACE
function forbidden(message, details) {
  /** Create a 403 error with a stable machine-readable code. */
  return new ApiError(403, errorCodes.FORBIDDEN, message, details);
}

// PUBLIC_INTERFACE
function conflict(message, details) {
  /** Create a 409 error with a stable machine-readable code. */
  return new ApiError(409, errorCodes.CONFLICT, message, details);
}

// PUBLIC_INTERFACE
function toApiError(err) {
  /** Normalize any thrown error to an ApiError so the error middleware can respond consistently. */
  if (err instanceof ApiError) return err;
  return new ApiError(500, errorCodes.INTERNAL, 'Internal Server Error');
}

module.exports = {
  ApiError,
  errorCodes,
  badRequest,
  notFound,
  unauthorized,
  forbidden,
  conflict,
  toApiError,
};
