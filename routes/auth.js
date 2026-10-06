const express = require('express');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const { Shop, User, Upload } = require('../db');
const { requireAuth, setAuthCookie, clearAuthCookie } = require('../middleware/auth');
const { deleteFile } = require('../utils/googleDrive');
const router = express.Router();
router.post('/login', async (req, res) => {
  const { username, password, shop: slug } = req.body || {};
  if (!username || !password) return res.status(400).json({ error: 'Username and password are required' });
  const shop = slug ? await Shop.findOne({ slug }) : null;
  const user = await User.findOne({ username, ...(shop ? { shop_id: shop._id } : {}) }).populate('shop_id');
  if (!user || !(await bcrypt.compare(password, user.password_hash))) return res.status(401).json({ error: 'Invalid credentials' });
  const s = user.shop_id; setAuthCookie(res, { userId: user._id.toString(), username, shopId: s._id.toString(), shopSlug: s.slug });
  res.json({ message: 'Logged in successfully', username, shop: { slug: s.slug, name: s.name } });
});
router.post('/logout', (req, res) => { clearAuthCookie(res); res.json({ message: 'Logged out successfully' }); });
router.delete('/account', requireAuth, async (req, res) => {
  const files = await Upload.find({ shop_id: req.shopId });
  await Promise.all(files.map(f => deleteFile(f.public_id, f.resource_type || (f.file_type?.startsWith('image/') ? 'image' : 'raw')).catch(() => null)));
  await Upload.deleteMany({ shop_id: req.shopId }); await User.deleteMany({ shop_id: req.shopId }); await Shop.deleteOne({ _id: req.shopId });
  clearAuthCookie(res); res.json({ success: true });
});
router.get('/check', async (req, res) => {
  try {
    const jwt = require('jsonwebtoken'); const token = req.headers.cookie?.split(';').map(v => v.trim()).find(v => v.startsWith('printdrop_token='))?.split('=')[1];
    const data = jwt.verify(decodeURIComponent(token), process.env.SESSION_SECRET || 'local-development-secret-change-me-please');
    const shop = await Shop.findById(data.shopId).select('id slug name'); if (!shop) return res.json({ authenticated: false });
    res.json({ authenticated: true, username: data.username, shop });
  } catch { res.json({ authenticated: false }); }
});
module.exports = router;
