const express = require('express');
const fs = require('fs');
const path = require('path');
const { queryAll, queryGet, execute } = require('../db');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

let ioInstance = null;
function setIo(io) {
  ioInstance = io;
}

// All dashboard routes require authentication
router.use(requireAuth);

// GET /api/uploads — List all pending uploads grouped by code
router.get('/', (req, res) => {
  const uploads = queryAll(`
    SELECT id, group_id, code, original_name, file_type, file_size, status, created_at
    FROM uploads
    WHERE status = 'pending'
    ORDER BY created_at DESC
  `);

  // Group by group_id
  const groups = {};
  for (const upload of uploads) {
    if (!groups[upload.group_id]) {
      groups[upload.group_id] = {
        groupId: upload.group_id,
        code: upload.code,
        createdAt: upload.created_at,
        files: [],
      };
    }
    groups[upload.group_id].files.push({
      id: upload.id,
      originalName: upload.original_name,
      fileType: upload.file_type,
      fileSize: upload.file_size,
      status: upload.status,
    });
  }

  res.json({ uploads: Object.values(groups) });
});

// GET /api/uploads/:id/preview — Serve file for in-browser preview
router.get('/:id/preview', (req, res) => {
  const upload = queryGet('SELECT * FROM uploads WHERE id = ?', [req.params.id]);

  if (!upload) {
    return res.status(404).json({ error: 'File not found' });
  }

  if (!fs.existsSync(upload.file_path)) {
    return res.status(404).json({ error: 'File no longer exists on disk' });
  }

  const contentType = upload.file_type;
  res.setHeader('Content-Type', contentType);
  res.setHeader('Content-Disposition', `inline; filename="${upload.original_name}"`);
  res.sendFile(path.resolve(upload.file_path));
});

// GET /api/uploads/:id/download — Download a file
router.get('/:id/download', (req, res) => {
  const upload = queryGet('SELECT * FROM uploads WHERE id = ?', [req.params.id]);

  if (!upload) {
    return res.status(404).json({ error: 'File not found' });
  }

  if (!fs.existsSync(upload.file_path)) {
    return res.status(404).json({ error: 'File no longer exists on disk' });
  }

  res.download(path.resolve(upload.file_path), upload.original_name);
});

// PATCH /api/uploads/group/:groupId/status — Mark entire group as printed
router.patch('/group/:groupId/status', (req, res) => {
  const files = queryAll('SELECT * FROM uploads WHERE group_id = ?', [req.params.groupId]);

  if (files.length === 0) {
    return res.status(404).json({ error: 'Upload group not found' });
  }

  for (const file of files) {
    execute("UPDATE uploads SET status = 'printed' WHERE id = ?", [file.id]);
    // Delete file from disk
    try {
      if (fs.existsSync(file.file_path)) {
        fs.unlinkSync(file.file_path);
      }
    } catch (err) {
      console.error(`Failed to delete file ${file.file_path}:`, err.message);
    }
  }

  // Notify dashboard
  if (ioInstance) {
    ioInstance.emit('upload-removed', { groupId: req.params.groupId });
  }

  res.json({ success: true, message: 'Marked as printed' });
});

// DELETE /api/uploads/group/:groupId — Delete an entire upload group
router.delete('/group/:groupId', (req, res) => {
  const files = queryAll('SELECT * FROM uploads WHERE group_id = ?', [req.params.groupId]);

  if (files.length === 0) {
    return res.status(404).json({ error: 'Upload group not found' });
  }

  for (const file of files) {
    try {
      if (fs.existsSync(file.file_path)) {
        fs.unlinkSync(file.file_path);
      }
    } catch (err) {
      console.error(`Failed to delete file ${file.file_path}:`, err.message);
    }
    execute('DELETE FROM uploads WHERE id = ?', [file.id]);
  }

  // Notify dashboard
  if (ioInstance) {
    ioInstance.emit('upload-removed', { groupId: req.params.groupId });
  }

  res.json({ success: true, message: 'Upload deleted' });
});

module.exports = router;
module.exports.setIo = setIo;
