(() => {
  'use strict';

  // --- DOM Elements ---
  const dropZone = document.getElementById('dropZone');
  const fileInput = document.getElementById('fileInput');
  const browseBtn = document.getElementById('browseBtn');
  const fileList = document.getElementById('fileList');
  const uploadBtn = document.getElementById('uploadBtn');
  const uploadSection = document.getElementById('uploadSection');
  const progressSection = document.getElementById('progressSection');
  const progressBar = document.getElementById('progressBar');
  const progressText = document.getElementById('progressText');
  const successSection = document.getElementById('successSection');
  const codeValue = document.getElementById('codeValue');
  const newUploadBtn = document.getElementById('newUploadBtn');
  const errorMessage = document.getElementById('errorMessage');

  // --- Config ---
  const ALLOWED_TYPES = ['application/pdf', 'image/jpeg', 'image/png'];
  const ALLOWED_EXTENSIONS = ['.pdf', '.jpg', '.jpeg', '.png'];
  const MAX_FILES = 10;
  const DEFAULT_MAX_FILE_SIZE_MB = 80;
  const MIN_MAX_FILE_SIZE_MB = 50;
  const MAX_MAX_FILE_SIZE_MB = 100;
  let maxFiles = MAX_FILES;
  let maxFileSizeMb = DEFAULT_MAX_FILE_SIZE_MB;
  let maxFileSize = maxFileSizeMb * 1024 * 1024;

  // --- State ---
  let selectedFiles = [];
  const shopSlug = window.location.pathname.match(/^\/s\/([^/]+)/)?.[1];

  async function loadUploadConfig() {
    try {
      const response = await fetch('/api/upload/config');
      if (!response.ok) return;
      const config = await response.json();
      if (Number.isInteger(config.maxFiles) && config.maxFiles > 0) maxFiles = config.maxFiles;
      if (Number.isFinite(config.maxFileSizeMb)) {
        maxFileSizeMb = Math.min(MAX_MAX_FILE_SIZE_MB, Math.max(MIN_MAX_FILE_SIZE_MB, config.maxFileSizeMb));
        maxFileSize = maxFileSizeMb * 1024 * 1024;
      }
    } catch (error) {
      console.error('Failed to load upload configuration:', error);
    }
  }

  async function loadShopName() {
    const shopName = document.getElementById('shopName');
    if (!shopName) return;
    try {
      const endpoint = shopSlug
        ? `/api/shops/${encodeURIComponent(shopSlug)}`
        : '/api/shops/default';
      const response = await fetch(endpoint);
      if (!response.ok) return;
      const data = await response.json();
      if (data.shop?.name) {
        shopName.textContent = data.shop.name;
        document.title = `${data.shop.name} — PrintDrop`;
      }
    } catch (error) {
      console.error('Failed to load shop name:', error);
    }
  }

  loadUploadConfig();
  loadShopName();

  // --- Helpers ---
  function formatSize(bytes) {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  }

  function getFileIcon(type) {
    if (type === 'application/pdf') return 'PDF';
    if (type.startsWith('image/')) return 'IMG';
    return 'FILE';
  }

  function getExtension(name) {
    const dot = name.lastIndexOf('.');
    return dot >= 0 ? name.substring(dot).toLowerCase() : '';
  }

  function showError(msg) {
    errorMessage.textContent = msg;
    errorMessage.classList.add('active');
    setTimeout(() => errorMessage.classList.remove('active'), 5000);
  }

  function clearError() {
    errorMessage.classList.remove('active');
  }

  function validateFile(file) {
    const ext = getExtension(file.name);
    if (!ALLOWED_TYPES.includes(file.type) && !ALLOWED_EXTENSIONS.includes(ext)) {
      return `"${file.name}" is not allowed. Only PDF, JPG, and PNG files are accepted.`;
    }
    if (file.size > maxFileSize) return `"${file.name}" is too large. Files must be no larger than ${maxFileSizeMb} MB.`;
    return null;
  }

  function normalizedType(file) {
    if (ALLOWED_TYPES.includes(file.type)) return file.type;
    const ext = getExtension(file.name);
    return ext === '.pdf' ? 'application/pdf' : 'image/' + (ext === '.png' ? 'png' : 'jpeg');
  }

  // --- Render File List ---
  function renderFileList() {
    fileList.innerHTML = '';
    selectedFiles.forEach((file, index) => {
      const item = document.createElement('div');
      item.className = 'file-item';
      item.innerHTML = `
        <span class="file-icon file-type-icon">${getFileIcon(file.type)}</span>
        <div class="file-details">
          <div class="file-name">${file.name}</div>
          <div class="file-size">${formatSize(file.size)}</div>
        </div>
        <button class="file-remove" data-index="${index}" aria-label="Remove file">✕</button>
      `;
      fileList.appendChild(item);
    });

    // Update upload button state
    uploadBtn.disabled = selectedFiles.length === 0;
  }

  // --- Add Files ---
  function addFiles(fileListInput) {
    clearError();
    const newFiles = Array.from(fileListInput);

    for (const file of newFiles) {
      const error = validateFile(file);
      if (error) {
        showError(error);
        continue;
      }

      // Avoid duplicates
      const alreadyAdded = selectedFiles.some(
        f => f.name === file.name && f.size === file.size
      );
      if (alreadyAdded) continue;

      if (selectedFiles.length >= maxFiles) {
        showError(`You can submit up to ${maxFiles} files at a time.`);
        break;
      }
      selectedFiles.push(file);
    }

    renderFileList();
    // Reset input so the same file can be re-selected
    fileInput.value = '';
  }

  // --- Remove File ---
  function removeFile(index) {
    selectedFiles.splice(index, 1);
    renderFileList();
  }

  // --- Upload ---
  function bytesToBase64(bytes) {
    let binary = '';
    const blockSize = 0x8000;
    for (let i = 0; i < bytes.length; i += blockSize) {
      binary += String.fromCharCode(...bytes.subarray(i, i + blockSize));
    }
    return btoa(binary);
  }

  async function driveUpload(file, params, token, onProgress) {
    const sessionResponse = await fetch('/api/upload/session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, upload_id: params.upload_id })
    });
    const session = await sessionResponse.json();
    if (!sessionResponse.ok) throw new Error(session.error || 'Unable to start file upload.');
    const chunkSize = 2 * 1024 * 1024;
    let offset = 0;
    let result;
    while (offset < file.size) {
      const end = Math.min(offset + chunkSize, file.size) - 1;
      const chunk = await file.slice(offset, end + 1).arrayBuffer();
      const response = await fetch('/api/upload/chunk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token,
          upload_id: params.upload_id,
          sessionUrl: session.uploadUrl,
          start: offset,
          end,
          chunk: bytesToBase64(new Uint8Array(chunk))
        })
      });
      const text = await response.text();
      let data;
      try { data = text ? JSON.parse(text) : {}; } catch { throw new Error('Upload returned an invalid response.'); }
      if (!response.ok) throw new Error(data.error || 'Upload failed.');
      offset = end + 1;
      onProgress(offset);
      if (data.id) result = data;
    }
    const publicId = result?.id || result?.public_id;
    if (!publicId) throw new Error('Google Drive did not return the uploaded file.');
    return { ...result, upload_id: params.upload_id, public_id: publicId, secure_url: result.webViewLink || `https://drive.google.com/file/d/${publicId}/view` };
  }

  async function uploadFiles() {
    if (selectedFiles.length === 0) return;
    const files = selectedFiles.slice();
    uploadBtn.style.display = 'none';
    progressSection.classList.add('active');
    let uploaded = [], session;
    try {
      const response = await fetch('/api/upload/signature' + (shopSlug ? `?shop=${encodeURIComponent(shopSlug)}` : ''), {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ files: files.map(file => ({ name: file.name, type: normalizedType(file), size: file.size })) })
      });
      session = await response.json();
      if (!response.ok) throw new Error(session.error || 'Unable to prepare upload.');
      const loaded = new Array(files.length).fill(0);
      for (let i = 0; i < files.length; i++) {
        const file = files[i], params = session.files[i];
        const result = await driveUpload(file, params, session.token, bytes => {
          loaded[i] = bytes;
          const pct = Math.round(loaded.reduce((sum, value) => sum + value, 0) / files.reduce((sum, item) => sum + item.size, 0) * 100);
          progressBar.style.width = pct + '%';
          progressText.textContent = `Uploading... ${pct}%`;
        });
        uploaded.push({ upload_id: result.upload_id, public_id: result.public_id, secure_url: result.secure_url, originalName: params.originalName, fileType: params.fileType, fileSize: params.fileSize });
      }
      progressText.textContent = 'Finishing your order...';
      const complete = await fetch('/api/upload/complete', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token: session.token, files: uploaded }) });
      const data = await complete.json();
      if (!complete.ok) throw new Error(data.error || 'Upload metadata could not be saved.');
      showSuccess(data.code);
    } catch (error) {
      if (session?.token && uploaded.length) fetch('/api/upload/cleanup', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token: session.token, publicIds: uploaded.map(file => file.public_id) }) }).catch(() => {});
      showError(error.message || 'Upload failed. Please try again.');
      resetUploadUI();
    }
  }

  function showSuccess(code) {
    uploadSection.style.display = 'none';
    progressSection.classList.remove('active');
    successSection.classList.add('active');
    codeValue.textContent = code;
  }

  function resetUploadUI() {
    uploadBtn.style.display = '';
    progressSection.classList.remove('active');
    progressBar.style.width = '0%';
    progressText.textContent = 'Sending... 0%';
  }

  function resetAll() {
    selectedFiles = [];
    renderFileList();
    uploadSection.style.display = '';
    successSection.classList.remove('active');
    resetUploadUI();
    clearError();
  }

  // --- Event Listeners ---

  // Browse button
  browseBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    fileInput.click();
  });

  // Drop zone click
  dropZone.addEventListener('click', (e) => {
    if (e.target !== browseBtn && !browseBtn.contains(e.target)) {
      fileInput.click();
    }
  });

  // File input change
  fileInput.addEventListener('change', () => {
    addFiles(fileInput.files);
  });

  // Drag events
  dropZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropZone.classList.add('drag-over');
  });

  dropZone.addEventListener('dragleave', () => {
    dropZone.classList.remove('drag-over');
  });

  dropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropZone.classList.remove('drag-over');
    if (e.dataTransfer.files.length > 0) {
      addFiles(e.dataTransfer.files);
    }
  });

  // Remove file button
  fileList.addEventListener('click', (e) => {
    const btn = e.target.closest('.file-remove');
    if (btn) {
      const index = parseInt(btn.dataset.index, 10);
      removeFile(index);
    }
  });

  // Upload button
  uploadBtn.addEventListener('click', uploadFiles);

  // New upload button
  newUploadBtn.addEventListener('click', resetAll);

  // Prevent default drag behavior on the window
  window.addEventListener('dragover', (e) => e.preventDefault());
  window.addEventListener('drop', (e) => e.preventDefault());
})();
