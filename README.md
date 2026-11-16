# ZiiShe — Dress the Future

A fullstack fashion e-commerce store (MERN) built with the **same design system, theme and architecture** as the *Tomorrow Store* reference project, rebranded for **ZiiShe**.

> Same look & feel, new brand. Cream/black/gold luxury-minimal theme, 3D hero, editorial product grids, dark admin portal.

---

## 1. Project design (architecture)

```
ZiiShe/
├── package.json          # root scripts: dev / server / client / seed / build
├── .env.example          # copy to .env — no secrets committed
├── client/               # React 19 + Vite 8 SPA (storefront + admin portal)
│   ├── index.html        # fonts (Syne / Cormorant / Jakarta), title, theme-color
│   ├── vite.config.js    # :5173, proxies /api + /uploads -> :5000
│   ├── vercel.json       # SPA rewrite for client-side routing
│   ├── public/images/    # hero + product imagery (same as reference)
│   └── src/
│       ├── App.jsx               # routes + providers + 404
│       ├── index.css             # full design system (see §2)
│       ├── components/           # Navbar, Hero3D, ProductCard, CartDrawer, Footer…
│       ├── context/              # AuthContext, AdminAuthContext, CartContext
│       ├── hooks/useReveal.js    # scroll-reveal
│       ├── utils/api.js          # axios baseURL + JWT interceptor
│       └── pages/                # Home, Shop, ProductDetail, Checkout,
│                                 # Login, Register, Profile + /profile/* settings,
│                                 # AdminLogin, AdminDashboard
└── server/               # Express 4 API (ES modules)
    ├── index.js          # helmet, CORS, rate-limit, routes, health, error handler
    ├── config/           # db.js (Mongo retry), cloudinary.js
    ├── middleware/       # authMiddleware.js (protect / admin, HS256 only)
    ├── models/           # User, Product (+reviews), Order, Coupon
    ├── routes/           # auth, products (Multer→Cloudinary), orders, coupons
    ├── utils/coupon.js   # server-side coupon validation
    └── seeder.js         # 14 products + 3 coupons + admin (see §4)
```

### Data model

| Model | Key fields |
|---|---|
| **User** | name, email (unique, case-insensitive), bcrypt password, isAdmin, phone, gender, dob, addresses[], preferences{notifications, privacy, language} |
| **Product** | name, description, price (₹), category, image, sizes[], colors[], stock, featured, rating, numReviews, reviews[] |
| **Order** | user, orderItems[{product,name,image,price,qty,size,color}], shippingAddress, itemsPrice, discount, couponCode, totalPrice, status(pending→delivered), isPaid/isDelivered |
| **Coupon** | code, type(percent/fixed), value, minSubtotal, expiresAt, active |

### API (base `/api`)

| Method & path | Auth | Purpose |
|---|---|---|
| `POST /auth/register` · `POST /auth/login` | — | customer signup/login (admins blocked here) |
| `POST /auth/admin/login` · `GET /auth/admin/me` | — / admin | separate admin portal |
| `GET /auth/me` · `PUT /auth/profile` · `PUT /auth/preferences` | user | profile & settings |
| `POST /auth/addresses` · `DELETE /auth/addresses/:id` | user | saved addresses |
| `GET /products?category=&search=&featured=` · `GET /products/:id` | — | catalogue |
| `POST /products` · `PUT /products/:id` · `DELETE /products/:id` | admin | CRUD + image upload (10 MB, JPG/PNG/WEBP/GIF → Cloudinary) |
| `POST /products/:id/reviews` | user | 1 review per user, rating 1–5 |
| `POST /orders` · `GET /orders/myorders` · `GET /orders/:id` | user | checkout (totals recomputed server-side) |
| `GET /orders` · `PUT /orders/:id/status` | admin | all orders + status |
| `POST /coupons/validate` | — | preview discount (re-validated on order) |
| `GET /health` | — | `{status, database}` |

