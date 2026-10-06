const cloudinary = require('cloudinary').v2;
cloudinary.config({ cloud_name: process.env.CLOUDINARY_CLOUD_NAME, api_key: process.env.CLOUDINARY_API_KEY, api_secret: process.env.CLOUDINARY_API_SECRET });
function uploadBuffer(buffer, options = {}) {
  return new Promise((resolve, reject) => cloudinary.uploader.upload_stream({ resource_type: 'auto', folder: 'printdrop', ...options }, (e, r) => e ? reject(e) : resolve(r)).end(buffer));
}
function deleteFile(publicId, resourceType = 'raw') {
  return publicId ? cloudinary.uploader.destroy(publicId, { resource_type: resourceType === 'image' ? 'image' : 'raw' }) : Promise.resolve();
}
module.exports = { uploadBuffer, deleteFile, cloudinary };
