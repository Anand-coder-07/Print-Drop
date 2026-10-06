const { google } = require('googleapis');
const { Readable } = require('stream');

function drive() {
  const required = ['GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET', 'GOOGLE_REFRESH_TOKEN'];
  if (required.some(name => !process.env[name])) throw new Error('Google Drive OAuth is not configured.');
  const auth = new google.auth.OAuth2(process.env.GOOGLE_CLIENT_ID, process.env.GOOGLE_CLIENT_SECRET, process.env.GOOGLE_REDIRECT_URI || 'http://localhost');
  auth.setCredentials({ refresh_token: process.env.GOOGLE_REFRESH_TOKEN });
  return google.drive({ version: 'v3', auth });
}

function folderId() {
  return process.env.GOOGLE_DRIVE_FOLDER_ID || undefined;
}

async function uploadBuffer(buffer, { name, mimeType }) {
  const result = await drive().files.create({
    requestBody: { name, ...(folderId() ? { parents: [folderId()] } : {}) },
    media: { mimeType, body: Readable.from(buffer) },
    fields: 'id,name,mimeType,size,webViewLink,webContentLink'
  });
  const file = result.data;
  return {
    public_id: file.id,
    secure_url: file.webViewLink || `https://drive.google.com/file/d/${file.id}/view`,
    resource_type: 'drive',
    file
  };
}

async function deleteFile(fileId) {
  if (fileId) await drive().files.delete({ fileId });
}

async function downloadFile(fileId) {
  if (!fileId) throw new Error('Google Drive file ID is required.');
  const result = await drive().files.get({ fileId, alt: 'media' }, { responseType: 'stream' });
  return result;
}

function driveFileId(value) {
  if (!value || typeof value !== 'string') return null;
  const match = value.match(/(?:drive\.google\.com\/file\/d\/|drive\.google\.com\/open\?id=|[?&]id=)([a-zA-Z0-9_-]+)/);
  return match ? match[1] : /^[a-zA-Z0-9_-]{10,}$/.test(value) ? value : null;
}

function isDriveUrl(value, id) {
  return typeof value === 'string' && /^https:\/\/drive\.google\.com\/(?:file\/d\/[a-zA-Z0-9_-]+\/view(?:\?.*)?|open\?id=[a-zA-Z0-9_-]+)$/.test(value)
    && driveFileId(value) === id;
}

module.exports = { uploadBuffer, deleteFile, downloadFile, driveFileId, isDriveUrl };