Security: helmet, CORS allowlist, 100 KB body cap, auth rate-limit 30/15 min, API 300/15 min, generic 500s, JWT HS256-pinned, server-side price/coupon recomputation, injection-safe query coercion + regex escaping.

### Frontend routes

`/` Home · `/shop` (category + search) · `/product/:id` (size/color, reviews, delivery check, similar row) · `/checkout` (coupon) · `/login` `/register` · `/profile` + `/profile/{settings,addresses,language,notifications,privacy,terms,faqs}` · `/admin/login` `/admin` · `*` 404 dark page.
Cart is a slide-in drawer persisted in `localStorage` (`ziishe_cart`); sessions: `ziishe_user` (customer) / `ziishe_admin` (admin, separate bucket).

---

## 2. Theme — identical to the reference

| Token | Value | Use |
|---|---|---|
| `--cream` / `--cream-dark` / `--cream-light` | `#F5F0E8` / `#EDE6D6` / `#FAF7F2` | page background, cards, inputs |
| `--black` / `--black-soft` / `--black-mid` | `#0D0D0D` / `#1A1A1A` / `#2A2A2A` | navbar, footer, admin, buttons |
| `--gold` / `--gold-light` | `#C9A96E` / `#DFC08A` | accents, badges, ratings, focus rings |
| `--gray` / `--gray-light` | `#888888` / `#CCCCCC` | muted text |
| Display font | **Syne** 500–800 | headings, logo, prices |
| Serif font | **Cormorant Garamond** italic | hero subtitle, quotes, 404 |
| Sans font | **Plus Jakarta Sans** 300–700 | body, buttons, forms |
| Motion | `--ease-cinematic: cubic-bezier(.16,1,.3,1)`, 300–1200 ms, slow cinematic | hovers, reveals, marquee |
| Radius / shadow | 4–24 px, soft large shadows + gold glow | cards, buttons, modals |
| Layout | max-width 1400 px, fluid `--px`, 72 px fixed black navbar | — |

Signature pieces: full-screen cream **3D hero** (grain + gold radial glow, outlined display type, 9:16 portrait photo pinned right, scroll mouse), black **marquee strip**, **editorial grid** (1 large + 3), category tiles, 3/4 product cards with hover zoom + dark overlay CTA, customer-review carousel, newsletter band, dark footer, dark admin dashboard + separate dark admin login with gold grid.

All of this lives in `client/src/index.css` (unchanged design system) — rebrand only changed names/keys, not the theme.

---

## 3. Run it

```bash
# 1. env (root)
cp .env.example .env        # fill MONGO_URI, JWT_SECRET, Cloudinary keys
#    client/.env (optional): VITE_API_URL=http://localhost:5000

# 2. install
npm install                 # root + server deps
npm install --prefix client # client deps

# 3. run
npm run dev                 # API :5000 + Vite :5173 (proxied)
# health: http://localhost:5000/api/health
```

## 4. Seed

```bash
npm run seed                # wipes + seeds: 14 products, ZIISHE10 / FIRST500 / VOID25,
#                           # plus an admin account saved in MongoDB (generated password is printed once)
npm run seed -- --append    # safe re-run: only adds missing products
npm run create-admin        # create/repair/reset the admin in MongoDB WITHOUT wiping anything
npm run create-admin -- --email=admin@ziishe.com --password='MyPass123'
#                           # set a specific admin password (min 8 chars, letters + numbers)
```

Admin credentials live only in MongoDB (bcrypt hash) — `.env` is not used for them.
To reset the password later, re-run `npm run create-admin`.

## 5. Deploy

- **Client → Vercel** (`client/vercel.json` handles SPA routing). Set `VITE_API_URL` to your API URL.
- **Server → Render/Railway** (`PORT`, `MONGO_URI`, `JWT_SECRET`, Cloudinary envs). Update `ALLOWED_ORIGINS` in `server/index.js` to your Vercel URL.
