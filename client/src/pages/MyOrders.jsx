import { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import axios from 'axios';
import toast from 'react-hot-toast';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import { useAuth } from '../context/AuthContext';
import { FiArrowLeft, FiPackage } from 'react-icons/fi';
import { getAuthHeader, formatPrice, statusColor } from '../utils/helpers';
import useLiveUpdates from '../hooks/useLiveUpdates';

const formatDate = (value) =>
  new Date(value).toLocaleDateString('en-IN', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

export default function MyOrders() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);

  const loadOrders = useCallback(async () => {
    if (!user) return;
    try {
      const { data } = await axios.get('/api/orders/myorders', { headers: getAuthHeader() });
      setOrders(Array.isArray(data) ? data : []);
    } catch {
      toast.error('Could not load your orders');
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (!user) { navigate('/login'); return; }
    loadOrders();
  }, [user, loadOrders, navigate]);

  // A status change made in the admin console shows up here without a refresh.
  useLiveUpdates(loadOrders);

  if (!user) return null;

  return (
    <div className="orders-page">
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
            <h1 className="shop-title">My Orders</h1>
            {!loading && (
              <span className="shop-count">
                {orders.length} {orders.length === 1 ? 'order' : 'orders'}
              </span>
            )}
          </div>
        </div>
      </div>

      <section className="section" style={{ paddingTop: '1.5rem' }}>
        <div className="container">
          {loading ? (
            [...Array(2)].map((_, i) => (
              <div key={i} className="skeleton" style={{ height: '220px', borderRadius: '12px', marginBottom: '1.25rem' }} />
            ))
          ) : orders.length === 0 ? (
            <div className="liked-empty">
              <div className="liked-empty-icon" aria-hidden="true"><FiPackage /></div>
              <h2 className="section-title" style={{ margin: 0 }}>No orders yet</h2>
              <p className="section-subtitle">
                Start shopping and your orders will appear here.
              </p>
              <Link to="/shop" className="btn btn-primary">Shop Now</Link>
            </div>
          ) : (
            <div className="orders-list">
              {orders.map((order) => (
                <article key={order._id} className="order-card order-detail-card">
                  <div className="order-header">
                    <div>
                      <p className="order-id">Order #{order._id.slice(-8).toUpperCase()}</p>
                      <p className="order-date">{formatDate(order.createdAt)}</p>
                    </div>
                    <span className={`order-status ${statusColor(order.status)}`}>{order.status}</span>
                  </div>

                  <div className="order-detail-items">
                    {order.orderItems.map((item, i) => (
                      <div key={`${item.product}-${i}`} className="order-detail-item">
                        <img src={item.image} alt={item.name} className="order-detail-img" />
                        <div className="order-detail-info">
                          <p className="order-detail-name">{item.name}</p>
                          <p className="order-detail-meta">
                            {[item.size, item.color].filter(Boolean).join(' · ')}
                            {[item.size, item.color].filter(Boolean).length > 0 ? ' · ' : ''}
                            Qty {item.qty}
                          </p>
                        </div>
                        <span className="order-detail-price">{formatPrice(item.price * item.qty)}</span>
                      </div>
                    ))}
                  </div>

                  <div className="order-detail-footer">
                    <div className="order-detail-address">
                      <p className="order-detail-label">Delivery Address</p>
                      <p>
                        {[
                          order.shippingAddress?.address,
                          order.shippingAddress?.city,
                          order.shippingAddress?.postalCode,
                          order.shippingAddress?.country,
                        ].filter(Boolean).join(', ') || 'Not available'}
                      </p>
                    </div>

                    <div className="order-detail-totals">
                      <div className="summary-row">
                        <span>Subtotal</span>
                        <span>{formatPrice(order.itemsPrice)}</span>
                      </div>
                      {order.discount > 0 && (
                        <div className="summary-row summary-row-discount">
                          <span>Discount{order.couponCode ? ` (${order.couponCode})` : ''}</span>
                          <span>−{formatPrice(order.discount)}</span>
                        </div>
                      )}
                      <div className="summary-row">
                        <span>Shipping</span>
                        <span className="summary-free">Free</span>
                      </div>
                      <div className="summary-total">
                        <span>Total</span>
                        <span>{formatPrice(order.totalPrice)}</span>
                      </div>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>
      </section>

      <Footer />
    </div>
  );
}
