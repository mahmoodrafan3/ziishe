import Product from '../models/Product.js';

// First code number inside a category. Codes look like #bl1001, #bl1002 …
const CODE_START = 1001;

// Two letters per category, e.g. "Blazers" -> "bl", "T-Shirts" -> "ts".
export const categoryPrefix = (category) => {
  const letters = String(category || '').replace(/[^a-z]/gi, '').toLowerCase();
  return letters.slice(0, 2) || 'pr';
};

// Numbers are scoped to the prefix, so codes stay unique even if two
// categories happen to share the same two letters.
export const nextProductCode = async (category, excludeId = null) => {
  const prefix = categoryPrefix(category);
  const query = { code: { $regex: `^${prefix}\\d{4,}$` } };
  if (excludeId) query._id = { $ne: excludeId };

  const used = await Product.find(query).select('code').lean();
  let next = CODE_START;
  for (const { code } of used) {
    const sequence = Number(code.slice(prefix.length));
    if (Number.isFinite(sequence) && sequence >= next) next = sequence + 1;
  }
  return `${prefix}${next}`;
};

// Gives every product that predates codes one, oldest first. Safe to re-run.
export const backfillProductCodes = async () => {
  const missing = await Product.find({
    $or: [{ code: { $exists: false } }, { code: null }, { code: '' }],
  }).sort({ createdAt: 1, _id: 1 });

  for (const product of missing) {
    product.code = await nextProductCode(product.category, product._id);
    await product.save();
  }
  return missing.length;
};
