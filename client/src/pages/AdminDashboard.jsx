import { useState, useEffect, useMemo } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import axios from 'axios';
import toast from 'react-hot-toast';
import { useAdminAuth } from '../context/AdminAuthContext';
import { getAdminAuthHeader, formatPrice, statusColor } from '../utils/helpers';
import useLiveUpdates from '../hooks/useLiveUpdates';
import CategoryManager from '../components/CategoryManager';
import CouponEditor from '../components/CouponEditor';
import {
  FiGrid, FiPackage, FiShoppingBag, FiTrendingUp, FiDollarSign, FiClock,
  FiSearch, FiDownload, FiEdit2, FiTrash2, FiPlus, FiImage,
  FiLogOut, FiArrowLeft, FiArrowUpRight, FiChevronDown, FiInbox,
  FiLayout, FiEyeOff, FiInfo, FiSettings, FiTool, FiAlertTriangle, FiTag,
  FiPercent,
} from 'react-icons/fi';

/* ── Small helpers ─────────────────────────────────────────── */

const NAV = [
  { key: 'Overview', label: 'Overview', icon: FiGrid },
  { key: 'Products', label: 'Products', icon: FiPackage },
  { key: 'Orders',   label: 'Orders',   icon: FiShoppingBag },
  { key: 'Coupons',  label: 'Coupons',  icon: FiPercent },
  { key: 'Home',     label: 'Home page', icon: FiLayout },
  { key: 'Settings', label: 'Settings', icon: FiSettings },
];

// Home page sections driven by each product's `placements` field. `limit` is
// how many the storefront actually renders (extra ticks are still saved).
const HOME_SECTIONS = [
  {
    key: 'hero',
    label: 'Hero section',
    title: 'Animated hero',
    note: 'Full-bleed photos at the top. They fade every 5 seconds and each photo opens its product.',
    limit: null,
  },
  {
    key: 'curated',
    label: '2nd section',
    title: 'Curated for Her',
    note: 'Editorial grid under the hero. The first photo in the list is the large one.',
    limit: 4,
  },
  {
    key: 'essentials',
    label: 'Last section',
    title: 'Wardrobe Essentials',
    note: 'Three-up product cards near the bottom of the home page.',
    limit: 3,
  },
];
const SECTION_LABELS = Object.fromEntries(HOME_SECTIONS.map(({ key, label }) => [key, label]));

const STATUSES = ['pending', 'processing', 'shipped', 'delivered', 'cancelled'];
const STATUSES_SET = new Set(STATUSES);
const ORDER_STATUSES = ['All', ...STATUSES];

const formatDate = (date, withTime = false) => {
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return '—';
  const base = d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  return withTime ? `${base} · ${d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}` : base;
};

const relativeDate = (date) => {
  const diff = Date.now() - new Date(date).getTime();
  const mins = Math.round(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 7) return `${days}d ago`;
  return formatDate(date);
};

const shortId = (id) => (id ? id.slice(-8).toUpperCase() : '—');
const firstName = (name) => (name ? String(name).trim().split(/\s+/)[0] : 'there');
const pct = (n, d) => (d > 0 ? Math.round((n / d) * 100) : 0);

// Sample a series of numbers down to a Sparkline-sized array.
const sample = (values, n = 14) => {
  if (values.length <= n) return values;
  const step = values.length / n;
  return Array.from({ length: n }, (_, i) => values[Math.floor(i * step)]);
};

const trendDelta = (current, previous) => {
  if (previous === 0) return current > 0 ? { dir: 'up', text: 'new' } : { dir: 'flat', text: '0%' };
  const change = Math.round(((current - previous) / previous) * 100);
  if (change > 0) return { dir: 'up', text: `${change}%` };
  if (change < 0) return { dir: 'down', text: `${Math.abs(change)}%` };
  return { dir: 'flat', text: '0%' };
};

const csvCell = (value) => `"${String(value ?? '').replace(/"/g, '""')}"`;
const downloadCsv = (rows, filename) => {
  const csv = rows.map((row) => row.map(csvCell).join(',')).join('\r\n');
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
};

// Cloudinary-aware <img> that requests a right-sized transform.
const OptimizedCloudinaryImage = ({ src, alt, className, style, width, height }) => {
  if (!src) return null;
  let resolved = src;
  try {
    const url = new URL(src);
    if (url.hostname.includes('cloudinary.com')) {
      url.searchParams.set('w', String(width || 80));
      url.searchParams.set('h', String(height || 100));
      url.searchParams.set('c', 'fill');
      url.searchParams.set('q', 'auto');
      url.searchParams.set('dpr', 'auto');
      resolved = url.toString();
    }
  } catch { /* not an absolute URL — use it as-is */ }
  return <img src={resolved} alt={alt || ''} className={className} style={style} width={width} height={height} loading="lazy" />;
};

/* ── Sparkline ─────────────────────────────────────────────── */

