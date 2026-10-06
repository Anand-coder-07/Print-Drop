const { Shop } = require('../db');
async function getShopBySlug(slug) { return Shop.findOne({ slug }); }
async function getDefaultShop() { return Shop.findOne().sort({ created_at: 1 }); }
async function resolveShop(slug) { return slug ? getShopBySlug(slug) : getDefaultShop(); }
module.exports = { getShopBySlug, getDefaultShop, resolveShop };
