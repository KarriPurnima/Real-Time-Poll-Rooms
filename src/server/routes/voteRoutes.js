const express = require('express');
const router = express.Router();
const { dbHelpers } = require('../database');
const { 
  getClientIp, 
  validateVoteData,
  RATE_LIMITS 
} = require('../utils/antiAbuse');
const { validatePollId, requireBody } = require('../middleware/validation');
const { voteLimiter } = require('../middleware/rateLimit');

/**
 * POST /api/votes
 * Submit a vote for a poll
 */
router.post('/', voteLimiter, requireBody, validatePollId, async (req, res) => {
  try {
    const { pollId, optionIndex, fingerprint } = req.body;
    
    // Validate vote data
    const validation = validateVoteData({ pollId, optionIndex, fingerprint });
    if (!validation.valid) {
      return res.status(400).json({
        success: false,
        error: validation.error
      });
    }
    
    // Get client IP
    const ipAddress = getClientIp(req);
    
    // Get poll to validate option index
    const poll = dbHelpers.getPoll(pollId);
    if (!poll) {
      return res.status(404).json({
        success: false,
        error: 'Poll not found'
      });
    }
    
    // Validate option index
    if (optionIndex >= poll.options.length) {
      return res.status(400).json({
        success: false,
        error: 'Invalid option index'
      });
    }
    
    // Anti-abuse mechanism #1: Check if IP has already voted
    const hasVotedIP = dbHelpers.hasVotedByIP(pollId, ipAddress);
    if (hasVotedIP) {
      return res.status(403).json({
        success: false,
        error: 'You have already voted in this poll'
      });
    }
    
    // Anti-abuse mechanism #2: Check if fingerprint has already voted
    const hasVotedFingerprint = dbHelpers.hasVotedByFingerprint(pollId, fingerprint);
    if (hasVotedFingerprint) {
      return res.status(403).json({
        success: false,
        error: 'You have already voted in this poll'
      });
    }
    
    // Additional check: Rate limit votes from same IP
    const recentVotes = dbHelpers.getRecentVoteCount(
      pollId, 
      ipAddress, 
      RATE_LIMITS.VOTE_RATE_WINDOW_MS
    );
    
    if (recentVotes >= RATE_LIMITS.VOTES_PER_IP_PER_POLL) {
      return res.status(429).json({
        success: false,
        error: 'Too many votes. Please wait before voting again.'
      });
    }
    
    // Add vote to database
    dbHelpers.addVote({
      pollId,
      optionIndex,
      ipAddress,
      fingerprint
    });
    
    // Get updated poll results
    const updatedPoll = dbHelpers.getPoll(pollId);
    
    res.json({
      success: true,
      message: 'Vote recorded successfully',
      results: updatedPoll.results,
      totalVotes: updatedPoll.results.reduce((a, b) => a + b, 0)
    });
    
  } catch (error) {
    console.error('Error submitting vote:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to submit vote'
    });
  }
});

module.exports = router;

