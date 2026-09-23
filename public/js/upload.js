/**
 * Upload Manager — Handles file upload flow, document list, and drag-and-drop
 */
const UploadManager = (() => {
  const FILE_ICONS = {
    pdf: 'bi-file-earmark-pdf-fill',
    txt: 'bi-file-earmark-text-fill',
    docx: 'bi-file-earmark-word-fill',
    csv: 'bi-file-earmark-spreadsheet-fill',
  };

  let isUploading = false;

  function init() {
    const uploadZone = document.getElementById('uploadZone');
    const fileInput = document.getElementById('fileInput');

    if (!uploadZone || !fileInput) return;

    // Click to browse
    uploadZone.addEventListener('click', (e) => {
      if (!isUploading) fileInput.click();
    });

    // File selected
    fileInput.addEventListener('change', (e) => {
      if (e.target.files.length > 0) {
        uploadFile(e.target.files[0]);
        e.target.value = ''; // Reset so same file can be re-uploaded
      }
    });

    // Drag and drop
    uploadZone.addEventListener('dragover', (e) => {
      e.preventDefault();
      uploadZone.classList.add('dragover');
    });

    uploadZone.addEventListener('dragleave', () => {
      uploadZone.classList.remove('dragover');
    });

    uploadZone.addEventListener('drop', (e) => {
      e.preventDefault();
      uploadZone.classList.remove('dragover');
      if (e.dataTransfer.files.length > 0 && !isUploading) {
        uploadFile(e.dataTransfer.files[0]);
      }
    });
  }

  /**
   * Upload a file to the server.
   */
  async function uploadFile(file) {
    if (isUploading) return;

    const sessionId = App.getSessionId();
    if (!sessionId) {
      App.showToast('No active session. Please refresh the page.', 'error');
      return;
    }

    // Client-side validation
    const ext = '.' + file.name.split('.').pop().toLowerCase();
    const allowedExts = ['.pdf', '.txt', '.docx', '.csv'];
    if (!allowedExts.includes(ext)) {
      App.showToast(
        `Unsupported file type: "${ext}". Supported formats: PDF, TXT, DOCX, CSV.`,
        'error'
      );
      return;
    }

    const maxSize = 10 * 1024 * 1024; // 10 MB
    if (file.size > maxSize) {
      App.showToast('File is too large. Maximum allowed size is 10 MB.', 'error');
      return;
    }

    isUploading = true;
    showUploadProgress(`Processing "${file.name}"...`);
    showProcessingBanner(true);

    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await fetch('/api/upload', {
        method: 'POST',
        headers: {
          'x-session-id': sessionId,
        },
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Upload failed');
      }

      // Success
      App.showToast(data.message, 'success');
      addDocumentToList(data.document);
      updateDocCount();
    } catch (err) {
      App.showToast(err.message, 'error');
    } finally {
      isUploading = false;
      hideUploadProgress();
      showProcessingBanner(false);
    }
  }

  /**
   * Add a document item to the sidebar list.
   */
  function addDocumentToList(doc) {
    const list = document.getElementById('documentList');
    const noDocsMsg = document.getElementById('noDocsMessage');
    if (noDocsMsg) noDocsMsg.style.display = 'none';

    const ext = doc.documentName.split('.').pop().toLowerCase();
    const iconClass = FILE_ICONS[ext] || 'bi-file-earmark-fill';

    const item = document.createElement('div');
    item.className = 'document-item';
    item.id = `doc-${doc.documentId}`;
    item.innerHTML = `
      <i class="bi ${iconClass} doc-icon ${ext}"></i>
      <div class="doc-info">
        <div class="doc-name" title="${escapeAttr(doc.documentName)}">${escapeHtml(doc.documentName)}</div>
        <div class="doc-meta">${doc.chunkCount} chunks</div>
      </div>
      <button class="doc-remove" title="Remove document" data-doc-id="${doc.documentId}" data-doc-name="${escapeAttr(doc.documentName)}">
        <i class="bi bi-x-lg"></i>
      </button>
    `;

    // Bind remove button
    item.querySelector('.doc-remove').addEventListener('click', (e) => {
      e.stopPropagation();
      const docId = e.currentTarget.dataset.docId;
      const docName = e.currentTarget.dataset.docName;
      removeDocument(docId, docName);
    });

    list.appendChild(item);
  }

  /**
   * Remove a document from the server and UI.
   */
  async function removeDocument(documentId, documentName) {
    const sessionId = App.getSessionId();
    if (!sessionId) return;

    try {
      const response = await fetch(`/api/documents/${documentId}`, {
        method: 'DELETE',
        headers: {
          'x-session-id': sessionId,
        },
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to remove document');
      }

      // Remove from UI
      const item = document.getElementById(`doc-${documentId}`);
      if (item) {
        item.style.animation = 'fadeIn 0.3s ease reverse';
        setTimeout(() => item.remove(), 250);
      }

      updateDocCount();
      App.showToast(`"${documentName}" removed.`, 'info');

      // Show empty state if no documents left
      setTimeout(() => {
        const list = document.getElementById('documentList');
        if (list && list.querySelectorAll('.document-item').length === 0) {
          const noDocsMsg = document.getElementById('noDocsMessage');
          if (noDocsMsg) noDocsMsg.style.display = '';
        }
      }, 300);
    } catch (err) {
      App.showToast(err.message, 'error');
    }
  }

  /**
   * Refresh document list from server.
   */
  async function refreshDocuments() {
    const sessionId = App.getSessionId();
    if (!sessionId) return;

    try {
      const response = await fetch('/api/documents', {
        headers: { 'x-session-id': sessionId },
      });
      const data = await response.json();

      // Clear existing list
      const list = document.getElementById('documentList');
      const items = list.querySelectorAll('.document-item');
      items.forEach((i) => i.remove());

      if (data.documents && data.documents.length > 0) {
        const noDocsMsg = document.getElementById('noDocsMessage');
        if (noDocsMsg) noDocsMsg.style.display = 'none';

        data.documents.forEach((doc) => addDocumentToList(doc));
      }

      updateDocCount();

      if (data.isProcessing) {
        showProcessingBanner(true);
      }
    } catch (err) {
      console.error('Failed to refresh documents:', err);
    }
  }

  // --- UI Helpers ---

  function showUploadProgress(text) {
    const zone = document.getElementById('uploadZone');
    const content = zone.querySelector('.upload-zone-content');
    const progress = document.getElementById('uploadProgress');
    const progressText = document.getElementById('uploadProgressText');

    if (content) content.style.display = 'none';
    if (progress) {
      progress.classList.remove('d-none');
      progressText.textContent = text;
    }
  }

  function hideUploadProgress() {
    const zone = document.getElementById('uploadZone');
    const content = zone.querySelector('.upload-zone-content');
    const progress = document.getElementById('uploadProgress');

    if (content) content.style.display = '';
    if (progress) progress.classList.add('d-none');
  }

  function showProcessingBanner(show) {
    const banner = document.getElementById('processingBanner');
    if (banner) {
      banner.classList.toggle('d-none', !show);
    }
    // Also disable/enable chat input
    const chatInput = document.getElementById('chatInput');
    const sendBtn = document.getElementById('sendBtn');
    if (chatInput) chatInput.disabled = show;
    if (sendBtn && show) sendBtn.disabled = true;
  }

  function updateDocCount() {
    const count = document.querySelectorAll('.document-item').length;
    const badge = document.getElementById('docCount');
    if (badge) badge.textContent = count;
  }

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  function escapeAttr(str) {
    return str.replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  return { init, refreshDocuments };
})();
