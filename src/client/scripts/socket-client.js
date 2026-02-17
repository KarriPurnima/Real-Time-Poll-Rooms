/**
 * Socket.io client wrapper
 * Handles real-time communication with the server
 */

class SocketClient {
  constructor() {
    this.socket = null;
    this.connected = false;
    this.currentPollId = null;
  }

  /**
   * Initialize Socket.io connection
   */
  connect() {
    if (this.socket) return;

    try {
      // Connect to the same host
      this.socket = io({
        transports: ['websocket', 'polling'],
        reconnection: true,
        reconnectionDelay: 1000,
        reconnectionAttempts: 5
      });

      this.setupEventHandlers();
      console.log('🔌 Socket.io client initialized');
    } catch (error) {
      console.error('Failed to initialize Socket.io:', error);
    }
  }

  /**
   * Setup socket event handlers
   */
  setupEventHandlers() {
    this.socket.on('connect', () => {
      this.connected = true;
      console.log('✅ Connected to server');
      
      // Rejoin poll room if we were in one
      if (this.currentPollId) {
        this.joinPoll(this.currentPollId);
      }
    });

    this.socket.on('disconnect', (reason) => {
      this.connected = false;
      console.log('❌ Disconnected from server:', reason);
    });

    this.socket.on('connect_error', (error) => {
      console.error('Connection error:', error);
    });

    this.socket.on('reconnect', (attemptNumber) => {
      console.log(`🔄 Reconnected after ${attemptNumber} attempts`);
    });
  }

  /**
   * Join a poll room
   * @param {string} pollId 
   */
  joinPoll(pollId) {
    if (!this.socket || !pollId) return;
    
    this.currentPollId = pollId;
    this.socket.emit('join-poll', pollId);
    console.log(`📊 Joined poll room: ${pollId}`);
  }

  /**
   * Leave a poll room
   * @param {string} pollId 
   */
  leavePoll(pollId) {
    if (!this.socket || !pollId) return;
    
    this.socket.emit('leave-poll', pollId);
    this.currentPollId = null;
    console.log(`👋 Left poll room: ${pollId}`);
  }

  /**
   * Notify server of a vote submission
   * @param {string} pollId 
   */
  notifyVote(pollId) {
    if (!this.socket || !pollId) return;
    
    this.socket.emit('vote-submitted', { pollId });
    console.log(`🗳️ Notified vote submission for poll: ${pollId}`);
  }

  /**
   * Listen for poll data updates
   * @param {Function} callback 
   */
  onPollData(callback) {
    if (!this.socket) return;
    
    this.socket.on('poll-data', callback);
  }

  /**
   * Listen for poll updates (real-time results)
   * @param {Function} callback 
   */
  onPollUpdate(callback) {
    if (!this.socket) return;
    
    this.socket.on('poll-updated', callback);
  }

  /**
   * Remove all event listeners
   */
  removeAllListeners() {
    if (!this.socket) return;
    
    this.socket.off('poll-data');
    this.socket.off('poll-updated');
  }

  /**
   * Disconnect from server
   */
  disconnect() {
    if (!this.socket) return;
    
    if (this.currentPollId) {
      this.leavePoll(this.currentPollId);
    }
    
    this.socket.disconnect();
    this.connected = false;
    console.log('🔌 Disconnected from server');
  }

  /**
   * Check if connected
   * @returns {boolean}
   */
  isConnected() {
    return this.connected && this.socket && this.socket.connected;
  }
}

// Export singleton instance
const socketClient = new SocketClient();