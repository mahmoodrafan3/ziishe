import { useState, useEffect, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import axios from 'axios';
import toast from 'react-hot-toast';
import Navbar from '../components/Navbar';
import ProductCard from '../components/ProductCard';
import Footer from '../components/Footer';
import { useReveal } from '../hooks/useReveal';
import useLiveUpdates from '../hooks/useLiveUpdates';
import { FiArrowLeft, FiSearch } from 'react-icons/fi';

// Shown only until the editable category list arrives from the API.
const FALLBACK_CATEGORIES = ['Hoodies', 'Blazers', 'Trousers', 'T-Shirts', 'Shirts', 'Coats', 'Dresses'];

export default function Shop() {
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState(FALLBACK_CATEGORIES);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const revealRef = useReveal();
  const activeCategory = searchParams.get('category') || 'All';

  const loadProducts = useCallback(async ({ silent = false } = {}) => {
    if (!silent) setLoading(true);
    const params = {};
    if (activeCategory !== 'All') params.category = activeCategory;
    if (search) params.search = search;
    try {
      const { data } = await axios.get('/api/products', { params });
      setProducts(data);
    } catch {
      if (!silent) setProducts([]);
    } finally {
      setLoading(false);
    }
  }, [activeCategory, search]);

  // The admin can add or rename categories, so the filters follow the API.
  const loadCategories = useCallback(async () => {
    try {
      const { data } = await axios.get('/api/categories');
      const names = (Array.isArray(data) ? data : []).map((item) => item.name).filter(Boolean);
      if (names.length) setCategories(names);
    } catch {
      /* keep the fallback list */
    }
  }, []);

  useEffect(() => { loadProducts(); }, [loadProducts]);
  useEffect(() => { loadCategories(); }, [loadCategories]);

  // Refresh quietly in the background when the admin changes the catalogue.
  useLiveUpdates((event) => {
    if (event?.type === 'categories') loadCategories();
    loadProducts({ silent: true });
  });

  const handleCategory = (cat) => {
    if (cat === 'All') setSearchParams({});
    else setSearchParams({ category: cat });
  };

  return (
    <div className="shop-page">
      <Navbar />

      {/* Shop Header — minimal */}
      <div className="shop-header">
        <div className="container shop-header-inner">
          <button
            type="button"
            className="detail-back-btn shop-page-back"
            aria-label="Go back"
            title="Back"
            onClick={() => navigate(window.history.state?.idx > 0 ? -1 : '/')}
          >
            <FiArrowLeft aria-hidden="true" />
          </button>
          <div className="shop-header-row">
            <h1 className="shop-title">Shop Womenswear</h1>
            <span className="shop-count">{products.length} pieces</span>
          </div>
        </div>
      </div>

      {/* Filters + Products */}
      <section className="section" ref={revealRef} style={{ paddingTop: '0.75rem' }}>
        <div className="container">
          <div className="shop-filters">
            {['All', ...categories, ...(activeCategory !== 'All' && !categories.includes(activeCategory) ? [activeCategory] : [])].map((cat) => (
              <button
                key={cat}
                className={`filter-btn${activeCategory === cat ? ' active' : ''}`}
                onClick={() => handleCategory(cat)}
              >
                {cat}
              </button>
            ))}
            <div className="shop-search">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
              </svg>
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search pieces..."
                type="text"
              />
            </div>
          </div>

          {loading ? (
            <div className="products-grid">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="skeleton" style={{ aspectRatio: '3/4', borderRadius: '8px' }} />
              ))}
            </div>
          ) : products.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '5rem 0', color: 'var(--gray)' }}>
              <div style={{ fontSize: '3rem', marginBottom: '1rem', color: 'var(--gold)' }} aria-hidden="true"><FiSearch /></div>
              <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '1.5rem', marginBottom: '0.5rem' }}>No products found</h3>
              <p>Try adjusting your filters or search term.</p>
            </div>
          ) : (
            <div className="products-grid">
              {products.map((p, i) => (
                <ProductCard key={p._id} product={p} />
              ))}
            </div>
          )}
        </div>
      </section>

      <Footer />
    </div>
  );
}
