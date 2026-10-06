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
  const MAX_FILE_SIZE = 25 * 1024 * 1024;

  // --- State ---
  let selectedFiles = [];
  const shopSlug = window.location.pathname.match(/^\/s\/([^/]+)/)?.[1];

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
    if (file.size > MAX_FILE_SIZE) return `"${file.name}" is too large. Files must be no larger than 25 MB.`;
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

      if (selectedFiles.length >= MAX_FILES) {
        showError(`You can submit up to ${MAX_FILES} files at a time.`);
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
  function cloudinaryUpload(file, params, onProgress) {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      const endpoint = `https://api.cloudinary.com/v1_1/${encodeURIComponent(params.cloudName)}/${params.resource_type}/upload`;
      const body = new FormData();
      body.append('file', file);
      body.append('api_key', params.api_key);
      body.append('timestamp', params.timestamp);
      body.append('folder', params.folder);
      body.append('public_id', params.public_id);
      body.append('signature', params.signature);
      xhr.upload.onprogress = e => e.lengthComputable && onProgress(e.loaded);
      xhr.onload = () => {
        let data;
        try { data = JSON.parse(xhr.responseText); } catch { return reject(new Error('Cloudinary returned an invalid response.')); }
        if (xhr.status >= 200 && xhr.status < 300) resolve(data);
        else reject(new Error(data.error?.message || 'Cloudinary upload failed.'));
      };
      xhr.onerror = () => reject(new Error('Network error while uploading a file.'));
      xhr.open('POST', endpoint);
      xhr.send(body);
    });
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
        const file = files[i], params = { ...session.files[i], cloudName: session.cloudName };
        const result = await cloudinaryUpload(file, params, bytes => {
          loaded[i] = bytes;
          const pct = Math.round(loaded.reduce((sum, value) => sum + value, 0) / files.reduce((sum, item) => sum + item.size, 0) * 100);
          progressBar.style.width = pct + '%';
          progressText.textContent = `Uploading... ${pct}%`;
        });
        uploaded.push({ public_id: result.public_id, secure_url: result.secure_url, resourceType: params.resource_type, originalName: params.originalName, fileType: params.fileType, fileSize: params.fileSize });
      }
      progressText.textContent = 'Saving submission...';
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
    progressText.textContent = 'Uploading... 0%';
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
