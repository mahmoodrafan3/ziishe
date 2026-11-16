import { Link, useLocation } from 'react-router-dom';
import { useCart } from '../context/CartContext';
import { useAuth } from '../context/AuthContext';

const iconProps = {
  width: 19,
  height: 19,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.5,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
};

function HomeIcon() {
  return (
    <svg {...iconProps} aria-hidden="true">
      <path d="M3 10.5 12 3l9 7.5" />
      <path d="M5.5 9.5V21h13V9.5" />
      <path d="M10 21v-6h4v6" />
    </svg>
  );
}

function ShopIcon() {
  return (
    <svg {...iconProps} aria-hidden="true">
      <rect x="3.5" y="3.5" width="7" height="7" rx="1" />
      <rect x="13.5" y="3.5" width="7" height="7" rx="1" />
      <rect x="3.5" y="13.5" width="7" height="7" rx="1" />
      <rect x="13.5" y="13.5" width="7" height="7" rx="1" />
    </svg>
  );
}

function BagIcon() {
  return (
    <svg {...iconProps} aria-hidden="true">
      <path d="M5.5 8h13l-1 12.5h-11L5.5 8Z" />
      <path d="M9 8V6.5a3 3 0 0 1 6 0V8" />
    </svg>
  );
}

function AccountIcon() {
  return (
    <svg {...iconProps} aria-hidden="true">
      <circle cx="12" cy="8" r="3.5" />
      <path d="M4.5 20.5a7.5 7.5 0 0 1 15 0" />
    </svg>
  );
}

export default function BottomNav() {
  const { pathname } = useLocation();
  const { cartCount } = useCart();
  const { user } = useAuth();

  const homeActive = pathname === '/';
  const shopActive = pathname.startsWith('/shop') || pathname.startsWith('/product');
  const bagActive = pathname === '/cart';
  const accountActive = pathname.startsWith('/profile');

  return (
    <nav className="bottom-nav" aria-label="Mobile">
      <Link to="/" className={`bottom-nav-item${homeActive ? ' active' : ''}`} aria-current={homeActive ? 'page' : undefined}>
        <HomeIcon />
        <span>Home</span>
      </Link>

      <Link to="/shop" className={`bottom-nav-item${shopActive ? ' active' : ''}`} aria-current={shopActive ? 'page' : undefined}>
        <ShopIcon />
        <span>Shop</span>
      </Link>

      <Link
        to="/cart"
        className={`bottom-nav-item${bagActive ? ' active' : ''}`}
        aria-current={bagActive ? 'page' : undefined}
        aria-label={`Bag${cartCount > 0 ? `, ${cartCount} items` : ''}`}
      >
        <span className="bottom-nav-icon">
          <BagIcon />
          {cartCount > 0 && <span className="bottom-nav-badge">{cartCount}</span>}
        </span>
        <span>Bag</span>
      </Link>

      <Link
        to={user ? '/profile' : '/login'}
        className={`bottom-nav-item${accountActive ? ' active' : ''}`}
        aria-current={accountActive ? 'page' : undefined}
      >
        <AccountIcon />
        <span>Account</span>
      </Link>
    </nav>
  );
}
