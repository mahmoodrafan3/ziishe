import express from 'express';
import multer from 'multer';
import crypto from 'crypto';
import cloudinary from '../config/cloudinary.js';
import Product from '../models/Product.js';
import { protect, admin } from '../middleware/authMiddleware.js';
import { subscribe, broadcast } from '../utils/realtime.js';
import { nextProductCode } from '../utils/productCode.js';

const router = express.Router();

// Besides the main photo, a product can carry this many gallery photos.
const MAX_GALLERY_PHOTOS = 6;

const ALLOWED_IMAGE_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
]);

// Keep Multer only as the safe browser -> server gate. We do not persist files
// to the local disk any more; accepted files are streamed straight to Cloudinary.
const upload = multer({
  storage: multer.memoryStorage(),
  // One main photo plus the gallery photos, all in a single request.
  limits: { fileSize: 10 * 1024 * 1024, files: 1 + MAX_GALLERY_PHOTOS },
  fileFilter: (req, file, cb) => {
    if (!ALLOWED_IMAGE_TYPES.has(file.mimetype)) {
      return cb(new Error('UNSUPPORTED_FILE_TYPE'));
    }
    cb(null, true);
  },
});

const serverError = (res, err, context) => {
  console.error(`[products] ${context}:`, err?.message || err);
  res.status(500).json({ message: 'Something went wrong' });
};

const cloudinaryAssetId = (url) => {
  // Convert a Cloudinary delivery URL or transformation URL back into the
  // asset identifier the delete API expects. We parse it ourselves instead of
  // pulling in a URL parser so this module stays lightweight.
  const resourcePart = url.match(/cloudinary\.com\/[^/]+\/image\/upload\/([^?#]+)/);
  if (!resourcePart) return null;
  const parts = resourcePart[1].split('/');
  // Public IDs are the last parts before any version or file extension.
  let publicId = parts.pop();
  if (publicId.endsWith('.jpg') || publicId.endsWith('.jpeg') ||
      publicId.endsWith('.png') || publicId.endsWith('.webp') ||
      publicId.endsWith('.gif')) {
    publicId = publicId.slice(0, -4);
  }
  return {
    publicId,
    version: parts.pop(),
  };
};

const deleteOldCloudinaryImage = async (imageUrl) => {
  if (!imageUrl) return;
  try {
    const asset = cloudinaryAssetId(imageUrl);
    if (!asset) return;
    await cloudinary.api.delete_resources([asset.publicId], {
      resource_type: 'image',
      type: 'upload',
      invalidate: true,
    });
  } catch (err) {
    // Failing to clean up an old image must not block the admin flow. It is
    // still logged so stale assets can be removed later.
    console.warn('[products] failed to delete old Cloudinary image:', err?.message || err);
  }
};

const uploadToCloudinary = async (file) => {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder: 'ziishe-store/products',
        public_id: `product-${Date.now()}-${crypto.randomBytes(6).toString('hex')}`,
        transformation: {
          width: 1600,
          height: 1600,
          crop: 'limit',
          quality: 'auto',
          fetch_format: 'auto',
        },
        eager: [
          { width: 400, height: 500, crop: 'limit', quality: 'auto', fetch_format: 'auto' },
          { width: 800, height: 1000, crop: 'limit', quality: 'auto', fetch_format: 'auto' },
        ],
      },
      (error, result) => {
        if (error) {
          return reject(new Error(`Cloudinary upload failed: ${error.message || error}`));
        }
        if (!result || !result.secure_url) {
          return reject(new Error('Cloudinary did not return a usable URL'));
        }
        resolve(result.secure_url);
      }
    );

    stream.end(file.buffer);
  });
};

// Query values arrive as strings, but Express will hand back an object for
// input like ?category[$ne]=x. Coercing to String blocks that operator
// injection before it reaches the database.
const asString = (value) => (typeof value === 'string' ? value.trim() : '');

// GET /api/products
router.get('/', async (req, res) => {
  try {
    const category = asString(req.query.category);
    const search = asString(req.query.search);
    const featured = asString(req.query.featured);

    const query = {};
    if (category) query.category = category;
    if (featured) query.featured = featured === 'true';
    if (search) {
      // Escape regex metacharacters so a search term can't build a
      // pathological or overly broad pattern.
      const safe = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      query.name = { $regex: safe, $options: 'i' };
    }

    const products = await Product.find(query);
    res.json(products);
  } catch (err) {
    serverError(res, err, 'list');
  }
});

