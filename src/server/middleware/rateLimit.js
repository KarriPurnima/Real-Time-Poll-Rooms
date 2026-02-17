const rateLimit = require('express-rate-limit');

/**
 * Rate limiter for poll creation
 * Limit: 10 polls per IP per hour
 */
const createPollLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10, // 10 requests per hour
  message: {
    success: false,
    error: 'Too many polls created. Please try again later.'
  },
  standardHeaders: true,
  legacyHeaders: false,
  // Skip successful requests in count (optional)
  skipSuccessfulRequests: false,
  // Skip failed requests in count
  skipFailedRequests: true
});

/**
 * Rate limiter for voting
 * Limit: 20 votes per IP per minute (across all polls)
 */
const voteLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 20, // 20 requests per minute
  message: {
    success: false,
    error: 'Too many vote attempts. Please slow down.'
  },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: false,
  skipFailedRequests: true
});

/**
 * Rate limiter for general API requests
 * Limit: 100 requests per IP per 15 minutes
 */
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // 100 requests per 15 minutes
  message: {
    success: false,
    error: 'Too many requests. Please try again later.'
  },
  standardHeaders: true,
  legacyHeaders: false
});

/**
 * Rate limiter for getting poll data
 * More lenient since this is read-only
 * Limit: 60 requests per IP per minute
 */
const getPollLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 60, // 60 requests per minute
  message: {
    success: false,
    error: 'Too many requests. Please try again later.'
  },
  standardHeaders: true,
  legacyHeaders: false
});

module.exports = {
  createPollLimiter,
  voteLimiter,
  apiLimiter,
  getPollLimiter
};