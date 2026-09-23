/**
 * App — Main application controller
 * Initializes session, binds events, and coordinates modules.
 */
const App = (() => {
  const SESSION_KEY = 'docchat-session-id';
  let sessionId = null;

  /**
   * Initialize the application.
   */
  async function init() {
    // Initialize session
    await initSession();

    // Initialize modules
    UploadManager.init();

    // Bind events
    bindEvents();

    // Load existing data if session was restored
    await UploadManager.refreshDocuments();
    await loadChatHistory();
  }

  /**
   * Get or create a session from the server.
   */
  async function initSession() {
    // Check for existing session
    sessionId = sessionStorage.getItem(SESSION_KEY);

    try {
      const response = await fetch('/api/session', {
        headers: sessionId ? { 'x-session-id': sessionId } : {},
      });
      const data = await response.json();
      sessionId = data.sessionId;
      sessionStorage.setItem(SESSION_KEY, sessionId);
    } catch (err) {
      console.error('Failed to initialize session:', err);
      showToast('Failed to connect to the server. Please refresh the page.', 'error');
    }
  }

  /**
   * Get the current session ID.
   */
  function getSessionId() {
    return sessionId;
  }

  /**
   * Bind all event handlers.
   */
  function bindEvents() {
    // Chat form submission
    const chatForm = document.getElementById('chatForm');
    const chatInput = document.getElementById('chatInput');
    const sendBtn = document.getElementById('sendBtn');

    if (chatForm) {
      chatForm.addEventListener('submit', (e) => {
        e.preventDefault();
        sendMessage();
      });
    }

    // Enable/disable send button based on input
    if (chatInput) {
      chatInput.addEventListener('input', () => {
        const hasText = chatInput.value.trim().length > 0;
        sendBtn.disabled = !hasText || chatInput.disabled;
        autoResizeTextarea(chatInput);
      });

      // Enter to send, Shift+Enter for new line
      chatInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          if (!sendBtn.disabled) {
            sendMessage();
          }
        }
      });
    }

    // Clear chat button
    const clearChatBtn = document.getElementById('clearChatBtn');
    if (clearChatBtn) {
      clearChatBtn.addEventListener('click', clearChat);
    }

    // End session button
    const endSessionBtn = document.getElementById('endSessionBtn');
    if (endSessionBtn) {
      endSessionBtn.addEventListener('click', endSession);
    }

    // Sidebar logic handled by Bootstrap Offcanvas
  }

  /**
   * Send a message to the chat API.
   */
  async function sendMessage() {
    const chatInput = document.getElementById('chatInput');
    const sendBtn = document.getElementById('sendBtn');
    const question = chatInput.value.trim();

    if (!question) return;

    // Add user message to UI
    ChatManager.addUserMessage(question);
    chatInput.value = '';
    chatInput.style.height = 'auto';
    sendBtn.disabled = true;

    // Show typing indicator
    ChatManager.showTypingIndicator();
    updateStatus('Thinking...');

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-session-id': sessionId,
        },
        body: JSON.stringify({ question }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to get a response');
      }

      // Add AI response with sources
      ChatManager.addAIMessage(data.answer, data.sources || []);
      updateStatus('Ready');
    } catch (err) {
      ChatManager.addErrorMessage(err.message);
      updateStatus('Error');
      setTimeout(() => updateStatus('Ready'), 3000);
    }
  }

  /**
   * Clear chat history (does NOT affect documents).
   */
  async function clearChat() {
    try {
      await fetch('/api/chat/history', {
        method: 'DELETE',
        headers: { 'x-session-id': sessionId },
      });
      ChatManager.clearMessages();
      showToast('Conversation cleared.', 'info');
    } catch (err) {
      showToast('Failed to clear conversation.', 'error');
    }
  }

  /**
   * End the session, clean up all data.
   */
  async function endSession() {
    if (!confirm('End this session? All uploaded documents and conversation history will be deleted.')) {
      return;
    }

    try {
      await fetch('/api/session/end', {
        method: 'POST',
        headers: { 'x-session-id': sessionId },
      });
      sessionStorage.removeItem(SESSION_KEY);
      showToast('Session ended. Starting a new session...', 'info');
      setTimeout(() => window.location.reload(), 1500);
    } catch (err) {
      showToast('Failed to end session properly.', 'error');
    }
  }

  /**
   * Load existing chat history from server.
   */
  async function loadChatHistory() {
    if (!sessionId) return;
    try {
      const response = await fetch('/api/chat/history', {
        headers: { 'x-session-id': sessionId },
      });
      const data = await response.json();
      if (data.history && data.history.length > 0) {
        ChatManager.restoreHistory(data.history);
      }
    } catch (err) {
      console.error('Failed to load chat history:', err);
    }
  }

  /**
   * Show a toast notification.
   */
  function showToast(message, type = 'info') {
    const container = document.getElementById('toastContainer');
    if (!container) return;

    const typeIcons = {
      success: 'bi-check-circle-fill',
      error: 'bi-x-circle-fill',
      warning: 'bi-exclamation-triangle-fill',
      info: 'bi-info-circle-fill',
    };

    const toastId = 'toast-' + Date.now();
    const toastEl = document.createElement('div');
    toastEl.className = `toast custom-toast toast-${type}`;
    toastEl.id = toastId;
    toastEl.setAttribute('role', 'alert');
    toastEl.setAttribute('aria-live', 'assertive');
    toastEl.innerHTML = `
      <div class="toast-header">
        <i class="bi ${typeIcons[type] || typeIcons.info} me-2" style="color: var(--${type === 'error' ? 'danger' : type})"></i>
        <strong class="me-auto">${type.charAt(0).toUpperCase() + type.slice(1)}</strong>
        <button type="button" class="btn-close btn-close-white" data-bs-dismiss="toast" aria-label="Close"></button>
      </div>
      <div class="toast-body">${escapeHtml(message)}</div>
    `;

    container.appendChild(toastEl);
    const toast = new bootstrap.Toast(toastEl, { delay: 5000 });
    toast.show();

    // Remove from DOM after hidden
    toastEl.addEventListener('hidden.bs.toast', () => toastEl.remove());
  }

  /**
   * Update the status indicator text.
   */
  function updateStatus(text) {
    const el = document.getElementById('statusIndicator');
    if (el) el.textContent = text;
  }

  /**
   * Auto-resize textarea to fit content.
   */
  function autoResizeTextarea(textarea) {
    textarea.style.height = 'auto';
    textarea.style.height = Math.min(textarea.scrollHeight, 120) + 'px';
  }

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  return { init, getSessionId, showToast };
})();

// Initialize app on DOM ready
document.addEventListener('DOMContentLoaded', () => App.init());