// GET /api/products/events — live catalogue updates for the storefront.
// Must be declared before `/:id` so it isn't read as a product id.
router.get('/events', (req, res) => {
  subscribe(req, res);
});

// GET /api/products/:id
router.get('/:id', async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) return res.status(404).json({ message: 'Product not found' });
    res.json(product);
  } catch (err) {
    // A malformed id is a not-found, not a server error.
    if (err.name === 'CastError') {
      return res.status(404).json({ message: 'Product not found' });
    }
    serverError(res, err, 'detail');
  }
});

// Files arrive in two fields: `image` (main photo) and `images` (gallery).
const uploadProductImages = upload.fields([
  { name: 'image', maxCount: 1 },
  { name: 'images', maxCount: MAX_GALLERY_PHOTOS },
]);

const uploadFiles = (files = []) => Promise.all(files.map(uploadToCloudinary));

// Keeps the gallery unique while preserving its order.
const dedupe = (urls) => [...new Set(urls.filter(Boolean))];

// Money fields arrive as strings from FormData.
const toMoney = (value) => {
  const amount = Number(value);
  return Number.isFinite(amount) && amount >= 0 ? amount : null;
};

// Only these home page placements are accepted from the admin form.
const HOME_PLACEMENTS = new Set(['hero', 'curated', 'essentials']);
const parsePlacements = (value) => {
  const list = parseList(value);
  if (!list) return null;
  return [...new Set(list.filter((item) => HOME_PLACEMENTS.has(item)))];
};

// Parse a JSON array field sent as a form string, tolerating bad input.
const parseList = (value) => {
  if (value === undefined) return null;
  if (Array.isArray(value)) return value.map(String);
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
};

// POST /api/products (Admin)
router.post('/', protect, admin, uploadProductImages, async (req, res) => {
  try {
    const { name, description, price, category, sizes, colors, stock, featured } = req.body;
    const mrp = toMoney(req.body.mrp);
    const primaryFile = req.files?.image?.[0];
    const primary = primaryFile
      ? await uploadToCloudinary(primaryFile)
      : asString(req.body.image);
    const uploadedGallery = await uploadFiles(req.files?.images || []);
    const images = dedupe([primary, ...uploadedGallery, ...(parseList(req.body.images) ?? [])]);
    if (!images.length) return res.status(400).json({ message: 'An image is required' });

    const data = {
      name,
      description,
      price,
      mrp: mrp ?? 0,
      category,
      image: images[0],
      images,
      sizes: parseList(sizes) ?? [],
      colors: parseList(colors) ?? [],
      stock,
      featured: featured === 'true',
      placements: parsePlacements(req.body.placements) ?? [],
    };

    // Two admins saving at the same moment can read the same last number;
    // retry with the next free code when the unique index rejects it.
    let product;
    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        product = await Product.create({ ...data, code: await nextProductCode(category) });
        break;
      } catch (err) {
        if (err?.code !== 11000 || attempt === 2) throw err;
      }
    }
    broadcast('products', { action: 'created', id: product._id });
    res.status(201).json(product);
  } catch (err) {
    if (err.name === 'ValidationError') {
      return res.status(400).json({ message: 'Invalid product data' });
    }
    if (err?.code === 11000) {
      return res.status(409).json({ message: 'Could not assign a product id, please retry' });
    }
    serverError(res, err, 'create');
  }
});

