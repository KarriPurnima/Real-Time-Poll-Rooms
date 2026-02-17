const { isValidPollId } = require('../utils/pollGenerator');

/**
 * Middleware to validate poll ID parameter
 */
function validatePollId(req, res, next) {
  const pollId = req.params.pollId || req.body.pollId;
  
  if (!pollId) {
    return res.status(400).json({ 
      success: false, 
      error: 'Poll ID is required' 
    });
  }
  
  if (!isValidPollId(pollId)) {
    return res.status(400).json({ 
      success: false, 
      error: 'Invalid poll ID format' 
    });
  }
  
  next();
}

/**
 * Middleware to validate request body exists
 */
function requireBody(req, res, next) {
  if (!req.body || Object.keys(req.body).length === 0) {
    return res.status(400).json({ 
      success: false, 
      error: 'Request body is required' 
    });
  }
  
  next();
}

/**
 * Middleware to validate JSON content type
 */
function requireJSON(req, res, next) {
  if (req.method === 'POST' || req.method === 'PUT') {
    const contentType = req.headers['content-type'];
    if (!contentType || !contentType.includes('application/json')) {
      return res.status(400).json({ 
        success: false, 
        error: 'Content-Type must be application/json' 
      });
    }
  }
  
  next();
}

module.exports = {
  validatePollId,
  requireBody,
  requireJSON
};