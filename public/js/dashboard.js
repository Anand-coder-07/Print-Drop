(() => {
  'use strict';

  // --- Auth Check ---
  fetch('/api/auth/check')
    .then(r => r.json())
    .then(data => {
      if (!data.authenticated) {
        window.location.href = '/login.html';
        return;
      }
      document.getElementById('navUser').textContent = data.username;
      if (data.shop?.name) document.querySelector('.nav-title').textContent = data.shop.name;
      document.getElementById('ownerShopName').textContent = data.shop?.name || 'Your shop';
      const qrImg = document.getElementById('qrImg');
      if (qrImg && data.shop?.slug) qrImg.src = `/api/shops/${encodeURIComponent(data.shop.slug)}/qr.png`;
      init();
    })
    .catch(() => {
      window.location.href = '/login.html';
    });

  // --- State ---
  let uploads = []; // Array of upload groups

  // --- DOM ---
  const queueList = document.getElementById('queueList');
  const emptyState = document.getElementById('emptyState');
  const statPending = document.getElementById('statPending');
  const statFiles = document.getElementById('statFiles');
  const statStorage = document.getElementById('statStorage');
  const qrFeature = document.querySelector('.qr-feature');
  const modalOverlay = document.getElementById('modalOverlay');
  const modalTitle = document.getElementById('modalTitle');
  const modalBody = document.getElementById('modalBody');
  const modalClose = document.getElementById('modalClose');
  const modalPrintBtn = document.getElementById('modalPrintBtn');
  const modalDirectViewBtn = document.getElementById('modalDirectViewBtn');
  let activeModalFile = null;
  const toast = document.getElementById('toast');
  const toastTitle = document.getElementById('toastTitle');
  const toastMessage = document.getElementById('toastMessage');

  if (qrFeature) {
    const updateQrPosition = () => {
      const canFloat = window.matchMedia('(min-width: 601px)').matches;
      qrFeature.classList.toggle('qr-floating', canFloat && window.scrollY > 24);
    };

    window.addEventListener('scroll', updateQrPosition, { passive: true });
    updateQrPosition();
  }

  // --- Helpers ---
  function formatSize(bytes) {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  }

  function timeAgo(dateStr) {
    const now = new Date();
    const then = new Date(dateStr + (dateStr.endsWith('Z') ? '' : 'Z'));
    const diffMs = now - then;
    const diffMin = Math.floor(diffMs / 60000);
    if (diffMin < 1) return 'Just now';
    if (diffMin < 60) return `${diffMin}m ago`;
    const diffHr = Math.floor(diffMin / 60);
    return `${diffHr}h ${diffMin % 60}m ago`;
  }

  function getFileIcon(type) {
    if (type === 'application/pdf') return 'PDF';
    if (type === 'image/jpeg' || type === 'image/png') return 'IMG';
    return 'FILE';
  }

  function getFileTypeLabel(type) {
    if (type === 'application/pdf') return 'PDF';
    if (type === 'image/jpeg') return 'JPG';
    if (type === 'image/png') return 'PNG';
    return 'File';
  }

  function actionIcon(name) {
    const icons = {
      print: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 9V3h12v6M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2M6 14h12v7H6z"/></svg>',
      open: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14 5h5v5M19 5l-9 9M19 13v5a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1h5"/></svg>',
      view: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12Z"/><circle cx="12" cy="12" r="2.5"/></svg>',
      download: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3v12M7 11l5 5 5-5M4 20h16"/></svg>'
    };
    return icons[name];
  }

  // --- Notification Sound ---
  let audioCtx = null;
  function playNotificationSound() {
    try {
      if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.frequency.setValueAtTime(880, audioCtx.currentTime);
      osc.frequency.setValueAtTime(1100, audioCtx.currentTime + 0.1);
      gain.gain.setValueAtTime(0.15, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.4);
      osc.start(audioCtx.currentTime);
      osc.stop(audioCtx.currentTime + 0.4);
    } catch (e) {
      // Audio not supported
    }
  }

  // --- Toast ---
  let toastTimeout = null;
  function showToast(title, message) {
    toastTitle.textContent = title;
    toastMessage.textContent = message;
    toast.classList.add('active');
    clearTimeout(toastTimeout);
    toastTimeout = setTimeout(() => toast.classList.remove('active'), 4000);
  }

  // --- Stats ---
  function updateStats() {
    let totalFiles = 0;
    let totalSize = 0;
    for (const group of uploads) {
      totalFiles += group.files.length;
      for (const f of group.files) {
        totalSize += f.fileSize || 0;
      }
    }
    statPending.textContent = uploads.length;
    statFiles.textContent = totalFiles;
    statStorage.textContent = formatSize(totalSize);
  }

  // --- Render Queue ---
  function renderQueue() {
    // Remove existing cards (not the empty state)
    const existingCards = queueList.querySelectorAll('.upload-card');
    existingCards.forEach(card => card.remove());

    if (uploads.length === 0) {
      emptyState.style.display = '';
    } else {
      emptyState.style.display = 'none';
      for (const group of uploads) {
        const card = createCard(group);
        queueList.appendChild(card);
      }
    }

    updateStats();
  }

  function createCard(group) {
    const card = document.createElement('div');
    card.className = 'upload-card';
    card.dataset.groupId = group.groupId;

    const fileCount = group.files.length;
    const totalSize = group.files.reduce((sum, f) => sum + (f.fileSize || 0), 0);

    card.innerHTML = `
      <div class="card-header">
        <div class="card-code">
          <span class="code-badge">${group.code}</span>
          <div class="code-meta">
            <span class="code-file-count">${fileCount} file${fileCount > 1 ? 's' : ''} • ${formatSize(totalSize)}</span>
            <span class="code-time">${timeAgo(group.createdAt)}</span>
          </div>
        </div>
        <div class="card-actions">
          <button class="action-btn print-btn" data-action="print-all" data-group="${group.groupId}" title="Direct Print all files">
            <span class="btn-label">Print</span>
          </button>
          <button class="action-btn done-btn" data-action="done" data-group="${group.groupId}" title="Mark as printed">
            <span class="btn-label">Complete</span>
          </button>
          <button class="action-btn delete-btn" data-action="delete" data-group="${group.groupId}" title="Remove order" aria-label="Remove order">
            <span class="btn-label">Remove</span>
          </button>
        </div>
      </div>
      <div class="card-files">
        ${group.files.map(f => `
          <div class="card-file" data-file-id="${f.id}">
            <span class="card-file-icon file-type-icon">${getFileIcon(f.fileType)}</span>
            <div class="card-file-info">
              <div class="card-file-name">${f.originalName}</div>
              <div class="card-file-meta">${getFileTypeLabel(f.fileType)} • ${formatSize(f.fileSize)}</div>
            </div>
            <div class="card-file-actions">
              <button class="file-action-btn print-btn" data-action="print" data-file-id="${f.id}" data-file-name="${f.originalName}" data-file-type="${f.fileType}" title="Send to printer" aria-label="Send to printer">${actionIcon('print')}</button>
              <button class="file-action-btn direct-view-btn" data-action="direct-view" data-file-id="${f.id}" title="Open separately" aria-label="Open separately">${actionIcon('open')}</button>
              <button class="file-action-btn preview-btn" data-action="preview" data-file-id="${f.id}" data-file-name="${f.originalName}" data-file-type="${f.fileType}" title="Quick preview" aria-label="Quick preview">${actionIcon('view')}</button>
              <button class="file-action-btn download-btn" data-action="download" data-file-id="${f.id}" title="Download" aria-label="Download">${actionIcon('download')}</button>
            </div>
          </div>
        `).join('')}
      </div>
    `;

    return card;
  }

  // --- Direct View & Direct Print ---

  function directViewFile(fileId) {
    window.open(`/api/uploads/${fileId}/preview`, '_blank');
  }

  function directPrintFile(fileId, fileType, fileName) {
    const url = `/api/uploads/${fileId}/preview`;
    showToast('Opening print preview', `Opening ${fileName || 'document'}...`);

    if (fileType && fileType.startsWith('image/')) {
      let printFrame = document.getElementById('printFrame');
      if (printFrame) printFrame.remove();

      printFrame = document.createElement('iframe');
      printFrame.id = 'printFrame';
      printFrame.style.cssText = 'position:fixed;top:-9999px;left:-9999px;width:1px;height:1px;border:none;visibility:hidden;';
      document.body.appendChild(printFrame);

      const doc = printFrame.contentWindow.document;
      doc.open();
      doc.write(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>${fileName || 'Print'}</title>
          <style>
            @page { margin: 10mm; }
            body { margin: 0; display: flex; justify-content: center; align-items: center; min-height: 100vh; }
            img { max-width: 100%; max-height: 100vh; object-fit: contain; }
          </style>
        </head>
        <body>
          <img src="${url}" onload="setTimeout(() => { window.focus(); window.print(); }, 250);">
        </body>
        </html>
      `);
      doc.close();
    } else {
      // PDF or general document
      let printFrame = document.getElementById('printFrame');
      if (printFrame) printFrame.remove();

      printFrame = document.createElement('iframe');
      printFrame.id = 'printFrame';
      printFrame.style.cssText = 'position:fixed;top:-9999px;left:-9999px;width:1px;height:1px;border:none;visibility:hidden;';
      document.body.appendChild(printFrame);

      printFrame.src = url;
      printFrame.onload = () => {
        setTimeout(() => {
          try {
            printFrame.contentWindow.focus();
            printFrame.contentWindow.print();
          } catch (err) {
            // Fallback: Open in new tab which has built-in print dialog
            const pWin = window.open(url, '_blank');
            if (pWin) pWin.focus();
          }
        }, 300);
      };
    }
  }

  function printAllFiles(groupId) {
    const group = uploads.find(u => u.groupId === groupId);
    if (!group || !group.files || group.files.length === 0) return;

    showToast('Printing started', `Sending ${group.files.length} document(s) to the printer for pickup code ${group.code}...`);

    group.files.forEach((f, idx) => {
      setTimeout(() => {
        directPrintFile(f.id, f.fileType, f.originalName);
      }, idx * 1200);
    });
  }

  // --- Actions ---
  async function markAsPrinted(groupId) {
    try {
      const res = await fetch(`/api/uploads/group/${groupId}/status`, { method: 'PATCH' });
      if (res.ok) {
        removeCardWithAnimation(groupId);
      }
    } catch (err) {
      console.error('Failed to mark as printed:', err);
    }
  }

  async function deleteUpload(groupId) {
    if (!confirm('Delete this print order? The files will be permanently removed.')) return;
    try {
      const res = await fetch(`/api/uploads/group/${groupId}`, { method: 'DELETE' });
      if (res.ok) {
        removeCardWithAnimation(groupId);
      }
    } catch (err) {
      console.error('Failed to delete:', err);
    }
  }

  function removeCardWithAnimation(groupId) {
    uploads = uploads.filter(u => u.groupId !== groupId);
    const card = queueList.querySelector(`[data-group-id="${groupId}"]`);
    if (card) {
      card.classList.add('removing');
      setTimeout(() => {
        card.remove();
        if (uploads.length === 0) {
          emptyState.style.display = '';
        }
      }, 400);
    }
    updateStats();
  }

  function previewFile(fileId, fileName, fileType) {
    activeModalFile = { fileId, fileName, fileType };
    modalTitle.textContent = fileName;
    modalBody.innerHTML = '';

    if (fileType === 'application/pdf') {
      const embed = document.createElement('embed');
      embed.src = `/api/uploads/${fileId}/preview`;
      embed.type = 'application/pdf';
      modalBody.appendChild(embed);
    } else if (fileType.startsWith('image/')) {
      const img = document.createElement('img');
      img.src = `/api/uploads/${fileId}/preview`;
      img.alt = fileName;
      modalBody.appendChild(img);
    }

    modalOverlay.classList.add('active');
  }

  function closeModal() {
    modalOverlay.classList.remove('active');
    modalBody.innerHTML = '';
    activeModalFile = null;
  }

  function downloadFile(fileId) {
    window.open(`/api/uploads/${fileId}/download`, '_blank');
  }

  // --- Event Delegation ---
  queueList.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;

    const action = btn.dataset.action;

    if (action === 'print-all') {
      printAllFiles(btn.dataset.group);
    } else if (action === 'print') {
      directPrintFile(btn.dataset.fileId, btn.dataset.fileType, btn.dataset.fileName);
    } else if (action === 'direct-view') {
      directViewFile(btn.dataset.fileId);
    } else if (action === 'preview') {
      previewFile(btn.dataset.fileId, btn.dataset.fileName, btn.dataset.fileType);
    } else if (action === 'download') {
      downloadFile(btn.dataset.fileId);
    } else if (action === 'done') {
      markAsPrinted(btn.dataset.group);
    } else if (action === 'delete') {
      deleteUpload(btn.dataset.group);
    }
  });

  // Modal actions
  if (modalPrintBtn) {
    modalPrintBtn.addEventListener('click', () => {
      if (activeModalFile) {
        directPrintFile(activeModalFile.fileId, activeModalFile.fileType, activeModalFile.fileName);
      }
    });
  }

  if (modalDirectViewBtn) {
    modalDirectViewBtn.addEventListener('click', () => {
      if (activeModalFile) {
        directViewFile(activeModalFile.fileId);
      }
    });
  }

  // Modal close
  modalClose.addEventListener('click', closeModal);
  modalOverlay.addEventListener('click', (e) => {
    if (e.target === modalOverlay) closeModal();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeModal();
  });

  // Logout
  document.getElementById('logoutBtn').addEventListener('click', async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    window.location.href = '/login.html';
  });

  document.getElementById('deleteAccountBtn').addEventListener('click', async () => {
    const password = window.prompt('Enter your shop password to permanently delete this account:');
    if (password === null) return;
    if (!password) return showToast('Password required', 'Enter your password to delete the account.');

    const button = document.getElementById('deleteAccountBtn');
    button.disabled = true;
    button.textContent = 'Removing...';
    try {
      const response = await fetch('/api/auth/account', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ password }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Account could not be deleted');
      window.location.href = '/login.html?deleted=1';
    } catch (error) {
      button.disabled = false;
      button.textContent = 'Delete account';
      showToast('Delete failed', error.message);
    }
  });

  // --- Init ---
  async function init() {
    // Fetch existing uploads
    try {
      const res = await fetch('/api/uploads');
      const data = await res.json();
      uploads = data.uploads || [];
      renderQueue();
    } catch (err) {
      console.error('Failed to fetch uploads:', err);
    }

    // Refresh the orders regularly so the owner sees new print requests.
    setInterval(async () => {
      try {
        const response = await fetch('/api/uploads');
        if (!response.ok) return;
        const next = (await response.json()).uploads || [];
        if (JSON.stringify(next) !== JSON.stringify(uploads)) {
          if (next.length > uploads.length) playNotificationSound();
          uploads = next;
          renderQueue();
        }
      } catch (err) { console.debug('Order refresh failed', err); }
    }, 5000);

    // Update time-ago every 30 seconds
    setInterval(() => {
      document.querySelectorAll('.code-time').forEach(el => {
        const card = el.closest('.upload-card');
        if (card) {
          const groupId = card.dataset.groupId;
          const group = uploads.find(u => u.groupId === groupId);
          if (group) {
            el.textContent = timeAgo(group.createdAt);
          }
        }
      });
    }, 30000);
  }
})();
