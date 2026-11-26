import mongoose from 'mongoose';

// Editable list of catalogue categories. `slug` is the lowercase form of the
// name and carries the unique index, so "Hoodies" and "hoodies" cannot both
// exist while the display name keeps its original casing.
const categorySchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 40 },
    slug: { type: String, required: true, unique: true, lowercase: true, trim: true },
  },
  { timestamps: true }
);

const Category = mongoose.model('Category', categorySchema);
export default Category;
