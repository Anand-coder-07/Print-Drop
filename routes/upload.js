const express = require('express');
const multer = require('multer');
const { v4: uuidv4 } = require('uuid');
const jwt = require('jsonwebtoken');
const { Shop, Upload } = require('../db');
const { uploadBuffer, deleteFile, cloudinary } = require('../utils/cloudinary');
const { generateUniqueCode } = require('../utils/codeGenerator');
const router = express.Router();
const allowed = { 'application/pdf': '.pdf', 'image/jpeg': '.jpg', 'image/png': '.png' };
const maxFiles = () => +(process.env.MAX_UPLOAD_FILES || 10);
const maxFileSizeMb = () => Math.min(100, Math.max(50, Number(process.env.MAX_FILE_SIZE_MB) || 80));
const maxBytes = () => maxFileSizeMb() * 1024 * 1024;
const tokenSecret = () => process.env.SESSION_SECRET || process.env.CLOUDINARY_API_SECRET;
const shopFor = req => req.body?.shop || req.query.shop || process.env.DEFAULT_SHOP_SLUG || 'default';
const signToken = payload => jwt.sign(payload, tokenSecret(), { expiresIn: '30m' });
const verifyToken = token => jwt.verify(token, tokenSecret());
const upload = multer({ storage: multer.memoryStorage(), fileFilter: (req, f, cb) => allowed[f.mimetype] ? cb(null, true) : cb(new Error('Only PDF, JPG, and PNG are accepted')), limits: { files: maxFiles(), fileSize: maxBytes() } });

// The browser uses these signed parameters to upload directly to Cloudinary.
// The API secret never leaves this server.
router.get('/config', (req, res) => {
  res.json({ maxFiles: maxFiles(), maxFileSizeMb: maxFileSizeMb() });
});

router.post('/signature', async (req, res) => {
  try {
    const files = Array.isArray(req.body?.files) ? req.body.files : [];
    if (!files.length || files.length > maxFiles()) return res.status(400).json({ error: `Select between 1 and ${maxFiles()} files.` });
    if (!tokenSecret() || !process.env.CLOUDINARY_API_SECRET || !process.env.CLOUDINARY_API_KEY || !process.env.CLOUDINARY_CLOUD_NAME) return res.status(500).json({ error: 'Upload signing is not configured.' });
    for (const file of files) {
      if (!file || !allowed[file.type] || !Number.isFinite(file.size) || file.size < 1 || file.size > maxBytes()) {
        return res.status(400).json({ error: `Each file must be a PDF, JPG, or PNG no larger than ${maxFileSizeMb()} MB.` });
      }
    }
    const shop = await Shop.findOne({ slug: shopFor(req) });
    if (!shop) return res.status(404).json({ error: 'Shop not found' });
    const groupId = uuidv4();
    const entries = files.map(file => {
      const resourceType = file.type === 'application/pdf' ? 'raw' : 'image';
      const publicId = `printdrop/${groupId}/${uuidv4()}`;
      const timestamp = Math.floor(Date.now() / 1000);
      const params = { public_id: publicId, timestamp, resource_type: resourceType };
      // resource_type is used to choose the Cloudinary endpoint, not signed.
      const signature = cloudinary.utils.api_sign_request({ public_id: params.public_id, timestamp }, process.env.CLOUDINARY_API_SECRET);
      return { ...params, signature, api_key: process.env.CLOUDINARY_API_KEY, originalName: String(file.name || '').slice(0, 255), fileType: file.type, fileSize: file.size };
    });
    const token = signToken({ shopId: String(shop._id), shop: shop.slug, groupId, files: entries.map(({ public_id, resource_type, originalName, fileType, fileSize }) => ({ public_id, resource_type, originalName, fileType, fileSize })) });
    res.json({ cloudName: process.env.CLOUDINARY_CLOUD_NAME, token, groupId, files: entries });
  } catch (e) {
    console.error('Upload signature failed:', e.message);
    res.status(500).json({ error: 'Unable to prepare upload. Please try again.' });
  }
});

router.post('/complete', async (req, res) => {
  let claims;
  try { claims = verifyToken(req.body?.token); } catch { return res.status(400).json({ error: 'Upload session expired. Please try again.' }); }
  const files = Array.isArray(req.body?.files) ? req.body.files : [];
  const expected = new Map((claims.files || []).map(file => [file.public_id, file]));
  if (files.length !== expected.size || files.some(file => !expected.has(file?.public_id))) return res.status(400).json({ error: 'Upload details did not match the signed request.' });
  const invalid = files.find(file => {
    const expectedFile = expected.get(file.public_id);
    return !file.secure_url || !/^https:\/\/res\.cloudinary\.com\//.test(file.secure_url) ||
      file.originalName !== expectedFile.originalName || file.fileType !== expectedFile.fileType ||
      file.fileSize !== expectedFile.fileSize || file.resourceType !== expectedFile.resource_type;
  });
  if (invalid) return res.status(400).json({ error: 'One or more uploaded files could not be verified.' });
  try {
    const code = generateUniqueCode();
    const records = await Upload.create(files.map(file => ({ id: uuidv4(), shop_id: claims.shopId, group_id: claims.groupId, code, original_name: file.originalName, public_id: file.public_id, secure_url: file.secure_url, resource_type: file.resourceType, file_type: file.fileType, file_size: file.fileSize })));
    res.json({ success: true, code, fileCount: records.length, groupId: claims.groupId });
  } catch (e) {
    await Promise.all(files.map(file => deleteFile(file.public_id, file.resourceType).catch(() => null)));
    console.error('Upload metadata failed:', e.message);
    res.status(500).json({ error: 'Upload failed. Please try again.' });
  }
});

router.post('/cleanup', async (req, res) => {
  try {
    const claims = verifyToken(req.body?.token);
    const permitted = new Set((claims.files || []).map(file => file.public_id));
    const ids = (Array.isArray(req.body?.publicIds) ? req.body.publicIds : []).filter(id => permitted.has(id));
    await Promise.all(ids.map(id => deleteFile(id, claims.files.find(file => file.public_id === id).resource_type).catch(() => null)));
    res.json({ success: true });
  } catch { res.status(400).json({ error: 'Upload session expired.' }); }
});

router.post('/', (req, res) => upload.array('files')(req, res, async err => {
  if (err) return res.status(err.code === 'LIMIT_FILE_SIZE' ? 413 : 400).json({ error: err.message });
  if (!req.files?.length) return res.status(400).json({ error: 'No files uploaded' });
  try {
    const shop = await Shop.findOne({ slug: req.query.shop || process.env.DEFAULT_SHOP_SLUG || 'default' });
    if (!shop) return res.status(404).json({ error: 'Shop not found' });
    const code = generateUniqueCode(), groupId = uuidv4();
    const records = await Promise.all(req.files.map(async file => {
      const result = await uploadBuffer(file.buffer, { public_id: `${groupId}-${uuidv4()}`, format: allowed[file.mimetype].slice(1) });
      return Upload.create({ id: uuidv4(), shop_id: shop._id, group_id: groupId, code, original_name: file.originalname, public_id: result.public_id, secure_url: result.secure_url, resource_type: result.resource_type, file_type: file.mimetype, file_size: file.size });
    }));
    res.json({ success: true, code, fileCount: records.length, groupId });
  } catch (e) { res.status(500).json({ error: 'Upload failed. Please try again.' }); }
}));
module.exports = router;
