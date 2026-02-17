/**
 * Poll Creation Page JavaScript
 */

// State
let options = ['', ''];

// DOM Elements
const form = document.getElementById('create-poll-form');
const questionInput = document.getElementById('question');
const questionCount = document.getElementById('question-count');
const optionsList = document.getElementById('options-list');
const addOptionBtn = document.getElementById('add-option-btn');
const submitBtn = document.getElementById('submit-btn');
const submitText = document.getElementById('submit-text');
const submitSpinner = document.getElementById('submit-spinner');
const alertContainer = document.getElementById('alert-container');
const shareSection = document.getElementById('share-section');
const shareLinkInput = document.getElementById('share-link');
const copyBtn = document.getElementById('copy-btn');
const viewPollBtn = document.getElementById('view-poll-btn');

// Initialize
document.addEventListener('DOMContentLoaded', () => {
  renderOptions();
  setupEventListeners();
});

/**
 * Setup event listeners
 */
function setupEventListeners() {
  // Question character count
  questionInput.addEventListener('input', updateQuestionCount);
  
  // Add option button
  addOptionBtn.addEventListener('click', addOption);
  
  // Form submission
  form.addEventListener('submit', handleSubmit);
  
  // Copy link button
  copyBtn.addEventListener('click', copyShareLink);
}

/**
 * Update question character count
 */
function updateQuestionCount() {
  const count = questionInput.value.length;
  questionCount.textContent = count;
  
  if (count > 450) {
    questionCount.style.color = 'var(--danger-color)';
  } else {
    questionCount.style.color = 'var(--text-light)';
  }
}

/**
 * Render options list
 */
function renderOptions() {
  optionsList.innerHTML = '';
  
  options.forEach((option, index) => {
    const li = document.createElement('li');
    li.className = 'option-item';
    
    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'form-input';
    input.placeholder = `Option ${index + 1}`;
    input.value = option;
    input.maxLength = 200;
    input.required = true;
    input.addEventListener('input', (e) => updateOption(index, e.target.value));
    
    li.appendChild(input);
    
    // Add remove button if more than 2 options
    if (options.length > 2) {
      const removeBtn = document.createElement('button');
      removeBtn.type = 'button';
      removeBtn.className = 'btn-remove';
      removeBtn.textContent = 'Remove';
      removeBtn.addEventListener('click', () => removeOption(index));
      li.appendChild(removeBtn);
    }
    
    optionsList.appendChild(li);
  });
  
  // Update add button state
  addOptionBtn.disabled = options.length >= 10;
  addOptionBtn.style.opacity = options.length >= 10 ? '0.5' : '1';
  addOptionBtn.style.cursor = options.length >= 10 ? 'not-allowed' : 'pointer';
}

/**
 * Add a new option
 */
function addOption() {
  if (options.length >= 10) {
    showAlert('Maximum 10 options allowed', 'error');
    return;
  }
  
  options.push('');
  renderOptions();
}

/**
 * Update option value
 */
function updateOption(index, value) {
  options[index] = value;
}

/**
 * Remove an option
 */
function removeOption(index) {
  if (options.length <= 2) {
    showAlert('At least 2 options are required', 'error');
    return;
  }
  
  options.splice(index, 1);
  renderOptions();
}

/**
 * Handle form submission
 */
async function handleSubmit(e) {
  e.preventDefault();
  
  // Clear previous alerts
  alertContainer.innerHTML = '';
  
  // Get form data
  const question = questionInput.value.trim();
  const validOptions = options.filter(opt => opt.trim() !== '');
  
  // Validate
  if (!question) {
    showAlert('Please enter a question', 'error');
    return;
  }
  
  if (validOptions.length < 2) {
    showAlert('Please provide at least 2 options', 'error');
    return;
  }
  
  // Disable form
  setLoading(true);
  
  try {
    // Create poll
    const response = await fetch('/api/polls', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        question,
        options: validOptions
      })
    });
    
    const data = await response.json();
    
    if (!response.ok || !data.success) {
      throw new Error(data.error || 'Failed to create poll');
    }
    
    // Show success
    showPollCreated(data.poll);
    
  } catch (error) {
    console.error('Error creating poll:', error);
    showAlert(error.message || 'Failed to create poll. Please try again.', 'error');
    setLoading(false);
  }
}

/**
 * Show poll created success
 */
function showPollCreated(poll) {
  // Hide form
  form.style.display = 'none';
  
  // Show share section
  shareSection.classList.remove('hidden');
  
  // Set share link
  const shareUrl = `${window.location.origin}/poll/${poll.id}`;
  shareLinkInput.value = shareUrl;
  viewPollBtn.href = shareUrl;
  
  // Scroll to share section
  shareSection.scrollIntoView({ behavior: 'smooth' });
  
  // Show success alert
  showAlert('Poll created successfully! Share the link below.', 'success');
}

/**
 * Copy share link to clipboard
 */
async function copyShareLink() {
  try {
    await navigator.clipboard.writeText(shareLinkInput.value);
    
    // Update button
    const originalText = copyBtn.textContent;
    copyBtn.textContent = '✓ Copied!';
    copyBtn.classList.add('copied');
    
    setTimeout(() => {
      copyBtn.textContent = originalText;
      copyBtn.classList.remove('copied');
    }, 2000);
    
  } catch (error) {
    console.error('Failed to copy:', error);
    
    // Fallback: select text
    shareLinkInput.select();
    document.execCommand('copy');
    
    showAlert('Link copied to clipboard!', 'success');
  }
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
  
  // Auto-dismiss after 5 seconds
  setTimeout(() => {
    alert.remove();
  }, 5000);
}

/**
 * Set loading state
 */
function setLoading(loading) {
  submitBtn.disabled = loading;
  submitText.style.display = loading ? 'none' : 'inline';
  submitSpinner.classList.toggle('hidden', !loading);
  
  // Disable all inputs
  questionInput.disabled = loading;
  addOptionBtn.disabled = loading;
  
  const optionInputs = optionsList.querySelectorAll('input');
  optionInputs.forEach(input => input.disabled = loading);
  
  const removeButtons = optionsList.querySelectorAll('.btn-remove');
  removeButtons.forEach(btn => btn.disabled = loading);
}
