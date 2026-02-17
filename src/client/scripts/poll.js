/**
 * Poll Viewing & Voting Page JavaScript
 */

// State
let pollData = null;
let hasVoted = false;
let selectedOption = null;

// DOM Elements
const loadingCard = document.getElementById('loading-card');
const errorCard = document.getElementById('error-card');
const pollCard = document.getElementById('poll-card');
const headerSubtitle = document.getElementById('header-subtitle');
const pollQuestion = document.getElementById('poll-question');
const votingSection = document.getElementById('voting-section');
const resultsSection = document.getElementById('results-section');
const voteForm = document.getElementById('vote-form');
const pollOptions = document.getElementById('poll-options');
const voteBtn = document.getElementById('vote-btn');
const voteText = document.getElementById('vote-text');
const voteSpinner = document.getElementById('vote-spinner');
const resultsContainer = document.getElementById('results-container');
const totalVotesEl = document.getElementById('total-votes');
const shareLinkInput = document.getElementById('share-link');
const copyBtn = document.getElementById('copy-btn');
const alertContainer = document.getElementById('alert-container');

// Get poll ID from URL
const pollId = window.location.pathname.split('/').pop();

// Initialize
document.addEventListener('DOMContentLoaded', async () => {
  // Check if user has already voted (localStorage)
  hasVoted = checkIfVoted();
  
  // Setup event listeners
  setupEventListeners();
  
  // Load poll data
  await loadPoll();
  
  // Connect to Socket.io for real-time updates
  if (pollData) {
    connectSocket();
  }
});

/**
 * Setup event listeners
 */
function setupEventListeners() {
  // Vote form submission
  voteForm.addEventListener('submit', handleVoteSubmit);
  
  // Copy link button
  copyBtn.addEventListener('click', copyShareLink);
  
  // Cleanup on page unload
  window.addEventListener('beforeunload', () => {
    socketClient.disconnect();
  });
}

/**
 * Load poll data from API
 */
async function loadPoll() {
  try {
    const response = await fetch(`/api/polls/${pollId}`);
    const data = await response.json();
    
    if (!response.ok || !data.success) {
      throw new Error(data.error || 'Failed to load poll');
    }
    
    pollData = data.poll;
    
    // Update UI
    renderPoll();
    
  } catch (error) {
    console.error('Error loading poll:', error);
    showError();
  }
}

/**
 * Render poll UI
 */
function renderPoll() {
  // Hide loading, show poll
  loadingCard.classList.add('hidden');
  pollCard.classList.remove('hidden');
  
  // Update header
  headerSubtitle.textContent = 'Vote and see results in real-time';
  
  // Update question
  pollQuestion.textContent = pollData.question;
  
  // Set share link
  shareLinkInput.value = window.location.href;
  
  // Render options or results based on vote status
  if (hasVoted) {
    showResults();
  } else {
    renderVotingOptions();
    resultsSection.style.display = 'none';
  }
}

/**
 * Render voting options
 */
function renderVotingOptions() {
  pollOptions.innerHTML = '';
  
  pollData.options.forEach((option, index) => {
    const optionDiv = document.createElement('div');
    optionDiv.className = 'poll-option';
    
    const radio = document.createElement('input');
    radio.type = 'radio';
    radio.name = 'poll-option';
    radio.id = `option-${index}`;
    radio.value = index;
    radio.addEventListener('change', () => {
      selectedOption = index;
    });
    
    const label = document.createElement('label');
    label.htmlFor = `option-${index}`;
    label.textContent = option;
    
    optionDiv.appendChild(radio);
    optionDiv.appendChild(label);
    pollOptions.appendChild(optionDiv);
  });
  
  votingSection.style.display = 'block';
}

/**
 * Handle vote submission
 */
async function handleVoteSubmit(e) {
  e.preventDefault();
  
  // Clear previous alerts
  alertContainer.innerHTML = '';
  
  // Validate selection
  if (selectedOption === null) {
    showAlert('Please select an option', 'error');
    return;
  }
  
  // Generate browser fingerprint
  const fingerprint = generateFingerprint();
  
  // Set loading state
  setVoteLoading(true);
  
  try {
    // Submit vote
    const response = await fetch('/api/votes', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        pollId,
        optionIndex: selectedOption,
        fingerprint
      })
    });
    
    const data = await response.json();
    
    if (!response.ok || !data.success) {
      throw new Error(data.error || 'Failed to submit vote');
    }
    
    // Update poll data with new results
    pollData.results = data.results;
    
    // Mark as voted
    markAsVoted();
    
    // Notify server via Socket.io
    socketClient.notifyVote(pollId);
    
    // Show results
    showResults();
    
    // Show success message
    showAlert('Vote submitted successfully!', 'success');
    
  } catch (error) {
    console.error('Error submitting vote:', error);
    showAlert(error.message || 'Failed to submit vote. Please try again.', 'error');
    setVoteLoading(false);
  }
}

