import { Link, useNavigate } from 'react-router-dom';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import ProductCard from '../components/ProductCard';
import { useLike } from '../context/LikeContext';
import { FiArrowLeft, FiHeart } from 'react-icons/fi';

export default function LikedProducts() {
  const { likes, likeCount, clearLikes } = useLike();
  const navigate = useNavigate();

  const handleClearAll = () => {
    if (!likes.length) return;
    if (window.confirm('Remove all liked pieces from this list?')) clearLikes();
  };

  return (
    <div className="liked-page">
      <Navbar />

      <div className="shop-header">
        <div className="container shop-header-inner">
          <button
            type="button"
            className="detail-back-btn shop-page-back"
            aria-label="Go back"
            title="Back"
            onClick={() => navigate(window.history.state?.idx > 0 ? -1 : '/shop')}
          >
            <FiArrowLeft aria-hidden="true" />
          </button>
          <div className="shop-header-row">
            <h1 className="shop-title">Liked Pieces</h1>
            <span className="shop-count">
              {likeCount} {likeCount === 1 ? 'piece' : 'pieces'}
            </span>
            {likeCount > 0 && (
              <div className="shop-header-actions">
                <button
                  type="button"
                  className="liked-clear-btn"
                  onClick={handleClearAll}
                >
                  Clear all
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      <section className="section" style={{ paddingTop: '1.5rem' }}>
        <div className="container">
          {likes.length === 0 ? (
            <div className="liked-empty">
              <div className="liked-empty-icon" aria-hidden="true"><FiHeart /></div>
              <h2 className="section-title" style={{ margin: 0 }}>No liked pieces yet</h2>
              <p className="section-subtitle">
                Tap the heart on any product to save it here for later.
              </p>
              <Link to="/shop" className="btn btn-primary">Discover the Collection</Link>
            </div>
          ) : (
            <div className="products-grid">
              {likes.map((product) => (
                <ProductCard key={product._id} product={product} />
              ))}
            </div>
          )}
        </div>
      </section>

      <Footer />
    </div>
  );
}
