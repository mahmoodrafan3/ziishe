import { Link, useNavigate } from 'react-router-dom';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import { useCart } from '../context/CartContext';
import { FiArrowLeft, FiShoppingBag } from 'react-icons/fi';
import { formatPrice } from '../utils/helpers';

export default function Cart() {
  const { cartItems, cartCount, cartTotal, updateQty, removeFromCart } = useCart();
  const navigate = useNavigate();

  return (
    <div className="cart-page">
      <Navbar />

      <div className="cart-page-head">
        <div className="container cart-page-head-inner">
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
            <h1 className="shop-title">Your Bag</h1>
            <span className="shop-count">
              {cartCount} {cartCount === 1 ? 'item' : 'items'}
            </span>
          </div>
        </div>
      </div>

      <section className="section cart-page-section">
        <div className="container">
          {cartItems.length === 0 ? (
            <div className="cart-page-empty">
              <div className="cart-empty-icon" aria-hidden="true"><FiShoppingBag /></div>
              <h2 className="section-title" style={{ margin: 0 }}>Your bag is empty</h2>
              <p className="section-subtitle">Discover the collection and add your favourites.</p>
              <Link to="/shop" className="btn btn-primary">Shop the Collection</Link>
            </div>
          ) : (
            <div className="cart-page-grid">
              <div className="cart-page-items">
                {cartItems.map((item) => (
                  <div className="cart-page-item" key={item.key}>
                    <Link to={`/product/${item._id}`} className="cart-page-thumb">
                      <img src={item.image} alt={item.name} />
                    </Link>

                    <div className="cart-page-info">
                      {item.category && <p className="product-category">{item.category}</p>}
                      <Link to={`/product/${item._id}`}>
                        <h3 className="cart-page-name">{item.name}</h3>
                      </Link>
                      <p className="cart-item-meta">
                        {[item.size, item.color].filter(Boolean).join(' · ')}
                      </p>

                      <div className="cart-page-controls">
                        <div className="qty-control">
                          <button className="qty-btn" onClick={() => updateQty(item.key, item.qty - 1)} aria-label="Decrease quantity">−</button>
                          <span className="qty-num">{item.qty}</span>
                          <button className="qty-btn" onClick={() => updateQty(item.key, item.qty + 1)} aria-label="Increase quantity">+</button>
                        </div>
                        <button className="cart-page-remove" onClick={() => removeFromCart(item.key)}>Remove</button>
                      </div>
                    </div>

                    <span className="cart-page-price">{formatPrice(item.price * item.qty)}</span>
                  </div>
                ))}
              </div>

              <aside className="cart-summary">
                <h2>Order Summary</h2>
                <div className="cart-summary-row">
                  <span>Subtotal</span>
                  <span>{formatPrice(cartTotal)}</span>
                </div>
                <div className="cart-summary-row">
                  <span>Shipping</span>
                  <span>Calculated at checkout</span>
                </div>
                <p className="cart-summary-note">Taxes included. Shipping calculated at checkout.</p>
                <div className="cart-summary-row cart-summary-total">
                  <span>Total</span>
                  <span>{formatPrice(cartTotal)}</span>
                </div>
                <Link to="/checkout" className="btn btn-primary" style={{ marginTop: '1.25rem' }}>
                  Proceed to Checkout
                </Link>
                <Link to="/shop" className="cart-summary-continue">Continue Shopping</Link>
              </aside>
            </div>
          )}
        </div>
      </section>

      <Footer />
    </div>
  );
}
