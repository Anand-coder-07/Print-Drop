require('dotenv').config();
const express = require('express');
const helmet = require('helmet');
const path = require('path');
const QRCode = require('qrcode');
const { initDb, Shop } = require('./db');
const app = express();
let lastCleanup = 0;
app.use(helmet({ contentSecurityPolicy: false, crossOriginEmbedderPolicy: false }));
const limit = `${Math.min(100, Math.max(50, parseInt(process.env.MAX_REQUEST_SIZE_MB, 10) || 100))}mb`;
app.use(express.json({ limit }), express.urlencoded({ extended: true, limit }));
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'public', 'landing.html')));
app.get('/robots.txt', (req, res) => {
  const base = (process.env.BASE_URL || `${req.protocol}://${req.get('host')}`).replace(/\/$/, '');
  res.type('text/plain').send(`User-agent: *
Allow: /
Disallow: /api/
Disallow: /dashboard.html
Disallow: /login.html
Disallow: /owner.html
Disallow: /index.html
Disallow: /s/

Sitemap: ${base}/sitemap.xml
`);
});
app.get('/sitemap.xml', (req, res) => {
  const base = (process.env.BASE_URL || `${req.protocol}://${req.get('host')}`).replace(/\/$/, '');
  const lastmod = new Date().toISOString().slice(0, 10);
  res.type('application/xml').send(`<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>${base}/</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>1.0</priority>
  </url>
</urlset>`);
});
app.use(express.static(path.join(__dirname, 'public')));
app.use(async (req, res, next) => {
  try {
    await initDb();
    if (Date.now() - lastCleanup > 5 * 60 * 1000) {
      lastCleanup = Date.now();
      require('./utils/cleanup').cleanupExpiredUploads().catch(err => console.error('Cleanup failed:', err.message));
    }
    next();
  } catch (e) { next(e); }
});
app.get('/s/:slug', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));
app.get('/api/shops/:slug/qr.png', async (req, res) => {
  const shop = await Shop.findOne({ slug: req.params.slug }); if (!shop) return res.status(404).end();
  const base = (process.env.BASE_URL || `${req.protocol}://${req.get('host')}`).replace(/\/$/, '');
  res.type('png').send(await QRCode.toBuffer(`${base}/s/${shop.slug}`, { width: 400, margin: 2 }));
});
app.use('/api/auth', require('./routes/auth'));
app.use('/api/upload', require('./routes/upload'));
app.use('/api/uploads', require('./routes/dashboard'));
app.use('/api/shops', require('./routes/shops'));
app.use((err, req, res, next) => { console.error(err); res.status(500).json({ error: 'Internal server error' }); });
if (require.main === module) { const port = process.env.PORT || 3000; initDb().then(() => app.listen(port, () => console.log(`PrintDrop listening on ${port}`))).catch(err => { console.error(err); process.exit(1); }); }
module.exports = app;