// PUT /api/products/:id (Admin)
router.put('/:id', protect, admin, uploadProductImages, async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) return res.status(404).json({ message: 'Product not found' });

    const { name, description, price, category, sizes, colors, stock, featured } = req.body;
    product.name = name ?? product.name;
    product.description = description ?? product.description;
    product.price = price ?? product.price;
    if (req.body.mrp !== undefined) product.mrp = toMoney(req.body.mrp) ?? 0;
    product.category = category ?? product.category;
    product.stock = stock ?? product.stock;
    product.featured = featured !== undefined ? featured === 'true' : product.featured;

    const nextSizes = parseList(sizes);
    const nextColors = parseList(colors);
    const nextPlacements = parsePlacements(req.body.placements);
    if (nextSizes) product.sizes = nextSizes;
    if (nextColors) product.colors = nextColors;
    if (nextPlacements) product.placements = nextPlacements;

    const currentImages = dedupe([product.image, ...(product.images || [])]);
    const primaryFile = req.files?.image?.[0];
    const primary = primaryFile
      ? await uploadToCloudinary(primaryFile)
      : (asString(req.body.image) || currentImages[0]);
    const uploadedGallery = await uploadFiles(req.files?.images || []);
    // Omitted `images` means "keep the photos the product already has".
    const keptExtras = parseList(req.body.images) ?? currentImages.slice(1);
    const images = dedupe([primary, ...uploadedGallery, ...keptExtras]);
    if (!images.length) return res.status(400).json({ message: 'An image is required' });

    product.image = images[0];
    product.images = images;

    // Products created before codes existed get one on their next save. The
    // code never changes afterwards, even if the category is renamed.
    if (!product.code) {
      product.code = await nextProductCode(product.category, product._id);
    }

    // Clean up Cloudinary assets that fell out of the gallery. URL-based
    // images are skipped because we do not own them.
    await Promise.all(
      currentImages
        .filter((url) => !images.includes(url) && url.includes('cloudinary.com'))
        .map(deleteOldCloudinaryImage)
    );

    const updated = await product.save();
    broadcast('products', { action: 'updated', id: updated._id });
    res.json(updated);
  } catch (err) {
    if (err.name === 'CastError') {
      return res.status(404).json({ message: 'Product not found' });
    }
    serverError(res, err, 'update');
  }
});

// PATCH /api/products/:id/placements (Admin)
// Toggles a product's home page sections without touching its photos or other
// fields — used by the Home page preview in the admin console.
router.patch('/:id/placements', protect, admin, async (req, res) => {
  try {
    const placements = parsePlacements(req.body?.placements);
    if (!placements) {
      return res.status(400).json({ message: 'placements must be an array' });
    }

    const product = await Product.findByIdAndUpdate(
      req.params.id,
      { placements },
      { new: true, runValidators: true }
    );
    if (!product) return res.status(404).json({ message: 'Product not found' });
    broadcast('products', { action: 'placements', id: product._id });
    res.json(product);
  } catch (err) {
    if (err.name === 'CastError') {
      return res.status(404).json({ message: 'Product not found' });
    }
    if (err.name === 'ValidationError') {
      return res.status(400).json({ message: 'Invalid placements' });
    }
    serverError(res, err, 'placements');
  }
});

// DELETE /api/products/:id (Admin)
router.delete('/:id', protect, admin, async (req, res) => {
  try {
    await Product.findByIdAndDelete(req.params.id);
    broadcast('products', { action: 'deleted', id: req.params.id });
    res.json({ message: 'Product removed' });
  } catch (err) {
    if (err.name === 'CastError') {
      return res.status(404).json({ message: 'Product not found' });
    }
    serverError(res, err, 'delete');
  }
});

// POST /api/products/:id/reviews
router.post('/:id/reviews', protect, async (req, res) => {
  try {
    const rating = Number(req.body.rating);
    const comment = String(req.body.comment || '').trim();

    if (!Number.isFinite(rating) || rating < 1 || rating > 5) {
      return res.status(400).json({ message: 'Rating must be between 1 and 5' });
    }
    if (!comment) return res.status(400).json({ message: 'A comment is required' });

    const product = await Product.findById(req.params.id);
    if (!product) return res.status(404).json({ message: 'Product not found' });

    const alreadyReviewed = product.reviews.find(
      (r) => r.user.toString() === req.user._id.toString()
    );
    if (alreadyReviewed) return res.status(400).json({ message: 'Already reviewed' });

    product.reviews.push({
      user: req.user._id,
      name: req.user.name,
      rating,
      comment,
    });
    product.numReviews = product.reviews.length;
    product.rating =
      product.reviews.reduce((a, r) => a + r.rating, 0) / product.reviews.length;

    await product.save();
    broadcast('products', { action: 'review', id: product._id });
    res.status(201).json({ message: 'Review added' });
  } catch (err) {
    if (err.name === 'CastError') {
      return res.status(404).json({ message: 'Product not found' });
    }
    serverError(res, err, 'review');
  }
});

export default router;
