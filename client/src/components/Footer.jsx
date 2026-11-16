import { Link } from 'react-router-dom';
import Logo from './Logo';

const SHOP_LINKS = [
  { to: '/shop', label: 'New Arrivals' },
  { to: '/shop?category=Dresses', label: 'Dresses' },
  { to: '/shop?category=Blazers', label: 'Blazers' },
  { to: '/shop?category=Coats', label: 'Coats' },
];

const HELP_LINKS = [
  { to: '/profile/faqs', label: 'FAQs' },
  { to: '/profile/terms', label: 'Terms & Policies' },
];

export default function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer className="footer">
      <div className="container">
        <div className="footer-grid">
          {/* Brand */}
          <div className="footer-brand">
            <Link to="/" className="footer-brand-logo" aria-label="ZiiShe home">
              <Logo size={30} />
              <span>ZiiShe</span>
            </Link>
            <p className="footer-brand-desc">
              Modern womenswear — fluid dresses and considered tailoring, made for women who dress with intention.
            </p>
            <div className="footer-social">
              {['Instagram', 'Pinterest', 'YouTube'].map((s) => (
                <a key={s} href="#" className="footer-social-btn" title={s} aria-label={s}>
                  {s[0]}
                </a>
              ))}
            </div>
          </div>

          {/* Shop */}
          <div>
            <h4 className="footer-col-title">Shop</h4>
            <ul className="footer-links">
              {SHOP_LINKS.map(({ to, label }) => (
                <li key={label}>
                  <Link to={to} className="footer-link">{label}</Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Help */}
          <div>
            <h4 className="footer-col-title">Help</h4>
            <ul className="footer-links">
              {HELP_LINKS.map(({ to, label }) => (
                <li key={label}>
                  <Link to={to} className="footer-link">{label}</Link>
                </li>
              ))}
              <li><a href="#" className="footer-link">Shipping &amp; Returns</a></li>
            </ul>
          </div>

          {/* Company */}
          <div>
            <h4 className="footer-col-title">Company</h4>
            <ul className="footer-links">
              <li><a href="#" className="footer-link">About ZiiShe</a></li>
              <li><a href="#" className="footer-link">Sustainability</a></li>
              <li><a href="#" className="footer-link">Contact</a></li>
            </ul>
          </div>
        </div>

        <div className="footer-bottom">
          <span>© {year} ZiiShe. All rights reserved.</span>
          <span className="footer-legal-links">
            <a href="#">Privacy Policy</a>
            <a href="#">Terms of Service</a>
            <a href="#">Cookie Policy</a>
          </span>
        </div>
      </div>
    </footer>
  );
}
