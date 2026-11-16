import dotenv from 'dotenv';
dotenv.config();
import express from 'express';
import cors from 'cors';
import mongoose from 'mongoose';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import connectDB from './config/db.js';
import './config/cloudinary.js';
import authRoutes from './routes/authRoutes.js';
import productRoutes from './routes/productRoutes.js';
import orderRoutes from './routes/orderRoutes.js';
import couponRoutes from './routes/couponRoutes.js';

// Refuse to boot without a strong signing secret. Falling through would
// otherwise let jsonwebtoken sign with `undefined` (trivially forgeable), and
// a short or placeholder secret can be brute-forced offline. HMAC secrets
// should carry at least 256 bits of entropy — 32 characters is the floor.
const WEAK_JWT_SECRETS = new Set([
  'secret', 'jwt_secret', 'jwtsecret', 'changeme', 'change-me', 'supersecret',
  'your_jwt_secret', 'yoursecret', 'development', 'test', 'password', '123456',
]);
const jwtSecret = String(process.env.JWT_SECRET || '');
if (!jwtSecret) {
  console.error('❌ JWT_SECRET is not set — refusing to start.');
  process.exit(1);
}
if (jwtSecret.length < 32 || WEAK_JWT_SECRETS.has(jwtSecret.toLowerCase())) {
  console.error(
    '❌ JWT_SECRET is too weak — use at least 32 random characters '
      + '(e.g. node -e "console.log(require(\'crypto\').randomBytes(48).toString(\'base64url\'))").'
  );
  process.exit(1);
}

connectDB();

const app = express();

// Render (and most hosts) sit behind a proxy; without this, every request
// looks like it comes from the proxy and rate limiting would bucket everyone
// together. `1` = trust the first hop only.
app.set('trust proxy', 1);

// Security headers. contentSecurityPolicy is off because this service only
// returns JSON — the SPA's CSP is set by Vercel, where the HTML is served.
app.use(helmet({ contentSecurityPolicy: false, crossOriginResourcePolicy: false }));

// Allow the deployed Vercel frontend (and localhost for dev) to call this API.
// CLIENT_URL accepts one or more comma-separated origins, so preview deploys
// (e.g. https://ziishe-git-main-xyz.vercel.app) can be added without a deploy.
const CLIENT_ORIGINS = String(process.env.CLIENT_URL || '')
  .split(',')
  .map((origin) => origin.trim().replace(/\/$/, ''))
  .filter(Boolean);

const ALLOWED_ORIGINS = [
  'http://localhost:5173',
  'https://ziishe.vercel.app',
  ...CLIENT_ORIGINS,
];
// Pass the array directly — the cors package matches it natively. Passing a
// function here would require calling its callback or every request hangs.
app.use(cors({
  origin: ALLOWED_ORIGINS,
  credentials: true,
}));

// Cap request bodies so a large payload can't exhaust memory.
app.use(express.json({ limit: '100kb' }));
app.use(express.urlencoded({ extended: true, limit: '100kb' }));

// The admin portal is the highest-value door: allow far fewer attempts there
// than on the storefront, and only count failures so a legitimate admin is
// never locked out by their own successful logins.
const adminLoginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  skipSuccessfulRequests: true,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { message: 'Too many admin sign-in attempts. Please try again in 15 minutes.' },
});
app.use('/api/auth/admin/login', adminLoginLimiter);

// Slow down credential stuffing / brute force on the auth endpoints.
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { message: 'Too many attempts. Please try again later.' },
});
app.use('/api/auth', authLimiter);

// A looser ceiling for the rest of the API.
app.use('/api', rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { message: 'Too many requests. Please try again later.' },
}));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/products', productRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/coupons', couponRoutes);

// Health check — reflects actual DB connection state
app.get('/api/health', (req, res) => {
  const dbState = mongoose.connection.readyState;
  const dbStatus = dbState === 1 ? 'connected' : 'disconnected';
  res.json({
    status: dbState === 1 ? 'OK' : 'DEGRADED',
    message: 'ZiiShe Store API Running 🖤',
    database: dbStatus,
  });
});

// Unknown API paths must not fall through to anything else.
app.use('/api', (req, res) => res.status(404).json({ message: 'Not found' }));

// Central error handler. Logs the real error server-side but never returns
// internals (stack traces, driver messages) to the caller.
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  if (res.headersSent) return next(err);

  // Multer rejects oversized / unexpected uploads with its own codes.
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(413).json({ message: 'File is too large' });
  }
  if (err.message === 'UNSUPPORTED_FILE_TYPE') {
    return res.status(400).json({ message: 'Only JPG, PNG, WEBP or GIF images are allowed' });
  }
  if (err.type === 'entity.too.large') {
    return res.status(413).json({ message: 'Request body is too large' });
  }
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ message: 'Malformed JSON body' });
  }

  res.status(500).json({ message: 'Something went wrong' });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`🚀 Server running on http://localhost:${PORT}`));