function Sparkline({ values, color = 'var(--gold)' }) {
  const vals = values && values.length ? values : [0, 0];
  const min = Math.min(...vals);
  const max = Math.max(...vals);
  const span = max - min || 1;
  const step = 100 / Math.max(1, vals.length - 1);
  const points = vals.map((v, i) => `${(i * step).toFixed(2)},${(28 - ((v - min) / span) * 24).toFixed(2)}`).join(' ');
  return (
    <svg className="adm-spark" viewBox="0 0 100 28" preserveAspectRatio="none" aria-hidden="true">
      <polyline points={points} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

/* ── Revenue chart ─────────────────────────────────────────── */

function RevenueChart({ data }) {
  const w = 660;
  const h = 178;
  const padT = 16;
  const padB = 12;
  const min = Math.min(...data.map((d) => d.revenue));
  const max = Math.max(...data.map((d) => d.revenue));
  const span = max - min || 1;
  const n = data.length;
  const xOf = (i) => (i / Math.max(1, n - 1)) * w;
  const yOf = (v) => padT + (h - padT - padB) - ((v - min) / span) * (h - padT - padB);
  const line = data.map((d, i) => `${xOf(i) === 0 ? 'M' : 'L'}${xOf(i).toFixed(1)} ${yOf(d.revenue).toFixed(1)}`).join(' ');
  const area = `M0 ${h - padB} L${data.map((d, i) => `${xOf(i).toFixed(1)} ${yOf(d.revenue).toFixed(1)}`).join(' L')} L${w} ${h - padB} Z`;
  const labelEvery = Math.max(1, Math.ceil(n / 6));
  const labels = data.filter((_, i) => i % labelEvery === 0).map((d) => d.label);

  return (
    <>
      <svg className="adm-chart" viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" role="img" aria-label="Revenue over the last 14 days">
        {[0.25, 0.5, 0.75].map((t) => (
          <line key={t} x1="0" x2={w} y1={padT + t * (h - padT - padB)} y2={padT + t * (h - padT - padB)} stroke="rgba(0,0,0,0.06)" strokeWidth="1" vectorEffect="non-scaling-stroke" />
        ))}
        <path d={area} fill="url(#admAreaFill)" />
        <path d={line} fill="none" stroke="var(--gold)" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
        <defs>
          <linearGradient id="admAreaFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--gold)" stopOpacity="0.26" />
            <stop offset="100%" stopColor="var(--gold)" stopOpacity="0" />
          </linearGradient>
        </defs>
      </svg>
      <div className="adm-chart-axis" aria-hidden="true">
        {labels.map((label) => <span key={label}>{label}</span>)}
      </div>
    </>
  );
}

/* ── Table scaffolding ─────────────────────────────────────── */

function SortHeader({ label, field, sort, onSort, align }) {
  const active = sort.field === field;
  return (
    <th>
      <button type="button" className={`adm-th-sort${active ? ' on' : ''}`} onClick={() => onSort(field)}>
        {label}
        <FiChevronDown style={{ transform: active && sort.dir === 'asc' ? 'rotate(180deg)' : 'none', marginLeft: align === 'right' ? 'auto' : 0 }} />
      </button>
    </th>
  );
}

function EmptyState({ icon: Icon = FiInbox, title, text, action }) {
  return (
    <div className="adm-empty">
      <span className="adm-empty-ico"><Icon /></span>
      <strong>{title}</strong>
      {text && <p>{text}</p>}
      {action}
    </div>
  );
}

/* ── Main component ────────────────────────────────────────── */

export default function AdminDashboard() {
  const { admin, adminLogout, loading: adminLoading } = useAdminAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [tab, setTab] = useState(location.state?.tab || 'Overview');
  const [navOpen, setNavOpen] = useState(false);
  const [products, setProducts] = useState([]);
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);

  // products table
  const [productQuery, setProductQuery] = useState('');
  const [productCategory, setProductCategory] = useState('All');
  const [productSort, setProductSort] = useState({ field: 'name', dir: 'asc' });
  // orders table
  const [orderQuery, setOrderQuery] = useState('');
  const [orderStatus, setOrderStatus] = useState('All');
  const [orderSort, setOrderSort] = useState({ field: 'createdAt', dir: 'desc' });
  // home page preview
  const [placementPick, setPlacementPick] = useState({});
  const [placementSavingId, setPlacementSavingId] = useState(null);
  // category manager dialog
  const [categoryModalOpen, setCategoryModalOpen] = useState(false);
  // coupons
  const [coupons, setCoupons] = useState([]);
  const [couponModalOpen, setCouponModalOpen] = useState(false);
  const [couponEditing, setCouponEditing] = useState(null);
  // storefront status switches
  const [settingsForm, setSettingsForm] = useState({
    maintenanceEnabled: false,
    maintenanceMessage: '',
    issueEnabled: false,
    issueMessage: '',
  });
  const [settingsLoaded, setSettingsLoaded] = useState(false);
  const [savingSettings, setSavingSettings] = useState(false);

  useEffect(() => {
    // Wait until the stored admin session has been read, otherwise a refresh
    // bounces to the login page before the context has loaded it.
    if (adminLoading) return;
    if (!admin) { navigate('/admin/login', { replace: true }); return; }
    fetchData();
    loadSettings();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [admin, adminLoading]);

  // Lock body scroll while the mobile rail is open.
  useEffect(() => {
    document.body.style.overflow = navOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [navOpen]);

  // A new order pushed over the live connection lands here without a reload.
  useLiveUpdates((event) => {
    if (!admin || event?.type === 'settings') return;
    if (event?.type === 'orders' && event.action === 'created') {
      toast.success(
        `New order from ${event.customer || 'a customer'} · ${formatPrice(event.totalPrice || 0)}`,
        { id: event.id },
      );
    }
    // Silent so the dashboard never flashes its skeleton on a live update.
    fetchData({ silent: true });
  });

  const fetchData = async ({ silent = false } = {}) => {
    if (!silent) setLoading(true);
    try {
      const [pRes, oRes, cRes] = await Promise.all([
        axios.get('/api/products'),
        axios.get('/api/orders', { headers: getAdminAuthHeader() }),
        axios.get('/api/coupons', { headers: getAdminAuthHeader() }),
      ]);
      setProducts(Array.isArray(pRes.data) ? pRes.data : []);
      setOrders(Array.isArray(oRes.data) ? oRes.data : []);
      setCoupons(Array.isArray(cRes.data) ? cRes.data : []);
    } catch (err) {
      // An expired or rejected admin token is not a data problem — send the
      // admin back to sign in instead of showing an endless "failed to load".
      const status = err.response?.status;
      if (status === 401 || status === 403) {
        toast.error('Admin session expired — please sign in again');
        adminLogout();
        navigate('/admin/login', { replace: true });
        return;
      }
      console.error('[admin] failed to load data:', err.response?.data?.message || err.message);
      toast.error('Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const loadSettings = async () => {
    try {
      const { data } = await axios.get('/api/settings');
      setSettingsForm({
        maintenanceEnabled: Boolean(data.maintenanceEnabled),
        maintenanceMessage: data.maintenanceMessage || '',
        issueEnabled: Boolean(data.issueEnabled),
        issueMessage: data.issueMessage || '',
      });
    } catch {
      // Non-fatal: the panel falls back to defaults and can still save.
      toast.error('Could not load store settings');
    } finally {
      setSettingsLoaded(true);
    }
  };

  const saveSettings = async () => {
    setSavingSettings(true);
    try {
      const { data } = await axios.put('/api/settings', settingsForm, { headers: getAdminAuthHeader() });
      setSettingsForm({
        maintenanceEnabled: Boolean(data.maintenanceEnabled),
        maintenanceMessage: data.maintenanceMessage || '',
        issueEnabled: Boolean(data.issueEnabled),
        issueMessage: data.issueMessage || '',
      });
      toast.success('Storefront settings saved');
    } catch (err) {
      const status = err.response?.status;
      if (status === 401 || status === 403) {
        toast.error('Admin session expired — please sign in again');
        adminLogout();
        navigate('/admin/login', { replace: true });
        return;
      }
      toast.error(err.response?.data?.message || 'Failed to save settings');
    } finally {
      setSavingSettings(false);
    }
  };

  const handleLogout = () => {
    adminLogout();
    navigate('/admin/login', { replace: true });
  };

  const switchTab = (key) => { setTab(key); setNavOpen(false); };

  /* ── Product editor ── */

  const openEditor = (product = null) => {
    navigate(product ? `/admin/products/${product._id}/edit` : '/admin/products/new');
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this product?')) return;
    try {
      await axios.delete(`/api/products/${id}`, { headers: getAdminAuthHeader() });
      toast.success('Product deleted');
      fetchData();
    } catch {
      toast.error('Failed to delete');
    }
  };

  /* ── Home page sections ── */

  const savePlacements = async (product, placements, message) => {
    const previous = product.placements || [];
    setProducts((prev) => prev.map((p) => (p._id === product._id ? { ...p, placements } : p)));
    setPlacementSavingId(product._id);
    try {
      await axios.patch(
        `/api/products/${product._id}/placements`,
        { placements },
        { headers: getAdminAuthHeader() },
      );
      toast.success(message);
    } catch (err) {
      setProducts((prev) => prev.map((p) => (p._id === product._id ? { ...p, placements: previous } : p)));
      toast.error(err.response?.data?.message || 'Failed to update sections');
    } finally {
      setPlacementSavingId(null);
    }
  };

  const addToSection = (product, sectionKey) => {
    if (!product) return;
    if ((product.placements || []).includes(sectionKey)) return;
    savePlacements(
      product,
      [...(product.placements || []), sectionKey],
      `${product.name} added to ${SECTION_LABELS[sectionKey]}`,
    );
  };

  const removeFromSection = (product, sectionKey) => {
    savePlacements(
      product,
      (product.placements || []).filter((key) => key !== sectionKey),
      `${product.name} removed from ${SECTION_LABELS[sectionKey]}`,
    );
  };

  /* ── Coupons ── */

  const openCouponEditor = (coupon = null) => {
    setCouponEditing(coupon);
    setCouponModalOpen(true);
  };

  const handleCouponDelete = async (coupon) => {
    if (!window.confirm(`Delete coupon ${coupon.code}?`)) return;
    try {
      await axios.delete(`/api/coupons/${coupon._id}`, { headers: getAdminAuthHeader() });
      setCoupons((prev) => prev.filter((item) => item._id !== coupon._id));
      toast.success('Coupon deleted');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to delete coupon');
    }
  };

  const couponStatus = (coupon) => {
    if (!coupon.active) return { label: 'Inactive', className: 'status-cancelled' };
    if (coupon.expiresAt && new Date(coupon.expiresAt) < new Date()) {
      return { label: 'Expired', className: 'status-pending' };
    }
    return { label: 'Active', className: 'status-shipped' };
  };

  const couponScope = (coupon) => {
    if (coupon.scope === 'products') {
      const count = (coupon.products || []).length;
      return `${count} product${count === 1 ? '' : 's'}`;
    }
    if (coupon.scope === 'categories') {
      const names = coupon.categories || [];
      return names.length ? names.join(', ') : 'No category';
    }
    return 'Whole cart';
  };

  const handleOrderStatus = async (id, status) => {
    if (!STATUSES_SET.has(status)) return;
    try {
      await axios.put(`/api/orders/${id}/status`, { status }, { headers: getAdminAuthHeader() });
      toast.success('Order updated!');
      fetchData();
    } catch {
      toast.error('Failed to update');
    }
  };

  /* ── Derived overview data ── */

  const overview = useMemo(() => {
    const totalRevenue = orders.reduce((a, o) => a + (o.totalPrice || 0), 0);
    const statusCount = (s) => orders.filter((o) => o.status === s).length;

    const ordered = [...orders].sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
    const buckets = new Map();
    ordered.forEach((o) => {
      if (!o.createdAt) return;
      const d = new Date(o.createdAt);
      const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
      const entry = buckets.get(key) || { key, date: d, revenue: 0, orders: 0 };
      entry.revenue += o.totalPrice || 0;
      entry.orders += 1;
      buckets.set(key, entry);
    });
    const daily = [...buckets.values()].sort((a, b) => a.date - b.date);

    const half = Math.floor(daily.length / 2);
    const prevRevenue = daily.slice(0, half).reduce((a, d) => a + d.revenue, 0);
    const recentRevenue = daily.slice(half).reduce((a, d) => a + d.revenue, 0);

    const recentOrders = [...orders].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    const last7 = recentOrders.filter((o) => o.createdAt && Date.now() - new Date(o.createdAt).getTime() < 7 * 864e5).length;
    const prev7 = orders.length - last7;

    const categoryMap = new Map();
    products.forEach((p) => {
      const k = p.category || 'Uncategorised';
      const entry = categoryMap.get(k) || { name: k, count: 0, value: 0 };
      entry.count += 1;
      entry.value += (p.price || 0) * (p.stock || 0);
      categoryMap.set(k, entry);
    });
    const categories = [...categoryMap.values()].sort((a, b) => b.count - a.count);

    return {
      totalRevenue,
      revenueDelta: trendDelta(recentRevenue, prevRevenue),
      avgOrder: orders.length ? totalRevenue / orders.length : 0,
      orderCount: orders.length,
      ordersDelta: trendDelta(last7, prev7),
      productCount: products.length,
      outOfStock: products.filter((p) => (p.stock || 0) <= 0).length,
      lowStock: products.filter((p) => (p.stock || 0) > 0 && p.stock < 5).length,
      pending: statusCount('pending'),
      statusCounts: Object.fromEntries(STATUSES.map((s) => [s, statusCount(s)])),
      daily,
      recentOrders,
      last7,
      categories,
      revenueSeries: sample(daily.map((d) => d.revenue), 16),
      orderSeries: sample(daily.map((d) => d.orders), 16),
    };
  }, [orders, products]);

  const chartData = useMemo(() => {
    const days = overview.daily.slice(-14);
    return days.map((d) => ({
      key: d.key,
      revenue: d.revenue,
      orders: d.orders,
      label: d.date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }),
    }));
  }, [overview.daily]);

  const maxCatCount = overview.categories.length ? overview.categories[0].count : 1;

  /* ── Products table ── */

  const categories = useMemo(() => [...new Set(products.map((p) => p.category).filter(Boolean))].sort(), [products]);

  const filteredProducts = useMemo(() => {
    const q = productQuery.trim().toLowerCase();
    let list = products.filter((p) => {
      if (productCategory !== 'All' && p.category !== productCategory) return false;
      if (!q) return true;
      return `${p.name} ${p.category}`.toLowerCase().includes(q);
    });
    const dir = productSort.dir === 'asc' ? 1 : -1;
    list = [...list].sort((a, b) => {
      const av = a[productSort.field];
      const bv = b[productSort.field];
      if (productSort.field === 'stock' || productSort.field === 'price') return ((av || 0) - (bv || 0)) * dir;
      return String(av ?? '').localeCompare(String(bv ?? '')) * dir;
    });
    return list;
  }, [products, productQuery, productCategory, productSort]);

  /* ── Orders table ── */

  const filteredOrders = useMemo(() => {
    const q = orderQuery.trim().toLowerCase();
    let list = orders.filter((o) => {
      if (orderStatus === 'All') return true;
      return (o.status || 'pending') === orderStatus;
    });
    if (q) {
      list = list.filter((o) => `${o._id} ${o.user?.name || ''} ${o.user?.email || ''}`.toLowerCase().includes(q));
    }
    const dir = orderSort.dir === 'asc' ? 1 : -1;
    return [...list].sort((a, b) => {
      if (orderSort.field === 'totalPrice') return ((a.totalPrice || 0) - (b.totalPrice || 0)) * dir;
      if (orderSort.field === 'customer') return String(a.user?.name || '').localeCompare(String(b.user?.name || '')) * dir;
      return (new Date(a.createdAt) - new Date(b.createdAt)) * dir;
    });
  }, [orders, orderQuery, orderStatus, orderSort]);

  const toggleSort = (setter, field) => setter((prev) => (prev.field === field ? { field, dir: prev.dir === 'asc' ? 'desc' : 'asc' } : { field, dir: 'asc' }));

  /* ── Home page preview data ── */

  const sectionProducts = useMemo(() => {
    const map = {};
    HOME_SECTIONS.forEach(({ key }) => {
      map[key] = products.filter((p) => (p.placements || []).includes(key));
    });
    return map;
  }, [products]);

  const hasPlacements = products.some((p) => (p.placements || []).length > 0);

  const exportOrdersCsv = () => {
    downloadCsv(
      [
        ['Order ID', 'Customer', 'Email', 'Items', 'Total (INR)', 'Status', 'Date'],
        ...filteredOrders.map((o) => [
          `#${shortId(o._id)}`, o.user?.name || 'N/A', o.user?.email || '',
          o.orderItems?.length || 0, o.totalPrice || 0, o.status || '', formatDate(o.createdAt, true),
        ]),
      ],
      'ziishe-orders.csv',
    );
    toast.success('Orders exported');
  };

  const exportProductsCsv = () => {
    downloadCsv(
      [
        ['Name', 'Category', 'Price (INR)', 'Stock', 'Sizes', 'Colors', 'Featured'],
        ...filteredProducts.map((p) => [
          p.name, p.category, p.price, p.stock, (p.sizes || []).join(' / '), (p.colors || []).join(' / '), p.featured ? 'Yes' : 'No',
        ]),
      ],
      'ziishe-products.csv',
    );
    toast.success('Products exported');
  };

  const statCards = [
    { label: 'Total Revenue', value: formatPrice(overview.totalRevenue), icon: FiDollarSign, delta: overview.revenueDelta, spark: overview.revenueSeries, gold: true },
    { label: 'Orders', value: overview.orderCount, icon: FiShoppingBag, delta: overview.ordersDelta, spark: overview.orderSeries },
    { label: 'Products', value: overview.productCount, icon: FiPackage, meta: { value: overview.outOfStock, total: overview.productCount || 1, label: `${overview.outOfStock} out of stock`, gold: false } },
    { label: 'Pending Orders', value: overview.pending, icon: FiClock, meta: { value: overview.pending, total: overview.orderCount || 1, label: `${overview.orderCount ? Math.round((overview.pending / overview.orderCount) * 100) : 0}% of all orders`, gold: true }, gold: true },
  ];

  if (!admin) return null;

  return (
    <div className={`adm-root${navOpen ? ' adm-nav-open' : ''}`}>
      <button type="button" className="adm-backdrop" aria-label="Close navigation" tabIndex={-1} onClick={() => setNavOpen(false)} />

      {/* ── Sidebar ── */}
      <aside className="adm-sidebar">
        <div className="adm-brand">
          <span className="adm-brand-mark">T</span>
          <span className="adm-brand-text">
            <strong>ZiiShe</strong>
            <span>Admin</span>
          </span>
        </div>

        <nav className="adm-nav" aria-label="Admin sections">
          <p className="adm-nav-label">Menu</p>
          {NAV.map(({ key, label, icon: Icon }) => (
            <button key={key} type="button" className={`adm-nav-item${tab === key ? ' active' : ''}`} onClick={() => switchTab(key)} aria-current={tab === key ? 'page' : undefined}>
              <Icon aria-hidden="true" />
              {label}
              {key === 'Orders' && overview.pending > 0 && <span className="adm-nav-badge">{overview.pending}</span>}
            </button>
          ))}
        </nav>

        <div className="adm-side-foot">
          <div className="adm-side-user">
            <span className="adm-side-avatar">{admin.name?.charAt(0).toUpperCase() || 'A'}</span>
            <span className="adm-side-id">
              <strong>{admin.name}</strong>
              <span>{admin.email || 'Administrator'}</span>
            </span>
          </div>
          <button type="button" className="adm-side-link" onClick={handleLogout}><FiLogOut aria-hidden="true" /> Sign out</button>
          <Link to="/" className="adm-side-link"><FiArrowLeft aria-hidden="true" /> View storefront</Link>
        </div>
      </aside>

      {/* ── Workspace ── */}
      <div className="adm-main">
        <header className="adm-topbar">
          <button type="button" className="adm-burger" onClick={() => setNavOpen(true)} aria-label="Open navigation"><FiGrid /></button>
          <div className="adm-crumb">
            <span>Console</span>
            <strong>{tab}</strong>
          </div>
          <div className="adm-live"><i /> <b>{overview.last7}</b> orders this week</div>
          <span className="adm-topbar-avatar" title={admin.name}>{admin.name?.charAt(0).toUpperCase() || 'A'}</span>
        </header>

        <div className="adm-body">
          {loading ? (
            <div className="adm-card"><div className="adm-skeleton"><i /><i /><i /><i /><i /><i /></div></div>
          ) : (
            <>
              {/* ── Overview ── */}
              {tab === 'Overview' && (
                <div className="adm-page">
                  <div className="adm-head">
                    <div>
                      <span className="adm-eyebrow">Dashboard</span>
                      <h1>Welcome back, {firstName(admin.name)}</h1>
                      <p>Here's how ZiiShe is performing right now.</p>
                    </div>
                    <button type="button" className="adm-btn adm-btn-solid" onClick={() => openEditor()}>
                      <FiPlus /> Add product
                    </button>
                  </div>

                  <div className="adm-stats">
                    {statCards.map(({ label, value, icon: Icon, delta, spark, meta, gold }) => (
                      <div key={label} className={`adm-stat${gold ? ' adm-stat-gold' : ''}`}>
                        <div className="adm-stat-top">
                          <span className="adm-stat-ico"><Icon /></span>
                          {delta && (
                            <span className={`adm-delta ${delta.dir === 'up' ? 'up' : delta.dir === 'down' ? 'down' : ''}`}>
                              {delta.dir === 'up' && <FiArrowUpRight />}{delta.dir === 'down' && <FiArrowUpRight style={{ transform: 'rotate(90deg)' }} />}{delta.text}
                            </span>
                          )}
                        </div>
                        <div className="adm-stat-val">{value}</div>
                        <div className="adm-stat-lbl">{label}</div>
                        {spark ? <Sparkline values={spark} color={gold ? 'var(--gold)' : 'var(--black)'} /> : null}
                        {meta ? <div className="adm-meta" title={meta.label}><i style={{ width: `${pct(meta.value, meta.total)}%` }} /></div> : null}
                      </div>
                    ))}
                  </div>

                  <div className="adm-grid-2">
                    <div className="adm-card">
                      <div className="adm-card-head">
                        <div>
                          <p className="adm-card-title">Revenue trend</p>
                          <p className="adm-card-sub">{chartData.length ? `Last ${chartData.length} days` : 'No order history yet'}</p>
                        </div>
                        <button type="button" className="adm-btn adm-btn-ghost adm-btn-sm" onClick={exportOrdersCsv} disabled={!orders.length}>
                          <FiDownload /> Export
                        </button>
                      </div>
                      {chartData.length ? (
                        <>
                          <RevenueChart data={chartData} />
                          <div className="adm-chart-foot">
                            <span><i className="gold" /> Revenue {formatPrice(chartData.reduce((a, d) => a + d.revenue, 0))}</span>
                            <span><i /> {chartData.reduce((a, d) => a + d.orders, 0)} orders</span>
                            <span>Avg order {formatPrice(overview.avgOrder)}</span>
                          </div>
                        </>
                      ) : (
                        <EmptyState icon={FiTrendingUp} title="No revenue yet" text="Once orders start coming in, your trend line will appear here." />
                      )}
                    </div>

                    <div className="adm-side-col">
                      <div className="adm-card">
                        <div className="adm-card-head">
                          <div>
                            <p className="adm-card-title">Orders by status</p>
                            <p className="adm-card-sub">{overview.orderCount} total</p>
                          </div>
                        </div>
                        {overview.orderCount ? (
                          <div className="adm-bars">
                            {STATUSES.map((s, i) => (
                              <div key={s} className={`adm-bar-row${i % 2 ? ' gold' : ''}`}>
                                <div className="adm-bar-top">
                                  <strong style={{ textTransform: 'capitalize' }}>{s}</strong>
                                  <span>{overview.statusCounts[s]}</span>
                                </div>
                                <div className="adm-bar-track"><i style={{ width: `${pct(overview.statusCounts[s], overview.orderCount)}%` }} /></div>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <EmptyState icon={FiShoppingBag} title="No orders yet" text="Order statuses will be summarised here." />
                        )}
                      </div>

                      <div className="adm-card">
                        <div className="adm-card-head">
                          <div>
                            <p className="adm-card-title">Recent activity</p>
                            <p className="adm-card-sub">Latest {Math.min(6, overview.recentOrders.length)} orders</p>
                          </div>
                        </div>
                        {overview.recentOrders.length ? (
                          <div className="adm-feed">
                            {overview.recentOrders.slice(0, 6).map((o) => (
                              <div key={o._id} className="adm-feed-item">
                                <span className="adm-feed-dot" />
                                <div className="adm-feed-body">
                                  <p><strong>{o.user?.name || 'Customer'}</strong> placed an order</p>
                                  <time>#{shortId(o._id)} · {relativeDate(o.createdAt)}</time>
                                </div>
                                <span className="adm-feed-amt">{formatPrice(o.totalPrice)}</span>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <EmptyState icon={FiInbox} title="Nothing yet" text="New orders will show up in this feed." />
                        )}
                      </div>
                    </div>
                  </div>

                  {overview.categories.length > 0 && (
                    <div className="adm-card">
                      <div className="adm-card-head">
                        <div>
                          <p className="adm-card-title">Catalogue by category</p>
                          <p className="adm-card-sub">{overview.productCount} products across {overview.categories.length} categories</p>
                        </div>
                      </div>
                      <div className="adm-bars">
                        {overview.categories.map((c, i) => (
                          <div key={c.name} className={`adm-bar-row${i === 0 ? ' gold' : ''}`}>
                            <div className="adm-bar-top">
                              <strong>{c.name}</strong>
                              <span>{c.count} items · {formatPrice(c.value)} stock value</span>
                            </div>
                            <div className="adm-bar-track"><i style={{ width: `${pct(c.count, maxCatCount)}%` }} /></div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* ── Products ── */}
              {tab === 'Products' && (
                <div className="adm-page">
                  <div className="adm-head">
                    <div>
                      <span className="adm-eyebrow">Catalogue</span>
                      <h1>Products</h1>
                      <p>{overview.productCount} products{overview.outOfStock > 0 ? ` · ${overview.outOfStock} out of stock` : ''}{overview.lowStock > 0 ? ` · ${overview.lowStock} low stock` : ''}</p>
                    </div>
                    <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap' }}>
                      <button type="button" className="adm-btn adm-btn-ghost" onClick={exportProductsCsv} disabled={!filteredProducts.length}><FiDownload /> Export</button>
                      <button type="button" className="adm-btn adm-btn-ghost" onClick={() => setCategoryModalOpen(true)}><FiTag /> Edit categories</button>
                      <button type="button" className="adm-btn adm-btn-solid" onClick={() => openEditor()}><FiPlus /> Add product</button>
                    </div>
                  </div>

                  <div className="adm-card">
                    <div className="adm-toolbar">
                      <label className="adm-search">
                        <FiSearch aria-hidden="true" />
                        <input type="search" value={productQuery} onChange={(e) => setProductQuery(e.target.value)} placeholder="Search by name or category…" />
                      </label>
                      <select className="adm-select" value={productCategory} onChange={(e) => setProductCategory(e.target.value)} aria-label="Filter by category">
                        <option value="All">All categories</option>
                        {categories.map((c) => <option key={c} value={c}>{c}</option>)}
                      </select>
                    </div>

                    {filteredProducts.length ? (
                      <div className="adm-table-wrap">
                        <table className="adm-table">
                          <thead>
                            <tr>
                              <SortHeader label="Product" field="name" sort={productSort} onSort={(f) => toggleSort(setProductSort, f)} />
                              <th>ID</th>
                              <SortHeader label="Category" field="category" sort={productSort} onSort={(f) => toggleSort(setProductSort, f)} />
                              <SortHeader label="Price" field="price" sort={productSort} onSort={(f) => toggleSort(setProductSort, f)} />
                              <SortHeader label="Stock" field="stock" sort={productSort} onSort={(f) => toggleSort(setProductSort, f)} />
                              <th style={{ textAlign: 'right' }}>Actions</th>
                            </tr>
                          </thead>
                          <tbody>
                            {filteredProducts.map((p) => (
                              <tr key={p._id}>
                                <td>
                                  <div className="adm-prod">
                                    {p.image
                                      ? <OptimizedCloudinaryImage src={p.image} alt={p.name} className="adm-thumb" width="46" height="56" />
                                      : <span className="adm-thumb adm-thumb-fallback"><FiImage /></span>}
                                    <span>
                                      <span className="adm-prod-name">{p.name}</span>
                                      {(p.sizes?.length || p.colors?.length) ? (
                                        <span className="adm-prod-sub">{[p.sizes?.length ? `${p.sizes.length} sizes` : null, p.colors?.length ? `${p.colors.length} colours` : null].filter(Boolean).join(' · ')}</span>
                                      ) : null}
                                    </span>
                                  </div>
                                </td>
                                <td><span className="adm-code">{p.code ? `#${p.code}` : '—'}</span></td>
                                <td><span className="adm-chip">{p.category || '—'}</span></td>
                                <td className="adm-money">
                                  {formatPrice(p.price)}
                                  {Number(p.mrp) > Number(p.price) && (
                                    <span className="adm-money-mrp">{formatPrice(p.mrp)}</span>
                                  )}
                                </td>
                                <td>
                                  <span className={`adm-stock${(p.stock || 0) <= 0 ? ' out' : p.stock < 5 ? ' low' : ''}`}><i /> {p.stock ?? 0}</span>
                                </td>
                                <td>
                                  <div className="adm-row-actions">
                                    <button type="button" className="adm-mini" title="Edit" onClick={() => openEditor(p)}><FiEdit2 /></button>
                                    <button type="button" className="adm-mini danger" title="Delete" onClick={() => handleDelete(p._id)}><FiTrash2 /></button>
                                  </div>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <EmptyState
                        icon={FiPackage}
                        title={products.length ? 'No products match' : 'No products yet'}
                        text={products.length ? 'Try a different search term or category filter.' : 'Add your first product to start building the catalogue.'}
                        action={<button type="button" className="adm-btn adm-btn-solid" onClick={() => openEditor()}><FiPlus /> Add product</button>}
                      />
                    )}
                  </div>
                </div>
              )}

              {/* ── Orders ── */}
              {tab === 'Orders' && (
                <div className="adm-page">
                  <div className="adm-head">
                    <div>
                      <span className="adm-eyebrow">Fulfilment</span>
                      <h1>Orders</h1>
                      <p>{overview.orderCount} orders · {overview.pending} awaiting action</p>
                    </div>
                    <button type="button" className="adm-btn adm-btn-ghost" onClick={exportOrdersCsv} disabled={!filteredOrders.length}><FiDownload /> Export CSV</button>
                  </div>

                  <div className="adm-card">
                    <div className="adm-toolbar">
                      <label className="adm-search">
                        <FiSearch aria-hidden="true" />
                        <input type="search" value={orderQuery} onChange={(e) => setOrderQuery(e.target.value)} placeholder="Search by order ID, customer or email…" />
                      </label>
                      <select className="adm-select" value={orderStatus} onChange={(e) => setOrderStatus(e.target.value)} aria-label="Filter by status">
                        {ORDER_STATUSES.map((s) => <option key={s} value={s}>{s === 'All' ? 'All statuses' : s[0].toUpperCase() + s.slice(1)}</option>)}
                      </select>
                    </div>

                    {filteredOrders.length ? (
                      <div className="adm-table-wrap">
                        <table className="adm-table">
                          <thead>
                            <tr>
                              <th>Order</th>
                              <SortHeader label="Customer" field="customer" sort={orderSort} onSort={(f) => toggleSort(setOrderSort, f)} />
                              <th>Items</th>
                              <SortHeader label="Total" field="totalPrice" sort={orderSort} onSort={(f) => toggleSort(setOrderSort, f)} />
                              <th>Status</th>
                              <SortHeader label="Date" field="createdAt" sort={orderSort} onSort={(f) => toggleSort(setOrderSort, f)} />
                              <th style={{ textAlign: 'right' }}>Update</th>
                            </tr>
                          </thead>
                          <tbody>
                            {filteredOrders.map((o) => (
                              <tr key={o._id}>
                                <td><span className="adm-oid">#{shortId(o._id)}</span></td>
                                <td>
                                  <div className="adm-prod-name">{o.user?.name || 'N/A'}</div>
                                  <div className="adm-muted">{o.user?.email}</div>
                                </td>
                                <td>{o.orderItems?.length || 0}</td>
                                <td className="adm-money">{formatPrice(o.totalPrice)}</td>
                                <td><span className={`adm-pill ${statusColor(o.status)}`}><i /> {o.status || 'pending'}</span></td>
                                <td className="adm-muted">{formatDate(o.createdAt)}</td>
                                <td>
                                  <div className="adm-row-actions">
                                    <select
                                      className={`adm-status-select ${statusColor(o.status)}`}
                                      value={o.status || 'pending'}
                                      onChange={(e) => handleOrderStatus(o._id, e.target.value)}
                                      aria-label={`Update status for order ${shortId(o._id)}`}
                                    >
                                      {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                                    </select>
                                  </div>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <EmptyState
                        icon={FiShoppingBag}
                        title={orders.length ? 'No orders match' : 'No orders yet'}
                        text={orders.length ? 'Try a different search term or status filter.' : 'Orders placed on the storefront will appear here.'}
                      />
                    )}
                  </div>
                </div>
              )}

              {/* ── Coupons ── */}
              {tab === 'Coupons' && (
                <div className="adm-page">
                  <div className="adm-head">
                    <div>
                      <span className="adm-eyebrow">Promotions</span>
                      <h1>Coupons</h1>
                      <p>{coupons.length} coupon{coupons.length === 1 ? '' : 's'} · {coupons.filter((c) => couponStatus(c).label === 'Active').length} active right now</p>
                    </div>
                    <button type="button" className="adm-btn adm-btn-solid" onClick={() => openCouponEditor()}>
                      <FiPlus /> Create coupon
                    </button>
                  </div>

                  <div className="adm-card">
                    {coupons.length ? (
                      <div className="adm-table-wrap">
                        <table className="adm-table">
                          <thead>
                            <tr>
                              <th>Code</th>
                              <th>Discount</th>
                              <th>Applies to</th>
                              <th>Min. order</th>
                              <th>Status</th>
                              <th>Expires</th>
                              <th style={{ textAlign: 'right' }}>Actions</th>
                            </tr>
                          </thead>
                          <tbody>
                            {coupons.map((coupon) => {
                              const status = couponStatus(coupon);
                              return (
                                <tr key={coupon._id}>
                                  <td>
                                    <span className="adm-oid">{coupon.code}</span>
                                    {coupon.description && <div className="adm-muted">{coupon.description}</div>}
                                  </td>
                                  <td className="adm-money">
                                    {coupon.type === 'percent' ? `${coupon.value}% off` : `${formatPrice(coupon.value)} off`}
                                  </td>
                                  <td>
                                    <span className="adm-chip" title={couponScope(coupon)}>{couponScope(coupon)}</span>
                                  </td>
                                  <td className="adm-muted">{coupon.minSubtotal ? formatPrice(coupon.minSubtotal) : '—'}</td>
                                  <td><span className={`adm-pill ${status.className}`}><i /> {status.label}</span></td>
                                  <td className="adm-muted">{coupon.expiresAt ? formatDate(coupon.expiresAt) : 'No expiry'}</td>
                                  <td>
                                    <div className="adm-row-actions">
                                      <button type="button" className="adm-mini" title="Edit coupon" onClick={() => openCouponEditor(coupon)}><FiEdit2 /></button>
                                      <button type="button" className="adm-mini danger" title="Delete coupon" onClick={() => handleCouponDelete(coupon)}><FiTrash2 /></button>
                                    </div>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <EmptyState
                        icon={FiPercent}
                        title="No coupons yet"
                        text="Create a code and pick whether it discounts the whole cart, certain products or a category."
                        action={<button type="button" className="adm-btn adm-btn-solid" onClick={() => openCouponEditor()}><FiPlus /> Create coupon</button>}
                      />
                    )}
                  </div>
                </div>
              )}

              {/* ── Home page preview ── */}
              {tab === 'Home' && (
                <div className="adm-page">
                  <div className="adm-head">
                    <div>
                      <span className="adm-eyebrow">Storefront</span>
                      <h1>Home page preview</h1>
                      <p>Every product currently showing in each home page section. Add or remove a product here to change what goes live.</p>
                    </div>
                    <Link to="/" className="adm-btn adm-btn-ghost"><FiArrowUpRight /> View home page</Link>
                  </div>

                  {!hasPlacements && (
                    <p className="adm-note">
                      <FiInfo aria-hidden="true" />
                      <span>No product has been ticked for a section yet, so the home page is currently filling every section with featured products. Ticking a product below switches it to manual control.</span>
                    </p>
                  )}

                  <div className="adm-home-sections">
                    {HOME_SECTIONS.map((section) => {
                      const items = sectionProducts[section.key] || [];
                      const candidates = products
                        .filter((p) => !(p.placements || []).includes(section.key))
                        .sort((a, b) => String(a.name).localeCompare(String(b.name)));
                      const pick = placementPick[section.key] || '';

                      return (
                        <div className="adm-card" key={section.key}>
                          <div className="adm-card-head">
                            <div>
                              <p className="adm-card-title">{section.title}</p>
                              <p className="adm-card-sub">{section.note}</p>
                            </div>
                            <span className="adm-chip">
                              {items.length} {section.limit ? `/ ${section.limit} shown` : items.length === 1 ? 'slide' : 'slides'}
                            </span>
                          </div>

                          <div className="adm-home-body">
                            {items.length ? (
                              <ol className="adm-home-list">
                                {items.map((p, index) => {
                                  const overflow = section.limit ? index >= section.limit : false;
                                  const elsewhere = (p.placements || [])
                                    .filter((key) => key !== section.key)
                                    .map((key) => SECTION_LABELS[key]);
                                  return (
                                    <li key={p._id} className={`adm-home-item${overflow ? ' is-overflow' : ''}`}>
                                      <span className="adm-home-pos">{index + 1}</span>
                                      {p.image
                                        ? <OptimizedCloudinaryImage src={p.image} alt={p.name} className="adm-thumb" width="46" height="56" />
                                        : <span className="adm-thumb adm-thumb-fallback"><FiImage /></span>}
                                      <span className="adm-home-info">
                                        <span className="adm-home-name">{p.name}</span>
                                        <span className="adm-home-meta">{formatPrice(p.price)} · {p.category || 'Uncategorised'}</span>
                                        {elsewhere.length > 0 && (
                                          <span className="adm-home-tags">
                                            {elsewhere.map((label) => <span className="adm-chip" key={label}>Also in {label}</span>)}
                                          </span>
                                        )}
                                        {overflow && (
                                          <span className="adm-home-warn">Saved, but not visible — the storefront shows the first {section.limit}.</span>
                                        )}
                                      </span>
                                      <span className="adm-home-actions">
                                        <button type="button" className="adm-mini" title="Edit product" onClick={() => openEditor(p)}><FiEdit2 /></button>
                                        <button
                                          type="button"
                                          className="adm-mini danger"
                                          title={`Remove from ${section.label}`}
                                          aria-label={`Remove ${p.name} from ${section.label}`}
                                          disabled={placementSavingId === p._id}
                                          onClick={() => removeFromSection(p, section.key)}
                                        >
                                          <FiEyeOff />
                                        </button>
                                      </span>
                                    </li>
                                  );
                                })}
                              </ol>
                            ) : (
                              <p className="adm-home-empty">
                                Nothing ticked here yet.{!hasPlacements && ' The storefront is falling back to featured products for now.'}
                              </p>
                            )}

                            <div className="adm-home-add">
                              <select
                                className="adm-select"
                                value={pick}
                                onChange={(e) => setPlacementPick((prev) => ({ ...prev, [section.key]: e.target.value }))}
                                aria-label={`Add a product to ${section.label}`}
                                disabled={!candidates.length}
                              >
                                <option value="">{candidates.length ? 'Add a product to this section…' : 'Every product is already here'}</option>
                                {candidates.map((p) => (
                                  <option key={p._id} value={p._id}>{p.name} — {p.category || 'Uncategorised'}</option>
                                ))}
                              </select>
                              <button
                                type="button"
                                className="adm-btn adm-btn-solid adm-btn-sm"
                                disabled={!pick || placementSavingId !== null}
                                onClick={() => {
                                  addToSection(products.find((p) => p._id === pick), section.key);
                                  setPlacementPick((prev) => ({ ...prev, [section.key]: '' }));
                                }}
                              >
                                <FiPlus /> Add
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* ── Settings ── */}
              {tab === 'Settings' && (
                <div className="adm-page">
                  <div className="adm-head">
                    <div>
                      <span className="adm-eyebrow">Store control</span>
                      <h1>Settings</h1>
                      <p>Switch the storefront status pages on or off. Changes reach every open customer tab as soon as you save.</p>
                    </div>
                  </div>

                  <p className="adm-note adm-settings-note">
                    <FiInfo aria-hidden="true" />
                    <span>While either page is on, customers cannot browse ZiiShe. The admin console stays open so you can always switch it back off.</span>
                  </p>

                  {!settingsLoaded ? (
                    <div className="adm-card"><div className="adm-skeleton"><i /><i /><i /></div></div>
                  ) : (
                    <>
                      <div className="adm-settings-grid">
                        <div className={`adm-card adm-setting${settingsForm.maintenanceEnabled ? ' is-on' : ''}`}>
                          <div className="adm-setting-head">
                            <span className="adm-setting-ico"><FiTool /></span>
                            <div className="adm-setting-copy">
                              <p className="adm-card-title">Maintenance mode</p>
                              <p className="adm-card-sub">Replaces the storefront with a “we’ll be right back” page.</p>
                            </div>
                            <label className="adm-switch">
                              <input
                                type="checkbox"
                                checked={settingsForm.maintenanceEnabled}
                                onChange={(e) => setSettingsForm((prev) => ({ ...prev, maintenanceEnabled: e.target.checked }))}
                                aria-label="Enable maintenance mode"
                              />
                              <span aria-hidden="true" />
                            </label>
                          </div>
                          <div className={`adm-setting-state${settingsForm.maintenanceEnabled ? ' on' : ''}`}>
                            <i /> {settingsForm.maintenanceEnabled ? 'Maintenance page is live' : 'Storefront is open'}
                          </div>
                          <label className="adm-setting-field">
                            <span>Message shown to customers <em>optional</em></span>
                            <textarea
                              rows={3}
                              maxLength={500}
                              value={settingsForm.maintenanceMessage}
                              onChange={(e) => setSettingsForm((prev) => ({ ...prev, maintenanceMessage: e.target.value }))}
                              placeholder="ZiiShe is getting some care behind the scenes. Please check back in a few minutes."
                            />
                          </label>
                        </div>

                        <div className={`adm-card adm-setting${settingsForm.issueEnabled ? ' is-on' : ''}`}>
                          <div className="adm-setting-head">
                            <span className="adm-setting-ico adm-setting-ico--issue"><FiAlertTriangle /></span>
                            <div className="adm-setting-copy">
                              <p className="adm-card-title">Technical issue page</p>
                              <p className="adm-card-sub">Shows a “we’re fixing something” page while a problem is being resolved.</p>
                            </div>
                            <label className="adm-switch">
                              <input
                                type="checkbox"
                                checked={settingsForm.issueEnabled}
                                onChange={(e) => setSettingsForm((prev) => ({ ...prev, issueEnabled: e.target.checked }))}
                                aria-label="Enable technical issue page"
                              />
                              <span aria-hidden="true" />
                            </label>
                          </div>
                          <div className={`adm-setting-state${settingsForm.issueEnabled ? ' on' : ''}`}>
                            <i /> {settingsForm.issueEnabled ? 'Technical issue page is live' : 'No active issue notice'}
                          </div>
                          <label className="adm-setting-field">
                            <span>Message shown to customers <em>optional</em></span>
                            <textarea
                              rows={3}
                              maxLength={500}
                              value={settingsForm.issueMessage}
                              onChange={(e) => setSettingsForm((prev) => ({ ...prev, issueMessage: e.target.value }))}
                              placeholder="ZiiShe is having a technical issue right now. Our team is already on it — please try again shortly."
                            />
                          </label>
                        </div>
                      </div>

                      <div className="adm-settings-foot">
                        <p>
                          {settingsForm.maintenanceEnabled && settingsForm.issueEnabled
                            ? 'Customers will see the maintenance page (it takes priority).'
                            : settingsForm.maintenanceEnabled
                              ? 'Customers will see the maintenance page.'
                              : settingsForm.issueEnabled
                                ? 'Customers will see the technical issue page.'
                                : 'Customers can browse the storefront normally.'}
                        </p>
                        <button
                          type="button"
                          className="adm-btn adm-btn-solid"
                          onClick={saveSettings}
                          disabled={savingSettings}
                        >
                          {savingSettings ? 'Saving…' : 'Save settings'}
                        </button>
                      </div>
                    </>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </div>

      <CategoryManager
        open={categoryModalOpen}
        onClose={() => setCategoryModalOpen(false)}
      />

      <CouponEditor
        open={couponModalOpen}
        coupon={couponEditing}
        products={products}
        categories={categories}
        onClose={() => setCouponModalOpen(false)}
        onSaved={() => fetchData({ silent: true })}
      />

    </div>
  );
}
