import mongoose from 'mongoose';

const reviewSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    name: { type: String, required: true },
    rating: { type: Number, required: true },
    comment: { type: String, required: true },
  },
  { timestamps: true }
);

const productSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    // Storefront id, e.g. "bl1001": two category letters plus a running
    // number per category. Assigned once on create and never changed.
    code: { type: String, unique: true, sparse: true, index: true },
    description: { type: String, required: true },
    price: { type: Number, required: true, default: 0 },
    // List price before the offer. Shown struck through next to `price` when
    // it is higher; 0 means the product has no MRP.
    mrp: { type: Number, default: 0, min: 0 },
    category: { type: String, required: true },
    image: { type: String, required: true },
    // Full gallery, main photo first. `image` mirrors images[0] so older
    // screens (cards, cart, orders) keep working unchanged.
    images: [{ type: String }],
    sizes: [{ type: String }],
    colors: [{ type: String }],
    stock: { type: Number, required: true, default: 0 },
    reviews: [reviewSchema],
    rating: { type: Number, default: 0 },
    numReviews: { type: Number, default: 0 },
    featured: { type: Boolean, default: false },
    // Home page sections this product appears in. A product can be ticked for
    // more than one section (hero, 2nd section, last section).
    placements: {
      type: [String],
      enum: ['hero', 'curated', 'essentials'],
      default: [],
    },
  },
  { timestamps: true }
);

const Product = mongoose.model('Product', productSchema);
export default Product;
