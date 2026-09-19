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

  // --- State ---
  let selectedFiles = [];

  // --- Helpers ---
  function formatSize(bytes) {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  }

  function getFileIcon(type) {
    if (type === 'application/pdf') return '📕';
    if (type.startsWith('image/')) return '🖼️';
    return '📄';
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
    return null;
  }

  // --- Render File List ---
  function renderFileList() {
    fileList.innerHTML = '';
    selectedFiles.forEach((file, index) => {
      const item = document.createElement('div');
      item.className = 'file-item';
      item.innerHTML = `
        <span class="file-icon">${getFileIcon(file.type)}</span>
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
  function uploadFiles() {
    if (selectedFiles.length === 0) return;

    const formData = new FormData();
    selectedFiles.forEach(file => formData.append('files', file));

    const xhr = new XMLHttpRequest();

    // Show progress
    uploadBtn.style.display = 'none';
    progressSection.classList.add('active');

    xhr.upload.addEventListener('progress', (e) => {
      if (e.lengthComputable) {
        const pct = Math.round((e.loaded / e.total) * 100);
        progressBar.style.width = pct + '%';
        progressText.textContent = `Uploading... ${pct}%`;
      }
    });

    xhr.addEventListener('load', () => {
      if (xhr.status === 200) {
        try {
          const data = JSON.parse(xhr.responseText);
          showSuccess(data.code);
        } catch {
          showError('Unexpected server response.');
          resetUploadUI();
        }
      } else {
        try {
          const data = JSON.parse(xhr.responseText);
          showError(data.error || 'Upload failed.');
        } catch {
          showError('Upload failed. Please try again.');
        }
        resetUploadUI();
      }
    });

    xhr.addEventListener('error', () => {
      showError('Network error. Please check your connection and try again.');
      resetUploadUI();
    });

    xhr.open('POST', '/api/upload');
    xhr.send(formData);
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
