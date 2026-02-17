const crypto = require('crypto');

/**
 * Generate a browser fingerprint from request headers
 * This creates a unique identifier based on browser characteristics
 * @param {Object} req - Express request object
 * @returns {string} Fingerprint hash
 */
function generateFingerprint(req) {
  const components = [
    req.headers['user-agent'] || '',
    req.headers['accept-language'] || '',
    req.headers['accept-encoding'] || '',
    req.headers['accept'] || ''
  ];
  
  const fingerprintString = components.join('|');
  return crypto.createHash('sha256').update(fingerprintString).digest('hex');
}

/**
 * Extract IP address from request, handling proxies
 * @param {Object} req - Express request object
 * @returns {string} IP address
 */
function getClientIp(req) {
  // Check for forwarded IP (proxy/load balancer)
  const forwarded = req.headers['x-forwarded-for'];
  if (forwarded) {
    // Take the first IP in the list
    return forwarded.split(',')[0].trim();
  }
  
  // Check for real IP header
  if (req.headers['x-real-ip']) {
    return req.headers['x-real-ip'];
  }
  
  // Fall back to connection IP
  return req.connection.remoteAddress || req.socket.remoteAddress || 'unknown';
}

/**
 * Validate vote request data
 * @param {Object} voteData 
 * @returns {Object} { valid: boolean, error: string }
 */
function validateVoteData(voteData) {
  const { pollId, optionIndex, fingerprint } = voteData;
  
  if (!pollId || typeof pollId !== 'string') {
    return { valid: false, error: 'Invalid poll ID' };
  }
  
  if (typeof optionIndex !== 'number' || optionIndex < 0) {
    return { valid: false, error: 'Invalid option index' };
  }
  
  if (!fingerprint || typeof fingerprint !== 'string') {
    return { valid: false, error: 'Invalid fingerprint' };
  }
  
  return { valid: true };
}

/**
 * Sanitize string input to prevent XSS
 * @param {string} str 
 * @returns {string}
 */
function sanitizeInput(str) {
  if (typeof str !== 'string') return '';
  
  return str
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;')
    .trim()
    .substring(0, 500); // Limit length
}

/**
 * Validate poll creation data
 * @param {Object} pollData 
 * @returns {Object} { valid: boolean, error: string, sanitized: Object }
 */
function validatePollData(pollData) {
  const { question, options } = pollData;
  
  // Validate question
  if (!question || typeof question !== 'string' || question.trim().length === 0) {
    return { valid: false, error: 'Question is required' };
  }
  
  if (question.length > 500) {
    return { valid: false, error: 'Question is too long (max 500 characters)' };
  }
  
  // Validate options
  if (!Array.isArray(options)) {
    return { valid: false, error: 'Options must be an array' };
  }
  
  if (options.length < 2) {
    return { valid: false, error: 'At least 2 options are required' };
  }
  
  if (options.length > 10) {
    return { valid: false, error: 'Maximum 10 options allowed' };
  }
  
  // Validate each option
  for (let i = 0; i < options.length; i++) {
    if (!options[i] || typeof options[i] !== 'string' || options[i].trim().length === 0) {
      return { valid: false, error: `Option ${i + 1} is invalid` };
    }
    
    if (options[i].length > 200) {
      return { valid: false, error: `Option ${i + 1} is too long (max 200 characters)` };
    }
  }
  
  // Sanitize inputs
  const sanitized = {
    question: sanitizeInput(question),
    options: options.map(opt => sanitizeInput(opt))
  };
  
  return { valid: true, sanitized };
}

/**
 * Rate limit configuration
 */
const RATE_LIMITS = {
  // Maximum votes per IP per poll per time window
  VOTES_PER_IP_PER_POLL: 1,
  
  // Time window for vote rate limiting (5 minutes)
  VOTE_RATE_WINDOW_MS: 5 * 60 * 1000,
  
  // Maximum polls created per IP per hour
  POLLS_PER_IP_PER_HOUR: 10
};

module.exports = {
  generateFingerprint,
  getClientIp,
  validateVoteData,
  validatePollData,
  sanitizeInput,
  RATE_LIMITS
};