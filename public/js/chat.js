/**
 * Chat UI Manager — Renders messages, typing indicator, and source citations
 */
const ChatManager = (() => {
  const container = () => document.getElementById('messagesContainer');
  const welcomeMsg = () => document.getElementById('welcomeMessage');

  /**
   * Add a user message to the chat.
   */
  function addUserMessage(text) {
    hideWelcome();
    const msg = createMessageElement('user', text);
    container().appendChild(msg);
    scrollToBottom();
  }

  /**
   * Add an AI message with optional source citations.
   */
  function addAIMessage(text, sources = []) {
    hideWelcome();
    removeTypingIndicator();

    const msg = createMessageElement('assistant', text, sources);
    container().appendChild(msg);
    scrollToBottom();
  }

  /**
   * Add an error message to the chat.
   */
  function addErrorMessage(text) {
    removeTypingIndicator();

    const msgDiv = document.createElement('div');
    msgDiv.className = 'message error assistant';
    msgDiv.innerHTML = `
      <div class="message-avatar">
        <i class="bi bi-exclamation-triangle-fill"></i>
      </div>
      <div class="message-content">
        <div class="message-text">${escapeHtml(text)}</div>
      </div>
    `;
    container().appendChild(msgDiv);
    scrollToBottom();
  }

  /**
   * Show typing indicator.
   */
  function showTypingIndicator() {
    // Remove existing one first
    removeTypingIndicator();

    const msgDiv = document.createElement('div');
    msgDiv.className = 'message assistant';
    msgDiv.id = 'typingIndicator';
    msgDiv.innerHTML = `
      <div class="message-avatar">
        <i class="bi bi-robot"></i>
      </div>
      <div class="message-content">
        <div class="typing-indicator">
          <span></span><span></span><span></span>
        </div>
      </div>
    `;
    container().appendChild(msgDiv);
    scrollToBottom();
  }

  /**
   * Remove typing indicator.
   */
  function removeTypingIndicator() {
    const el = document.getElementById('typingIndicator');
    if (el) el.remove();
  }

  /**
   * Clear all messages and show welcome screen.
   */
  function clearMessages() {
    const c = container();
    // Remove all messages but keep welcome
    const messages = c.querySelectorAll('.message');
    messages.forEach((m) => m.remove());
    showWelcome();
  }

  /**
   * Restore chat history from server data.
   */
  function restoreHistory(history) {
    if (!history || history.length === 0) return;
    hideWelcome();
    history.forEach((msg) => {
      if (msg.role === 'user') {
        addUserMessage(msg.content);
      } else {
        addAIMessage(msg.content, msg.sources || []);
      }
    });
  }

  // --- Private Helpers ---

  function createMessageElement(role, text, sources = []) {
    const msgDiv = document.createElement('div');
    msgDiv.className = `message ${role}`;

    const avatarIcon = role === 'user' ? 'bi-person-fill' : 'bi-robot';

    let sourcesHtml = '';
    if (sources && sources.length > 0) {
      // Create a unique ID for this message's sources so we can store/retrieve it
      const sourceDataId = 'src-' + Math.random().toString(36).substring(2, 10);
      window.__sourceData = window.__sourceData || {};
      window.__sourceData[sourceDataId] = sources;

      sourcesHtml = `
        <div class="message-sources-wrapper">
          <button type="button" class="source-badge btn-ghost" 
            onclick="ChatManager.openSourcesDrawer('${sourceDataId}')"
            data-bs-toggle="offcanvas" data-bs-target="#sourcesDrawer">
            <i class="bi bi-file-earmark-pdf"></i> Sources
          </button>
        </div>`;
    }

    const formattedText = (window.marked && window.DOMPurify) 
      ? DOMPurify.sanitize(marked.parse(text)) 
      : escapeHtml(text);

    msgDiv.innerHTML = `
      <div class="message-avatar">
        <i class="bi ${avatarIcon}"></i>
      </div>
      <div class="message-content">
        <div class="message-text">${formattedText}</div>
        ${sourcesHtml}
      </div>
    `;

    return msgDiv;
  }

  function hideWelcome() {
    const w = welcomeMsg();
    if (w) w.style.display = 'none';
  }

  function showWelcome() {
    const w = welcomeMsg();
    if (w) w.style.display = '';
  }

  function scrollToBottom() {
    const c = container();
    requestAnimationFrame(() => {
      c.scrollTop = c.scrollHeight;
    });
  }

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  function openSourcesDrawer(sourceDataId) {
    const sources = window.__sourceData && window.__sourceData[sourceDataId] ? window.__sourceData[sourceDataId] : [];
    const container = document.getElementById('sourcesDrawerContent');
    if (!container) return;

    if (sources.length === 0) {
      container.innerHTML = '<p class="text-muted small">No source information available.</p>';
      return;
    }

    container.innerHTML = sources.map(s => `
      <div class="source-item p-3 rounded border" style="background: var(--bg-secondary);">
        <div class="source-header mb-2 fw-semibold d-flex align-items-center gap-2" style="font-size: 0.85rem;">
          <i class="bi bi-file-earmark-text text-primary"></i>
          <span>${escapeHtml(s.documentName)}</span>
        </div>
        ${s.excerpt ? `<div class="source-excerpt text-muted" style="font-size: 0.8rem; font-style: italic;">"${escapeHtml(s.excerpt)}"</div>` : ''}
      </div>
    `).join('');
  }

  return {
    addUserMessage,
    addAIMessage,
    addErrorMessage,
    showTypingIndicator,
    removeTypingIndicator,
    clearMessages,
    restoreHistory,
    openSourcesDrawer,
  };
})();
