export const formatPrice = (price) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(price);

// MRP is the "was" price. A discount only exists when the MRP is actually
// higher than what the piece sells for, so products without one stay clean.
export const getDiscount = (product) => {
  const price = Number(product?.price) || 0;
  const mrp = Number(product?.mrp) || 0;
  if (!mrp || mrp <= price) return null;
  const percent = Math.round(((mrp - price) / mrp) * 100);
  if (percent < 1) return null;
  return { mrp, percent, save: mrp - price };
};

// Ratings come from the reviews a product actually has, never from a stored
// placeholder score. Cards and the product page use this so the star count and
// the review count always agree with the reviews list.
export const getRatingSummary = (product) => {
  const reviews = Array.isArray(product?.reviews) ? product.reviews : [];
  const count = reviews.length;
  const total = reviews.reduce((sum, review) => sum + (Number(review?.rating) || 0), 0);
  return { rating: count ? total / count : 0, count };
};

export const getAuthHeader = () => {
  const user = JSON.parse(localStorage.getItem('ziishe_user') || 'null');
  return user?.token ? { Authorization: `Bearer ${user.token}` } : {};
};

// Admins keep their session in a separate storage bucket from customers.
export const getAdminAuthHeader = () => {
  const admin = JSON.parse(localStorage.getItem('ziishe_admin') || 'null');
  return admin?.token ? { Authorization: `Bearer ${admin.token}` } : {};
};

export const statusColor = (status) => {
  const map = {
    pending: 'status-pending',
    processing: 'status-processing',
    shipped: 'status-shipped',
    delivered: 'status-delivered',
    cancelled: 'status-cancelled',
  };
  return map[status] || 'status-pending';
};
