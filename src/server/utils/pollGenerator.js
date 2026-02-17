const { customAlphabet } = require('nanoid');

// Create a custom alphabet excluding ambiguous characters
// Excludes: 0, O, I, l to avoid confusion
const alphabet = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
const nanoid = customAlphabet(alphabet, 8);

/**
 * Generate a unique poll ID
 * @returns {string} 8-character unique ID
 */
function generatePollId() {
  return nanoid();
}

/**
 * Validate poll ID format
 * @param {string} pollId 
 * @returns {boolean}
 */
function isValidPollId(pollId) {
  if (!pollId || typeof pollId !== 'string') {
    return false;
  }
  
  // Check length
  if (pollId.length !== 8) {
    return false;
  }
  
  // Check if contains only allowed characters
  const validCharRegex = new RegExp(`^[${alphabet}]+$`);
  return validCharRegex.test(pollId);
}

module.exports = {
  generatePollId,
  isValidPollId
};