/**
 * Show results section
 */
function showResults() {
  votingSection.style.display = 'none';
  resultsSection.style.display = 'block';
  
  renderResults();
}

/**
 * Render results bars
 */
function renderResults() {
  if (!pollData || !pollData.results) return;
  
  resultsContainer.innerHTML = '';
  
  const totalVotes = pollData.results.reduce((a, b) => a + b, 0);
  totalVotesEl.textContent = totalVotes;
  
  pollData.options.forEach((option, index) => {
    const votes = pollData.results[index] || 0;
    const percentage = totalVotes > 0 ? (votes / totalVotes * 100).toFixed(1) : 0;
    
    const resultItem = document.createElement('div');
    resultItem.className = 'result-item';
    
    resultItem.innerHTML = `
      <div class="result-label">
        <span>${option}</span>
        <span class="result-count">${votes} vote${votes !== 1 ? 's' : ''}</span>
      </div>
      <div class="result-bar-container">
        <div class="result-bar" style="width: ${percentage}%;">
          <span class="result-percentage">${percentage}%</span>
        </div>
      </div>
    `;
    
    resultsContainer.appendChild(resultItem);
  });
}

/**
 * Update results (called on real-time update)
 */
function updateResults(data) {
  if (!pollData) return;
  
  pollData.results = data.results;
  renderResults();
  
  console.log('📊 Results updated in real-time');
}

/**
 * Connect to Socket.io
 */
function connectSocket() {
  socketClient.connect();
  socketClient.joinPoll(pollId);
  
  // Listen for real-time updates
  socketClient.onPollUpdate((data) => {
    updateResults(data);
  });
  
  console.log('🔌 Connected to real-time updates');
}

/**
 * Generate browser fingerprint
 */
function generateFingerprint() {
  const components = [
    navigator.userAgent,
    navigator.language,
    screen.colorDepth,
    screen.width + 'x' + screen.height,
    new Date().getTimezoneOffset(),
    !!window.sessionStorage,
    !!window.localStorage
  ];
  
  const fingerprintString = components.join('|');
  
  // Simple hash function
  let hash = 0;
  for (let i = 0; i < fingerprintString.length; i++) {
    const char = fingerprintString.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  
  return hash.toString(36);
}

/**
 * Check if user has already voted
 */
function checkIfVoted() {
  try {
    const voted = localStorage.getItem(`voted_${pollId}`);
    return voted === 'true';
  } catch (error) {
    console.error('LocalStorage error:', error);
    return false;
  }
}

/**
 * Mark user as voted
 */
function markAsVoted() {
  try {
    localStorage.setItem(`voted_${pollId}`, 'true');
    hasVoted = true;
  } catch (error) {
    console.error('LocalStorage error:', error);
  }
}

/**
 * Copy share link to clipboard
 */
async function copyShareLink() {
  try {
    await navigator.clipboard.writeText(shareLinkInput.value);
    
    const originalText = copyBtn.textContent;
    copyBtn.textContent = '✓ Copied!';
    copyBtn.classList.add('copied');
    
    setTimeout(() => {
      copyBtn.textContent = originalText;
      copyBtn.classList.remove('copied');
    }, 2000);
    
  } catch (error) {
    console.error('Failed to copy:', error);
    shareLinkInput.select();
    document.execCommand('copy');
  }
}

/**
 * Show error state
 */
function showError() {
  loadingCard.classList.add('hidden');
  errorCard.classList.remove('hidden');
  headerSubtitle.textContent = 'Poll not found';
}

/**
 * Show alert message
 */
function showAlert(message, type = 'info') {
  const alert = document.createElement('div');
  alert.className = `alert alert-${type}`;
  
  const icon = type === 'error' ? '❌' : type === 'success' ? '✅' : 'ℹ️';
  alert.innerHTML = `<span>${icon}</span><span>${message}</span>`;
  
  alertContainer.innerHTML = '';
  alertContainer.appendChild(alert);
  
  setTimeout(() => {
    alert.remove();
  }, 5000);
}

/**
 * Set vote loading state
 */
function setVoteLoading(loading) {
  voteBtn.disabled = loading;
  voteText.style.display = loading ? 'none' : 'inline';
  voteSpinner.classList.toggle('hidden', !loading);
  
  const radioButtons = pollOptions.querySelectorAll('input[type="radio"]');
  radioButtons.forEach(radio => radio.disabled = loading);
}


