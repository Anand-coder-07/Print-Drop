const { Upload } = require('../db');
const { deleteFile } = require('./cloudinary');
async function cleanupExpiredUploads(ttlMinutes = +(process.env.UPLOAD_TTL_MINUTES || 30)) {
  const cutoff = new Date(Date.now() - ttlMinutes * 60000);
  const expired = await Upload.find({ created_at: { $lt: cutoff } });
  await Promise.all(expired.map(file => deleteFile(file.public_id).catch(() => null)));
  if (expired.length) await Upload.deleteMany({ _id: { $in: expired.map(f => f._id) } });
  return expired.length;
}
module.exports = { cleanupExpiredUploads };
