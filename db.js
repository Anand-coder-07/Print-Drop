const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

let connection;
const shopSchema = new mongoose.Schema({ slug: { type: String, unique: true }, name: String }, { timestamps: { createdAt: 'created_at', updatedAt: false } });
const userSchema = new mongoose.Schema({ username: String, password_hash: String, shop_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Shop' } }, { timestamps: { createdAt: 'created_at', updatedAt: false } });
userSchema.index({ username: 1, shop_id: 1 }, { unique: true });
const uploadSchema = new mongoose.Schema({
  id: { type: String, unique: true }, shop_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Shop' },
  group_id: String, code: String, original_name: String, public_id: String, secure_url: String, resource_type: String,
  file_type: String, file_size: Number, status: { type: String, default: 'pending' }
}, { timestamps: { createdAt: 'created_at', updatedAt: false } });
uploadSchema.index({ shop_id: 1, status: 1, created_at: -1 });
const Shop = mongoose.models.Shop || mongoose.model('Shop', shopSchema);
const User = mongoose.models.User || mongoose.model('User', userSchema);
const Upload = mongoose.models.Upload || mongoose.model('Upload', uploadSchema);

async function initDb() {
  if (mongoose.connection.readyState !== 1) {
    if (!process.env.MONGODB_URI) throw new Error('MONGODB_URI is required');
    connection = connection || mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 10000 });
    await connection;
  }
  let shop = await Shop.findOne().sort({ created_at: 1 });
  if (!shop) shop = await Shop.create({ slug: process.env.DEFAULT_SHOP_SLUG || 'default', name: process.env.DEFAULT_SHOP_NAME || 'PrintDrop' });
  const username = process.env.OWNER_USERNAME;
  const password = process.env.OWNER_PASSWORD;
  if (username && password && !(await User.exists({ username, shop_id: shop._id }))) {
    await User.create({ username, password_hash: await bcrypt.hash(password, 10), shop_id: shop._id });
  }
  return { Shop, User, Upload };
}
function getModels() { return { Shop, User, Upload }; }
module.exports = { initDb, getModels, Shop, User, Upload };
