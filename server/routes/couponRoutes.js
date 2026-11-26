import express from 'express';
import mongoose from 'mongoose';
import Coupon from '../models/Coupon.js';
import { protect, admin } from '../middleware/authMiddleware.js';
import { validateCoupon } from '../utils/coupon.js';

const router = express.Router();

const MAX_CODE = 24;
const MAX_DESCRIPTION = 160;

const serverError = (res, err, context) => {
  console.error(`[coupons] ${context}:`, err?.message || err);
  res.status(500).json({ message: 'Something went wrong' });
};

const readItems = (items) =>
  (Array.isArray(items) ? items : [])
    .filter((item) => item && item.product)
    .map((item) => ({ product: item.product, price: item.price, qty: item.qty }));

// POST /api/coupons/validate
// Body: { code, subtotal, items: [{ product, price, qty }] } → the discount the
// coupon gives on the eligible part of the cart. The order endpoint
// re-validates, so the client result is only a preview.
router.post('/validate', async (req, res) => {
  try {
    const subtotal = Number(req.body.subtotal) || 0;
    const result = await validateCoupon(req.body.code, subtotal, readItems(req.body.items));
    if (!result.valid) return res.status(400).json({ message: result.message });

    res.json({
      code: result.coupon.code,
      type: result.coupon.type,
      value: result.coupon.value,
      description: result.coupon.description,
      scope: result.coupon.scope,
      discount: result.discount,
    });
  } catch (err) {
    serverError(res, err, 'validate');
  }
});

/* ── Admin CRUD ─────────────────────────────────────────────── */

const parseCoupon = (body) => {
  const data = {};

  const code = String(body.code ?? '').trim().toUpperCase().replace(/\s+/g, '');
  if (!code) return { error: 'Coupon code is required' };
  if (code.length > MAX_CODE) return { error: `Coupon code must be ${MAX_CODE} characters or fewer` };
  data.code = code;

  if (body.type !== 'percent' && body.type !== 'fixed') {
    return { error: 'Discount type must be percent or fixed' };
  }
  data.type = body.type;

  const value = Number(body.value);
  if (!Number.isFinite(value) || value <= 0) return { error: 'Enter a discount value' };
  if (data.type === 'percent' && value > 100) return { error: 'A percentage discount cannot exceed 100' };
  data.value = Math.round(value * 100) / 100;

  const scope = body.scope ?? 'all';
  if (!['all', 'products', 'categories'].includes(scope)) {
    return { error: 'Choose what this coupon applies to' };
  }
  data.scope = scope;

  const products = Array.isArray(body.products) ? [...new Set(body.products.map(String))] : [];
  if (products.some((id) => !mongoose.isValidObjectId(id))) {
    return { error: 'One of the selected products is invalid' };
  }
  data.products = scope === 'products' ? products : [];
  if (scope === 'products' && products.length === 0) {
    return { error: 'Pick at least one product for this coupon' };
  }

  const categories = Array.isArray(body.categories)
    ? [...new Set(body.categories.map((name) => String(name).trim()).filter(Boolean))]
    : [];
  data.categories = scope === 'categories' ? categories : [];
  if (scope === 'categories' && categories.length === 0) {
    return { error: 'Pick at least one category for this coupon' };
  }

  const minSubtotal = Number(body.minSubtotal ?? 0);
  if (!Number.isFinite(minSubtotal) || minSubtotal < 0) {
    return { error: 'Minimum order value must be zero or more' };
  }
  data.minSubtotal = Math.round(minSubtotal);

  data.description = String(body.description ?? '').trim().slice(0, MAX_DESCRIPTION);
  data.active = body.active === undefined ? true : Boolean(body.active);

  if (body.expiresAt) {
    const expires = new Date(body.expiresAt);
    if (Number.isNaN(expires.getTime())) return { error: 'Enter a valid expiry date' };
    data.expiresAt = expires;
  } else {
    data.expiresAt = null;
  }

  return { data };
};

// GET /api/coupons (Admin)
router.get('/', protect, admin, async (req, res) => {
  try {
    const coupons = await Coupon.find().sort({ createdAt: -1 });
    res.json(coupons);
  } catch (err) {
    serverError(res, err, 'list');
  }
});

// POST /api/coupons (Admin)
router.post('/', protect, admin, async (req, res) => {
  try {
    const { data, error } = parseCoupon(req.body || {});
    if (error) return res.status(400).json({ message: error });

    const coupon = await Coupon.create(data);
    res.status(201).json(coupon);
  } catch (err) {
    if (err?.code === 11000) {
      return res.status(409).json({ message: 'A coupon with this code already exists' });
    }
    serverError(res, err, 'create');
  }
});

// PUT /api/coupons/:id (Admin)
router.put('/:id', protect, admin, async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ message: 'Invalid coupon' });
    }
    const { data, error } = parseCoupon(req.body || {});
    if (error) return res.status(400).json({ message: error });

    const coupon = await Coupon.findByIdAndUpdate(req.params.id, data, {
      new: true,
      runValidators: true,
    });
    if (!coupon) return res.status(404).json({ message: 'Coupon not found' });
    res.json(coupon);
  } catch (err) {
    if (err?.code === 11000) {
      return res.status(409).json({ message: 'A coupon with this code already exists' });
    }
    serverError(res, err, 'update');
  }
});

// DELETE /api/coupons/:id (Admin)
router.delete('/:id', protect, admin, async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ message: 'Invalid coupon' });
    }
    const coupon = await Coupon.findByIdAndDelete(req.params.id);
    if (!coupon) return res.status(404).json({ message: 'Coupon not found' });
    res.json({ message: 'Coupon deleted' });
  } catch (err) {
    serverError(res, err, 'delete');
  }
});

export default router;
