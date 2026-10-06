const { google } = require('googleapis');
const { Readable } = require('stream');

function drive() {
  const required = ['GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET', 'GOOGLE_REFRESH_TOKEN'];
  if (required.some(name => !process.env[name])) throw new Error('Google Drive OAuth is not configured.');
  const auth = new google.auth.OAuth2(process.env.GOOGLE_CLIENT_ID, process.env.GOOGLE_CLIENT_SECRET, process.env.GOOGLE_REDIRECT_URI || 'http://localhost');
  auth.setCredentials({ refresh_token: process.env.GOOGLE_REFRESH_TOKEN });
  return google.drive({ version: 'v3', auth });
}

function authClient() {
  const required = ['GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET', 'GOOGLE_REFRESH_TOKEN'];
  if (required.some(name => !process.env[name])) throw new Error('Google Drive OAuth is not configured.');
  const auth = new google.auth.OAuth2(process.env.GOOGLE_CLIENT_ID, process.env.GOOGLE_CLIENT_SECRET, process.env.GOOGLE_REDIRECT_URI || 'http://localhost');
  auth.setCredentials({ refresh_token: process.env.GOOGLE_REFRESH_TOKEN });
  return auth;
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

async function createUploadSession({ name, mimeType, size }) {
  const auth = authClient();
  const accessToken = (await auth.getAccessToken()).token;
  const response = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&fields=id,name,mimeType,size,webViewLink,webContentLink', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json; charset=UTF-8',
      'X-Upload-Content-Type': mimeType,
      'X-Upload-Content-Length': String(size)
    },
    body: JSON.stringify({ name, mimeType, ...(folderId() ? { parents: [folderId()] } : {}) })
  });
  if (!response.ok) throw new Error(`Google Drive session failed (${response.status}).`);
  const location = response.headers.get('location');
  if (!location) throw new Error('Google Drive did not return an upload session.');
  return location;
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

module.exports = { uploadBuffer, createUploadSession, deleteFile, downloadFile, driveFileId, isDriveUrl };
