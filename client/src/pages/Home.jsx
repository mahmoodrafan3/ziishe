import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import Navbar from '../components/Navbar';
import Hero3D from '../components/Hero3D';
import GalleryCarousel from '../components/GalleryCarousel';
import ProductCard from '../components/ProductCard';
import Footer from '../components/Footer';
import { useReveal } from '../hooks/useReveal';
import useLiveUpdates from '../hooks/useLiveUpdates';
import { formatPrice, getDiscount } from '../utils/helpers';
import StarRating from '../components/StarRating';
import { FiArrowUpRight, FiChevronLeft, FiChevronRight } from 'react-icons/fi';

const sampleReviews = [
  { _id: 'sample-1', name: 'Ananya M.', rating: 5, comment: 'The fit is beautiful and the fabric feels even better in person. This has quickly become my go-to layer.', productName: 'Void Oversized Hoodie', sample: true },
  { _id: 'sample-2', name: 'Mira S.', rating: 5, comment: 'The silk falls beautifully and needs almost no styling. I wore it to dinner and felt entirely myself.', productName: 'Selene Silk Slip Dress', sample: true },
  { _id: 'sample-3', name: 'Kavya R.', rating: 4, comment: 'A clean silhouette and a really comfortable waist. They look polished without trying too hard.', productName: 'Horizon Wide-Leg Trousers', sample: true },
];

