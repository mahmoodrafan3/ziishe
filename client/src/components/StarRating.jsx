import { FiStar } from 'react-icons/fi';

// Five-star display used by product cards, the product page and home reviews.
export default function StarRating({ rating = 0, className = '' }) {
  const value = Math.max(0, Math.min(5, Math.round(Number(rating) || 0)));
  return (
    <span
      className={`star-rating${className ? ` ${className}` : ''}`}
      role="img"
      aria-label={`${rating || 0} out of 5 stars`}
    >
      {[1, 2, 3, 4, 5].map((n) => (
        <FiStar key={n} className={n <= value ? 'star-on' : 'star-off'} aria-hidden="true" />
      ))}
    </span>
  );
}
