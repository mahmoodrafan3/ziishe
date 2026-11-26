import mongoose from 'mongoose';
import Coupon from '../models/Coupon.js';
import Product from '../models/Product.js';

const rupees = (n) => `₹${Number(n).toLocaleString('en-IN')}`;

const normalise = (value) => String(value ?? '').trim().toLowerCase();

/**
 * Subtotal of the cart lines this coupon actually covers. `all` coupons use
 * the whole subtotal; scoped ones only add up matching products/categories.
 */
const eligibleSubtotal = async (coupon, subtotal, items) => {
  // Coupons created before scoping existed have no `scope` field.
  const scope = coupon.scope || 'all';
  if (scope === 'all') return { total: subtotal, scoped: false, known: true };
  if (!Array.isArray(items) || items.length === 0) {
    return { total: 0, scoped: true, known: false };
  }

  const ids = [...new Set(items.map((item) => String(item?.product || '')))]
    .filter((id) => mongoose.isValidObjectId(id));
  const products = ids.length
    ? await Product.find({ _id: { $in: ids } }).select('category')
    : [];
  const categoryById = new Map(
    products.map((product) => [String(product._id), normalise(product.category)])
  );

  const wantedProducts = new Set((coupon.products || []).map(String));
  const wantedCategories = new Set((coupon.categories || []).map(normalise));

  const total = items.reduce((sum, item) => {
    const id = String(item?.product || '');
    const matches = scope === 'products'
      ? wantedProducts.has(id)
      : wantedCategories.has(categoryById.get(id) || '');
    if (!matches) return sum;
    const price = Number(item?.price) || 0;
    const qty = Number(item?.qty) || 0;
    return sum + price * qty;
  }, 0);

  return { total, scoped: true, known: true };
};

/**
 * Resolve a coupon code against a cart.
 * `items` is the cart as [{ product, price, qty }] and is required for
 * coupons scoped to certain products or categories.
 * Returns { valid: true, coupon, discount } or { valid: false, message }.
 */
export const validateCoupon = async (rawCode, subtotal, items = []) => {
  const code = String(rawCode || '').trim().toUpperCase();
  if (!code) return { valid: false, message: 'Enter a coupon code' };

  const coupon = await Coupon.findOne({ code });
  if (!coupon) return { valid: false, message: 'Invalid coupon code' };
  if (!coupon.active) return { valid: false, message: 'This coupon is no longer active' };
  if (coupon.expiresAt && coupon.expiresAt < new Date()) {
    return { valid: false, message: 'This coupon has expired' };
  }

  const { total: eligible, scoped, known } = await eligibleSubtotal(coupon, subtotal, items);
  if (scoped && !known) {
    return { valid: false, message: 'This coupon applies only to selected items' };
  }
  if (scoped && eligible <= 0) {
    return { valid: false, message: 'This coupon doesn’t apply to the items in your cart' };
  }
  if (eligible < coupon.minSubtotal) {
    const short = coupon.minSubtotal - eligible;
    return {
      valid: false,
      message: scoped
        ? `Add ${rupees(short)} more of eligible items to use this coupon`
        : `Add ${rupees(short)} more to use this coupon`,
    };
  }

  return { valid: true, coupon, discount: coupon.discountFor(eligible) };
};
