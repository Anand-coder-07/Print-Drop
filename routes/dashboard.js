const express = require('express');
const { Upload } = require('../db');
const { deleteFile, downloadFile } = require('../utils/googleDrive');
const { requireAuth } = require('../middleware/auth');
const router = express.Router(); router.use(requireAuth);
router.get('/', async (req, res) => {
  const rows = await Upload.find({ shop_id: req.shopId, status: 'pending' }).sort({ created_at: -1 }).lean();
  const groups = {}; rows.forEach(u => { (groups[u.group_id] ||= { groupId: u.group_id, code: u.code, createdAt: u.created_at, files: [] }).files.push({ id: u.id, originalName: u.original_name, fileType: u.file_type, fileSize: u.file_size, status: u.status }); });
  res.json({ uploads: Object.values(groups) });
});
router.get('/:id/:action(preview|download)', async (req, res) => {
  const u = await Upload.findOne({ id: req.params.id, shop_id: req.shopId }); if (!u) return res.status(404).json({ error: 'File not found' });
  try {
    const file = await downloadFile(u.public_id);
    res.type(u.file_type || 'application/octet-stream');
    if (req.params.action === 'download') {
      const name = u.original_name.replace(/[\r\n"]/g, '_');
      res.setHeader('Content-Disposition', `attachment; filename="${name}"`);
    }
    file.data.on('error', error => {
      if (!res.headersSent) res.status(502).json({ error: 'Unable to read file from Google Drive.' });
      else res.destroy(error);
    });
    file.data.pipe(res);
  } catch (error) {
    console.error('Google Drive download failed:', error.message);
    res.status(502).json({ error: 'Unable to download file.' });
  }
});
router.patch('/group/:groupId/status', async (req, res) => {
  const files = await Upload.find({ group_id: req.params.groupId, shop_id: req.shopId }); if (!files.length) return res.status(404).json({ error: 'Upload group not found' });
  await Promise.all(files.map(f => deleteFile(f.public_id, f.resource_type || (f.file_type?.startsWith('image/') ? 'image' : 'raw')).catch(() => null))); await Upload.deleteMany({ group_id: req.params.groupId, shop_id: req.shopId });
  res.json({ success: true, message: 'Marked as printed' });
});
router.delete('/group/:groupId', async (req, res) => {
  const files = await Upload.find({ group_id: req.params.groupId, shop_id: req.shopId }); if (!files.length) return res.status(404).json({ error: 'Upload group not found' });
  await Promise.all(files.map(f => deleteFile(f.public_id, f.resource_type || (f.file_type?.startsWith('image/') ? 'image' : 'raw')).catch(() => null))); await Upload.deleteMany({ group_id: req.params.groupId, shop_id: req.shopId });
  res.json({ success: true, message: 'Upload deleted' });
});
module.exports = router;
