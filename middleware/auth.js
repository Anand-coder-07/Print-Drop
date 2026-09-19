/**
 * Express middleware that checks for an active session.
 * Returns 401 if the user is not authenticated.
 */
function requireAuth(req, res, next) {
  if (req.session && req.session.userId) {
    return next();
  }
  return res.status(401).json({ error: 'Authentication required' });
}

module.exports = { requireAuth };