export default function Home() {
  const [products, setProducts] = useState([]);
  const [reviews, setReviews] = useState([]);
  const [activeReviewIndex, setActiveReviewIndex] = useState(0);
  const [reviewsPaused, setReviewsPaused] = useState(false);
  const [loading, setLoading] = useState(true);
  const revealRef = useReveal();

  // One catalogue request feeds both the home sections and the review wall.
  const loadCatalogue = useCallback(async () => {
    try {
      const { data } = await axios.get('/api/products');
      const list = Array.isArray(data) ? data : [];
      setProducts(list);
      const postedReviews = list.flatMap((product) =>
        (Array.isArray(product.reviews) ? product.reviews : []).map((review) => ({
          ...review,
          productName: product.name,
          productImage: product.image,
          productId: product._id,
        }))
      ).sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
      setReviews(postedReviews.slice(0, 6));
    } catch {
      setProducts([]);
      setReviews([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadCatalogue(); }, [loadCatalogue]);

  // Admin edits show up here without a page refresh.
  useLiveUpdates(loadCatalogue);

  // Home sections come from the section ticks set in the admin product editor.
  // Until any product has placements, fall back to the featured products (or
  // the whole catalogue) so the storefront never renders empty sections.
  const inSection = (placement) =>
    products.filter((product) => Array.isArray(product.placements) && product.placements.includes(placement));
  const hasPlacements = products.some(
    (product) => Array.isArray(product.placements) && product.placements.length > 0
  );
  const featuredProducts = products.filter((product) => product.featured);
  const fallbackProducts = featuredProducts.length ? featuredProducts : products;

  const heroProducts = hasPlacements ? inSection('hero') : fallbackProducts;
  const editorialProducts = (hasPlacements ? inSection('curated') : fallbackProducts).slice(0, 4);
  const essentialsProducts = (hasPlacements ? inSection('essentials') : fallbackProducts).slice(0, 3);
  const displayedReviews = reviews.length ? reviews : sampleReviews;
  const activeReview = displayedReviews[activeReviewIndex % displayedReviews.length];
  // Sample reviews have no product id, so match them to the catalogue by name.
  const activeReviewProductId =
    activeReview?.productId ||
    (activeReview?.sample ? products.find((product) => product.name === activeReview.productName)?._id : null);
  const ReviewCard = activeReviewProductId ? Link : 'article';
  const categories = [
    { name: 'Dresses', image: '/images/product_dress.png', label: '01' },
    { name: 'Hoodies', image: '/images/product_hoodie.png', label: '02' },
    { name: 'Blazers', image: '/images/product_blazer.png', label: '03' },
    { name: 'Trousers', image: '/images/product_trousers.png', label: '04' },
    { name: 'Shirts', image: '/images/product_shirt.png', label: '05' },
    { name: 'Coats', image: '/images/product_coat.png', label: '06' },
  ];

  useEffect(() => {
    setActiveReviewIndex((index) => index % displayedReviews.length);
  }, [displayedReviews.length]);

  useEffect(() => {
    if (displayedReviews.length < 2 || reviewsPaused) return undefined;
    const timer = window.setInterval(() => {
      setActiveReviewIndex((index) => (index + 1) % displayedReviews.length);
    }, 6000);
    return () => window.clearInterval(timer);
  }, [displayedReviews.length, reviewsPaused]);

  return (
    <div>
      <Navbar />
      <Hero3D products={heroProducts} />

      <section className="section" ref={revealRef} style={{ background: 'var(--cream)' }}>
        <div className="container">
          <div className="section-header">
            <h2 className="section-title reveal">Curated for Her</h2>
            <p className="section-subtitle reveal">
              Each piece is cut for a woman’s frame and made to outlast trends — a wardrobe for a life lived fully.
            </p>
          </div>
          {loading ? (
            <div className="editorial-grid">
              {[...Array(4)].map((_, i) => (
                <div key={i} className={`skeleton${i === 0 ? ' large' : ''}`} style={{ aspectRatio: i === 0 ? '2/3' : '4/3', borderRadius: '16px' }} />
              ))}
            </div>
          ) : editorialProducts.length > 0 ? (
            <>
              <div className="editorial-grid editorial-grid-desktop reveal">
                {editorialProducts.map((product, i) => {
                  const discount = getDiscount(product);
                  return (
                    <Link to={`/product/${product._id}`} key={product._id} className={`editorial-card${i === 0 ? ' large' : ''}`}>
                      <img src={product.image} alt={product.name} />
                      <div className="editorial-overlay">
                        <p className="editorial-tag">{product.category}</p>
                        <h3 className="editorial-name">{product.name}</h3>
                        <p className="editorial-price-row">
                          <span className="editorial-price">{formatPrice(product.price)}</span>
                          {discount && (
                            <>
                              <span className="editorial-mrp">{formatPrice(discount.mrp)}</span>
                              <span className="editorial-off">{discount.percent}% off</span>
                            </>
                          )}
                        </p>
                      </div>
                    </Link>
                  );
                })}
              </div>
              <div className="editorial-mobile-gallery">
                <GalleryCarousel products={editorialProducts} />
              </div>
            </>
          ) : (
            <p className="section-subtitle">Our collection is being prepared. Please check back soon.</p>
          )}
        </div>
      </section>

      <section className="section category-section" style={{ background: 'var(--cream-dark)' }} ref={revealRef}>
        <div className="container">
          <div className="section-header">
            <p className="section-eyebrow reveal">Explore the Collection</p>
            <h2 className="section-title reveal">Shop by Category</h2>
          </div>
          <div className="category-grid">
            {categories.map(({ name, image, label }, index) => (
              <Link
                to={`/shop?category=${encodeURIComponent(name)}`}
                className={`category-tile${index === 0 ? ' category-tile-featured' : ''}`}
                key={name}
              >
                <img src={image} alt={`${name} collection`} loading="lazy" />
                <span className="category-tile-shade" />
                <span className="category-tile-number">{label}</span>
                <span className="category-tile-caption">
                  <span className="category-tile-name">{name}</span>
                  <span className="category-tile-link">Discover <FiArrowUpRight aria-hidden="true" /></span>
                </span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className="section" style={{ background: 'var(--cream)' }} ref={revealRef}>
        <div className="container">
          <div className="section-header">
            <p className="section-eyebrow reveal">Featured Pieces</p>
            <h2 className="section-title reveal">Wardrobe Essentials</h2>
          </div>
          {loading ? (
            <div className="products-grid">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="skeleton" style={{ aspectRatio: '3/4', borderRadius: '8px' }} />
              ))}
            </div>
          ) : essentialsProducts.length > 0 ? (
            <div className="products-grid">
              {essentialsProducts.map((product, i) => (
                <ProductCard key={product._id} product={product} delay={i + 1} />
              ))}
            </div>
          ) : (
            <p className="section-subtitle">No featured products are available right now.</p>
          )}
          <div className="products-cta" style={{ textAlign: 'center', marginTop: '3rem' }}>
            <Link to="/shop" className="btn btn-outline reveal" style={{ padding: '1rem 3rem' }}>
              View All Pieces
            </Link>
          </div>
        </div>
      </section>

      <section className="section reviews-section" style={{ background: 'var(--cream-dark)' }} ref={revealRef}>
        <div className="container">
          <div className="section-header">
            <p className="section-eyebrow reveal">The Community</p>
            <h2 className="section-title reveal">Words from Our Customers</h2>
          </div>
          <div
            className="customer-reviews-carousel"
            onMouseEnter={() => setReviewsPaused(true)}
            onMouseLeave={() => setReviewsPaused(false)}
            onFocusCapture={() => setReviewsPaused(true)}
            onBlurCapture={(event) => {
              if (!event.currentTarget.contains(event.relatedTarget)) setReviewsPaused(false);
            }}
          >
            <ReviewCard
              className="customer-review-card reveal"
              key={activeReview._id}
              aria-live="polite"
              {...(activeReviewProductId ? { to: `/product/${activeReviewProductId}` } : {})}
            >
                  <div className="customer-review-topline">
                    <StarRating rating={activeReview.rating} className="customer-review-stars" />
                    <span className="customer-review-product">
                      {activeReview.sample && <span className="customer-review-sample">Sample · </span>}
                      {activeReview.productName}
                    </span>
                  </div>
                  <p className="customer-review-comment">“{activeReview.comment}”</p>
                  <div className="customer-review-author">
                    {activeReview.productImage && <img src={activeReview.productImage} alt="" loading="lazy" />}
                    <div>
                      <strong>{activeReview.name || 'Customer'}</strong>
                      {activeReview.createdAt && <time dateTime={activeReview.createdAt}>{new Date(activeReview.createdAt).toLocaleDateString()}</time>}
                    </div>
                  </div>
            </ReviewCard>
            {displayedReviews.length > 1 && (
              <div className="customer-review-controls">
                <button type="button" className="customer-review-arrow" onClick={() => setActiveReviewIndex((index) => (index - 1 + displayedReviews.length) % displayedReviews.length)} aria-label="Previous review"><FiChevronLeft aria-hidden="true" /></button>
                <div className="customer-review-dots" aria-label="Choose a review">
                  {displayedReviews.map((review, index) => (
                    <button
                      type="button"
                      key={review._id || index}
                      className={`customer-review-dot${index === activeReviewIndex ? ' active' : ''}`}
                      onClick={() => setActiveReviewIndex(index)}
                      aria-label={`Show review ${index + 1}`}
                      aria-current={index === activeReviewIndex ? 'true' : undefined}
                    />
                  ))}
                </div>
                <button type="button" className="customer-review-arrow" onClick={() => setActiveReviewIndex((index) => (index + 1) % displayedReviews.length)} aria-label="Next review"><FiChevronRight aria-hidden="true" /></button>
              </div>
            )}
          </div>
        </div>
      </section>

      <div className="newsletter" ref={revealRef}>
        <div className="container">
          <p className="section-eyebrow reveal">Stay in the Circle</p>
          <h2 className="newsletter-title reveal">Join the ZiiShe Circle</h2>
          <p className="newsletter-sub reveal">Be first to see new dresses, limited drops, and styling notes from our studio.</p>
          <div className="newsletter-form reveal">
            <input className="newsletter-input" type="email" placeholder="Enter your email address" />
            <button className="newsletter-btn">Subscribe</button>
          </div>
        </div>
      </div>

      <Footer />
    </div>
  );
}
