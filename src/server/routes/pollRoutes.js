const express = require('express');
const router = express.Router();
const { dbHelpers } = require('../database');
const { generatePollId } = require('../utils/pollGenerator');
const { validatePollData } = require('../utils/antiAbuse');
const { validatePollId, requireBody } = require('../middleware/validation');
const { createPollLimiter, getPollLimiter } = require('../middleware/rateLimit');

/**
 * POST /api/polls
 * Create a new poll
 */
router.post('/', createPollLimiter, requireBody, (req, res) => {
  try {
    const { question, options } = req.body;
    
    // Validate poll data
    const validation = validatePollData({ question, options });
    if (!validation.valid) {
      return res.status(400).json({
        success: false,
        error: validation.error
      });
    }
    
    // Generate unique poll ID
    const pollId = generatePollId();
    
    // Create poll in database
    const poll = dbHelpers.createPoll({
      id: pollId,
      question: validation.sanitized.question,
      options: validation.sanitized.options
    });
    
    // Return poll data with share URL
    res.status(201).json({
      success: true,
      poll: {
        id: poll.id,
        question: poll.question,
        options: poll.options,
        shareUrl: `/poll/${poll.id}`
      }
    });
    
  } catch (error) {
    console.error('Error creating poll:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create poll'
    });
  }
});

/**
 * GET /api/polls/:pollId
 * Get poll data and results
 */
router.get('/:pollId', getPollLimiter, validatePollId, (req, res) => {
  try {
    const { pollId } = req.params;
    
    // Get poll from database
    const poll = dbHelpers.getPoll(pollId);
    
    if (!poll) {
      return res.status(404).json({
        success: false,
        error: 'Poll not found'
      });
    }
    
    // Return poll data
    res.json({
      success: true,
      poll: {
        id: poll.id,
        question: poll.question,
        options: poll.options,
        results: poll.results,
        totalVotes: poll.results.reduce((a, b) => a + b, 0),
        createdAt: poll.created_at
      }
    });
    
  } catch (error) {
    console.error('Error getting poll:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get poll'
    });
  }
});

/**
 * GET /api/polls
 * Get all polls (optional feature for homepage)
 */
router.get('/', getPollLimiter, (req, res) => {
  try {
    const polls = dbHelpers.getAllPolls();
    
    res.json({
      success: true,
      polls: polls.map(poll => ({
        id: poll.id,
        question: poll.question,
        voteCount: poll.vote_count,
        createdAt: poll.created_at
      }))
    });
    
  } catch (error) {
    console.error('Error getting polls:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get polls'
    });
  }
});

module.exports = router;