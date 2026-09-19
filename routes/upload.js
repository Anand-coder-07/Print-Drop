const express = require('express');
const multer = require('multer');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const { execute } = require('../db');
const { generateUniqueCode } = require('../utils/codeGenerator');

const router = express.Router();

// Ensure uploads directory exists
const UPLOADS_DIR = path.join(__dirname, '..', 'uploads');
const fs = require('fs');
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

// Allowed MIME types
const ALLOWED_TYPES = {
  'application/pdf': '.pdf',
  'image/jpeg': '.jpg',
  'image/png': '.png',
};

// Multer config
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOADS_DIR),
  filename: (req, file, cb) => {
    const ext = ALLOWED_TYPES[file.mimetype] || path.extname(file.originalname);
    cb(null, `${uuidv4()}${ext}`);
  },
});

const fileFilter = (req, file, cb) => {
  if (ALLOWED_TYPES[file.mimetype]) {
    cb(null, true);
  } else {
    cb(new Error(`File type not allowed: ${file.mimetype}. Only PDF, JPG, and PNG are accepted.`), false);
  }
};

// Multer config with no file size or count limits
const upload = multer({
  storage,
  fileFilter,
});

// Store Socket.IO instance
let ioInstance = null;
function setIo(io) {
  ioInstance = io;
}

// POST /api/upload
router.post('/', (req, res) => {
  const uploadMiddleware = upload.array('files');

  uploadMiddleware(req, res, (err) => {
    if (err) {
      return res.status(400).json({ error: err.message });
    }

    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: 'No files uploaded' });
    }

    const code = generateUniqueCode();
    const groupId = uuidv4();
    const records = [];

    for (const file of req.files) {
      const id = uuidv4();
      execute(
        `INSERT INTO uploads (id, group_id, code, original_name, stored_name, file_path, file_type, file_size)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [id, groupId, code, file.originalname, file.filename, file.path, file.mimetype, file.size]
      );
      records.push({
        id,
        groupId,
        code,
        originalName: file.originalname,
        fileType: file.mimetype,
        fileSize: file.size,
        status: 'pending',
        createdAt: new Date().toISOString(),
      });
    }

    // Emit real-time event to the dashboard
    if (ioInstance) {
      ioInstance.emit('new-upload', {
        groupId,
        code,
        files: records,
        createdAt: new Date().toISOString(),
      });
    }

    res.json({
      success: true,
      code,
      fileCount: req.files.length,
      groupId,
    });
  });
});

module.exports = router;
module.exports.setIo = setIo;
