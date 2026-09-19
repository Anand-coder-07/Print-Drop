const cron = require('node-cron');
const fs = require('fs');
const { queryAll, execute } = require('../db');

let ioInstance = null;

function setIo(io) {
  ioInstance = io;
}

/**
 * Starts a cron job that runs every 5 minutes to delete expired uploads.
 * Files older than UPLOAD_TTL_MINUTES are removed from disk and database.
 */
function startCleanupJob() {
  const ttlMinutes = parseInt(process.env.UPLOAD_TTL_MINUTES) || 30;

  // Run every 5 minutes
  cron.schedule('*/5 * * * *', () => {
    try {
      cleanupExpiredUploads(ttlMinutes);
    } catch (err) {
      console.error('❌ Cleanup job error:', err.message);
    }
  });

  console.log(`🧹 Cleanup job started (TTL: ${ttlMinutes} min, runs every 5 min)`);
}

function cleanupExpiredUploads(ttlMinutes) {
  const cutoff = new Date(Date.now() - ttlMinutes * 60 * 1000).toISOString();

  const expired = queryAll(
    'SELECT id, file_path, group_id FROM uploads WHERE created_at < ?',
    [cutoff]
  );

  if (expired.length === 0) return;

  const deletedGroupIds = new Set();

  for (const file of expired) {
    // Delete file from disk
    try {
      if (fs.existsSync(file.file_path)) {
        fs.unlinkSync(file.file_path);
      }
    } catch (err) {
      console.error(`Failed to delete file ${file.file_path}:`, err.message);
    }

    // Delete from database
    execute('DELETE FROM uploads WHERE id = ?', [file.id]);
    deletedGroupIds.add(file.group_id);
  }

  console.log(`🧹 Cleaned up ${expired.length} expired file(s)`);

  // Notify dashboard
  if (ioInstance) {
    for (const groupId of deletedGroupIds) {
      ioInstance.emit('upload-removed', { groupId });
    }
  }
}

module.exports = { startCleanupJob, setIo, cleanupExpiredUploads };
