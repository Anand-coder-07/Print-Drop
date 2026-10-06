const jwt = require('jsonwebtoken');
function secret() { return process.env.SESSION_SECRET || 'local-development-secret-change-me-please'; }
function readToken(req) {
  const value = req.headers.cookie?.split(';').map(v => v.trim()).find(v => v.startsWith('printdrop_token='));
  return value ? decodeURIComponent(value.split('=')[1]) : null;
}
function requireAuth(req, res, next) {
  try {
    const token = readToken(req);
    req.user = jwt.verify(token, secret());
    req.shopId = req.user.shopId;
    next();
  } catch { res.status(401).json({ error: 'Authentication required' }); }
}
function setAuthCookie(res, payload) {
  const token = jwt.sign(payload, secret(), { expiresIn: '24h' });
  res.setHeader('Set-Cookie', `printdrop_token=${encodeURIComponent(token)}; HttpOnly; Path=/; SameSite=Lax; Max-Age=86400${process.env.NODE_ENV === 'production' ? '; Secure' : ''}`);
}
function clearAuthCookie(res) { res.setHeader('Set-Cookie', 'printdrop_token=; HttpOnly; Path=/; SameSite=Lax; Max-Age=0'); }
module.exports = { requireAuth, setAuthCookie, clearAuthCookie };
