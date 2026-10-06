const express = require('express');
const multer = require('multer');
const { v4: uuidv4 } = require('uuid');
const { Shop, Upload } = require('../db');
const { uploadBuffer } = require('../utils/cloudinary');
const { generateUniqueCode } = require('../utils/codeGenerator');
const router = express.Router();
const allowed = { 'application/pdf': '.pdf', 'image/jpeg': '.jpg', 'image/png': '.png' };
const upload = multer({ storage: multer.memoryStorage(), fileFilter: (req, f, cb) => allowed[f.mimetype] ? cb(null, true) : cb(new Error('Only PDF, JPG, and PNG are accepted')), limits: { files: +(process.env.MAX_UPLOAD_FILES || 10), fileSize: +(process.env.MAX_FILE_SIZE_MB || 25) * 1024 * 1024 } });
router.post('/', (req, res) => upload.array('files')(req, res, async err => {
  if (err) return res.status(err.code === 'LIMIT_FILE_SIZE' ? 413 : 400).json({ error: err.message });
  if (!req.files?.length) return res.status(400).json({ error: 'No files uploaded' });
  try {
    const shop = await Shop.findOne({ slug: req.query.shop || process.env.DEFAULT_SHOP_SLUG || 'default' });
    if (!shop) return res.status(404).json({ error: 'Shop not found' });
    const code = generateUniqueCode(), groupId = uuidv4();
    const records = await Promise.all(req.files.map(async file => {
      const result = await uploadBuffer(file.buffer, { public_id: `${groupId}-${uuidv4()}`, format: allowed[file.mimetype].slice(1) });
      return Upload.create({ id: uuidv4(), shop_id: shop._id, group_id: groupId, code, original_name: file.originalname, public_id: result.public_id, secure_url: result.secure_url, file_type: file.mimetype, file_size: file.size });
    }));
    res.json({ success: true, code, fileCount: records.length, groupId });
  } catch (e) { res.status(500).json({ error: 'Upload failed. Please try again.' }); }
}));
module.exports = router;
