const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

// Create database directory if it doesn't exist
const dbDir = path.join(__dirname, '../../database');
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

const dbPath = path.join(dbDir, 'polls.db');
const db = new Database(dbPath);

// Enable WAL mode for better concurrency
db.pragma('journal_mode = WAL');

// Initialize database schema
function initializeDatabase() {
  // Create polls table
  db.exec(`
    CREATE TABLE IF NOT EXISTS polls (
      id TEXT PRIMARY KEY,
      question TEXT NOT NULL,
      options TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      vote_count INTEGER DEFAULT 0
    )
  `);

  // Create votes table
  db.exec(`
    CREATE TABLE IF NOT EXISTS votes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      poll_id TEXT NOT NULL,
      option_index INTEGER NOT NULL,
      ip_address TEXT,
      fingerprint TEXT,
      voted_at INTEGER NOT NULL,
      FOREIGN KEY (poll_id) REFERENCES polls(id) ON DELETE CASCADE
    )
  `);

  // Create index for faster queries
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_votes_poll_id ON votes(poll_id)
  `);

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_votes_ip ON votes(poll_id, ip_address)
  `);

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_votes_fingerprint ON votes(poll_id, fingerprint)
  `);

  console.log('✅ Database initialized successfully');
}

// Initialize database on import
initializeDatabase();

// Prepared statements for better performance (created after initialization)
const statements = {
  // Poll operations
  createPoll: db.prepare(`
    INSERT INTO polls (id, question, options, created_at)
    VALUES (?, ?, ?, ?)
  `),

  getPoll: db.prepare(`
    SELECT * FROM polls WHERE id = ?
  `),

  updateVoteCount: db.prepare(`
    UPDATE polls SET vote_count = vote_count + 1 WHERE id = ?
  `),

  // Vote operations
  createVote: db.prepare(`
    INSERT INTO votes (poll_id, option_index, ip_address, fingerprint, voted_at)
    VALUES (?, ?, ?, ?, ?)
  `),

  getVotesByPoll: db.prepare(`
    SELECT option_index, COUNT(*) as count
    FROM votes
    WHERE poll_id = ?
    GROUP BY option_index
  `),

  checkVoteByIP: db.prepare(`
    SELECT COUNT(*) as count
    FROM votes
    WHERE poll_id = ? AND ip_address = ?
  `),

  checkVoteByFingerprint: db.prepare(`
    SELECT COUNT(*) as count
    FROM votes
    WHERE poll_id = ? AND fingerprint = ?
  `),

  getRecentVotesByIP: db.prepare(`
    SELECT COUNT(*) as count
    FROM votes
    WHERE poll_id = ? AND ip_address = ? AND voted_at > ?
  `),

  getAllPolls: db.prepare(`
    SELECT id, question, created_at, vote_count
    FROM polls
    ORDER BY created_at DESC
    LIMIT 100
  `)
};

// Database helper functions
const dbHelpers = {
  createPoll(pollData) {
    const { id, question, options } = pollData;
    const optionsJson = JSON.stringify(options);
    const createdAt = Date.now();
    
    try {
      statements.createPoll.run(id, question, optionsJson, createdAt);
      return { id, question, options, createdAt, voteCount: 0 };
    } catch (error) {
      console.error('Error creating poll:', error);
      throw error;
    }
  },

  getPoll(pollId) {
    try {
      const poll = statements.getPoll.get(pollId);
      if (!poll) return null;

      // Parse options from JSON
      poll.options = JSON.parse(poll.options);
      
      // Get vote counts
      const votes = statements.getVotesByPoll.all(pollId);
      poll.results = poll.options.map(() => 0);
      
      votes.forEach(vote => {
        if (vote.option_index < poll.results.length) {
          poll.results[vote.option_index] = vote.count;
        }
      });

      return poll;
    } catch (error) {
      console.error('Error getting poll:', error);
      throw error;
    }
  },

  addVote(voteData) {
    const { pollId, optionIndex, ipAddress, fingerprint } = voteData;
    const votedAt = Date.now();

    try {
      // Start a transaction
      const transaction = db.transaction(() => {
        statements.createVote.run(pollId, optionIndex, ipAddress, fingerprint, votedAt);
        statements.updateVoteCount.run(pollId);
      });

      transaction();
      return true;
    } catch (error) {
      console.error('Error adding vote:', error);
      throw error;
    }
  },

  hasVotedByIP(pollId, ipAddress) {
    try {
      const result = statements.checkVoteByIP.get(pollId, ipAddress);
      return result.count > 0;
    } catch (error) {
      console.error('Error checking IP vote:', error);
      return false;
    }
  },

  hasVotedByFingerprint(pollId, fingerprint) {
    try {
      const result = statements.checkVoteByFingerprint.get(pollId, fingerprint);
      return result.count > 0;
    } catch (error) {
      console.error('Error checking fingerprint vote:', error);
      return false;
    }
  },

  getRecentVoteCount(pollId, ipAddress, timeWindowMs) {
    try {
      const cutoffTime = Date.now() - timeWindowMs;
      const result = statements.getRecentVotesByIP.get(pollId, ipAddress, cutoffTime);
      return result.count;
    } catch (error) {
      console.error('Error getting recent votes:', error);
      return 0;
    }
  },

  getAllPolls() {
    try {
      return statements.getAllPolls.all();
    } catch (error) {
      console.error('Error getting all polls:', error);
      return [];
    }
  }
};

module.exports = {
  db,
  dbHelpers,
  initializeDatabase
};