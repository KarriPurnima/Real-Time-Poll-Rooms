const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const helmet = require('helmet');
const cors = require('cors');
require('dotenv').config();

const { dbHelpers } = require('./database');
const pollRoutes = require('./routes/pollRoutes');
const voteRoutes = require('./routes/voteRoutes');
const { apiLimiter } = require('./middleware/rateLimit');

// Initialize Express app
const app = express();
const server = http.createServer(app);

// Initialize Socket.io
const io = new Server(server, {
  cors: {
    origin: process.env.CLIENT_URL || '*',
    methods: ['GET', 'POST']
  }
});

// Port configuration
const PORT = process.env.PORT || 3000;

// Security middleware
app.use(helmet({
  contentSecurityPolicy: false, // Disable for Socket.io to work
  crossOriginEmbedderPolicy: false
}));

// CORS configuration
app.use(cors());

// Body parsing middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Apply global rate limiting
app.use('/api/', apiLimiter);

// Serve static files from client directory
app.use(express.static(path.join(__dirname, '../client')));

// API Routes
app.use('/api/polls', pollRoutes);
app.use('/api/votes', voteRoutes);

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ 
    success: true, 
    status: 'healthy',
    timestamp: new Date().toISOString()
  });
});

// Serve client pages
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../client/index.html'));
});

app.get('/create', (req, res) => {
  res.sendFile(path.join(__dirname, '../client/create.html'));
});

app.get('/poll/:pollId', (req, res) => {
  res.sendFile(path.join(__dirname, '../client/poll.html'));
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: 'Route not found'
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Server error:', err);
  res.status(500).json({
    success: false,
    error: 'Internal server error'
  });
});

// Socket.io connection handling
io.on('connection', (socket) => {
  console.log(`✅ Client connected: ${socket.id}`);
  
  // Join a poll room
  socket.on('join-poll', (pollId) => {
    if (!pollId) return;
    
    socket.join(`poll-${pollId}`);
    console.log(`📊 Client ${socket.id} joined poll: ${pollId}`);
    
    // Send current poll data
    try {
      const poll = dbHelpers.getPoll(pollId);
      if (poll) {
        socket.emit('poll-data', {
          id: poll.id,
          question: poll.question,
          options: poll.options,
          results: poll.results,
          totalVotes: poll.results.reduce((a, b) => a + b, 0)
        });
      }
    } catch (error) {
      console.error('Error sending poll data:', error);
    }
  });
  
  // Handle vote submission (real-time broadcast)
  socket.on('vote-submitted', (data) => {
    const { pollId } = data;
    if (!pollId) return;
    
    try {
      // Get updated poll data
      const poll = dbHelpers.getPoll(pollId);
      if (poll) {
        // Broadcast updated results to all clients in the poll room
        io.to(`poll-${pollId}`).emit('poll-updated', {
          results: poll.results,
          totalVotes: poll.results.reduce((a, b) => a + b, 0)
        });
        
        console.log(`📢 Broadcasted vote update for poll: ${pollId}`);
      }
    } catch (error) {
      console.error('Error broadcasting vote:', error);
    }
  });
  
  // Leave poll room
  socket.on('leave-poll', (pollId) => {
    if (!pollId) return;
    socket.leave(`poll-${pollId}`);
    console.log(`👋 Client ${socket.id} left poll: ${pollId}`);
  });
  
  // Handle disconnection
  socket.on('disconnect', () => {
    console.log(`❌ Client disconnected: ${socket.id}`);
  });
});

// Start server
server.listen(PORT, () => {
  console.log(`
╔═══════════════════════════════════════════╗
║   🚀 Real-Time Poll Rooms Server          ║
║   📡 Port: ${PORT}                      ║
║   🌐 http://localhost:${PORT}            ║
╚═══════════════════════════════════════════╝
  `);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received. Closing server gracefully...');
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('SIGINT received. Closing server gracefully...');
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});

module.exports = { app, server, io };