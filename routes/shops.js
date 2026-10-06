const express = require('express');
const { Shop, User } = require('../db');
const bcrypt = require('bcryptjs');
const { requireAuth } = require('../middleware/auth');
const router = express.Router();
router.post('/signup', async (req, res) => {
  const { name, username, password } = req.body || {};
  if (!name || !username || !password || password.length < 8) return res.status(400).json({ error: 'Shop name, a unique username and an 8+ character password are required' });
  if (await User.exists({ username })) return res.status(409).json({ error: 'This username is already taken. Please choose another one.' });
  const base = name.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40) || 'print-shop';
  let slug = base, i = 2; while (await Shop.exists({ slug })) slug = `${base}-${i++}`;
  const shop = await Shop.create({ slug, name }); await User.create({ username, password_hash: await bcrypt.hash(password, 10), shop_id: shop._id });
  res.status(201).json({ shop: { id: shop._id, slug, name }, uploadUrl: `/s/${slug}` });
});
router.get('/current', requireAuth, async (req, res) => { const shop = await Shop.findById(req.shopId).select('slug name created_at'); if (!shop) return res.status(404).json({ error: 'Shop not found' }); res.json({ shop }); });
router.get('/:slug', async (req, res, next) => { const shop = await Shop.findOne({ slug: req.params.slug }).select('slug name'); if (!shop) return next(); res.json({ shop }); });
module.exports = router;
