const { badRequest } = require('./errors');

function isNonEmptyString(v) {
  return typeof v === 'string' && v.trim().length > 0;
}

function isBoolean(v) {
  return typeof v === 'boolean';
}

function isObject(v) {
  return v !== null && typeof v === 'object' && !Array.isArray(v);
}

function isArray(v) {
  return Array.isArray(v);
}

function isFiniteNumber(v) {
  return typeof v === 'number' && Number.isFinite(v);
}

function isInt(v) {
  return Number.isInteger(v);
}

function isOptionalString(v) {
  return v === undefined || v === null || typeof v === 'string';
}

function validateEnum(v, allowed) {
  return allowed.includes(v);
}

/**
 * Validates a request body against a validator function.
 * Validator should return { ok: true, value } or { ok: false, errors: [...] }
 */
// PUBLIC_INTERFACE
function validateBody(req, validator) {
  /** Validate req.body and return the parsed value or throw 400 with details. */
  const result = validator(req.body);
  if (result.ok) return result.value;
  throw badRequest('Invalid request body', { errors: result.errors });
}

module.exports = {
  isNonEmptyString,
  isBoolean,
  isObject,
  isArray,
  isFiniteNumber,
  isInt,
  isOptionalString,
  validateEnum,
  validateBody,
};
