import express from 'express';
import Category from '../models/Category.js';
import Product from '../models/Product.js';
import { protect, admin } from '../middleware/authMiddleware.js';
import { broadcast } from '../utils/realtime.js';

const router = express.Router();

const MAX_NAME = 40;

const serverError = (res, err, context) => {
  console.error(`[categories] ${context}:`, err?.message || err);
  res.status(500).json({ message: 'Something went wrong' });
};

const readName = (value) => String(value ?? '').trim().slice(0, MAX_NAME);
const slugify = (name) => name.toLowerCase();

// Products created before the category list existed still need to appear in it.
// Upserting their categories keeps the admin dropdown — and the storefront
// filter — complete without a migration step.
const syncFromProducts = async () => {
  const used = await Product.distinct('category');
  const names = used.map(readName).filter(Boolean);
  if (!names.length) return;

  // Legacy free-text categories can differ only by case; keep one per slug so
  // the batch cannot collide with itself on the unique index.
  const bySlug = new Map();
  names.forEach((name) => {
    if (!bySlug.has(slugify(name))) bySlug.set(slugify(name), name);
  });

  await Category.bulkWrite(
    [...bySlug.entries()].map(([slug, name]) => ({
      updateOne: {
        filter: { slug },
        update: { $setOnInsert: { name, slug } },
        upsert: true,
      },
    })),
    { ordered: false }
  );
};

// GET /api/categories — public, the shop filters and the admin form share it.
router.get('/', async (req, res) => {
  try {
    // A sync hiccup must not hide categories that are already stored.
    try {
      await syncFromProducts();
    } catch (err) {
      console.warn('[categories] sync from products failed:', err?.message || err);
    }
    const categories = await Category.find().sort({ name: 1 }).select('name');
    res.json(categories.map(({ _id, name }) => ({ _id, name })));
  } catch (err) {
    serverError(res, err, 'list');
  }
});

// POST /api/categories (Admin)
router.post('/', protect, admin, async (req, res) => {
  const name = readName(req.body?.name);
  if (!name) return res.status(400).json({ message: 'Category name is required' });

  try {
    const exists = await Category.findOne({ slug: slugify(name) });
    if (exists) return res.status(409).json({ message: 'That category already exists' });

    const category = await Category.create({ name, slug: slugify(name) });
    broadcast('categories', { action: 'created', id: category._id });
    res.status(201).json(category);
  } catch (err) {
    // A concurrent create can still hit the unique index.
    if (err.code === 11000) {
      return res.status(409).json({ message: 'That category already exists' });
    }
    serverError(res, err, 'create');
  }
});

// PUT /api/categories/:id (Admin) — renames the category and every product in it.
router.put('/:id', protect, admin, async (req, res) => {
  const name = readName(req.body?.name);
  if (!name) return res.status(400).json({ message: 'Category name is required' });

  try {
    const category = await Category.findById(req.params.id);
    if (!category) return res.status(404).json({ message: 'Category not found' });

    const duplicate = await Category.findOne({
      slug: slugify(name),
      _id: { $ne: category._id },
    });
    if (duplicate) return res.status(409).json({ message: 'That category already exists' });

    const previous = category.name;
    category.name = name;
    category.slug = slugify(name);
    await category.save();

    if (previous !== name) {
      await Product.updateMany({ category: previous }, { $set: { category: name } });
      broadcast('products', { action: 'category', id: category._id });
    }
    broadcast('categories', { action: 'renamed', id: category._id });
    res.json(category);
  } catch (err) {
    if (err.code === 11000) {
      return res.status(409).json({ message: 'That category already exists' });
    }
    if (err.name === 'CastError') {
      return res.status(404).json({ message: 'Category not found' });
    }
    serverError(res, err, 'rename');
  }
});

// DELETE /api/categories/:id (Admin) — only when no product is using it.
router.delete('/:id', protect, admin, async (req, res) => {
  try {
    const category = await Category.findById(req.params.id);
    if (!category) return res.status(404).json({ message: 'Category not found' });

    const inUse = await Product.countDocuments({ category: category.name });
    if (inUse > 0) {
      return res.status(409).json({
        message: `${inUse} product${inUse === 1 ? ' still uses' : 's still use'} this category`,
      });
    }

    await category.deleteOne();
    broadcast('categories', { action: 'deleted', id: category._id });
    res.json({ message: 'Category removed' });
  } catch (err) {
    if (err.name === 'CastError') {
      return res.status(404).json({ message: 'Category not found' });
    }
    serverError(res, err, 'delete');
  }
});

export default router;
