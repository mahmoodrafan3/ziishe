import { useState, useEffect, useMemo, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import axios from 'axios';
import toast from 'react-hot-toast';
import { useAdminAuth } from '../context/AdminAuthContext';
import { getAdminAuthHeader, formatPrice, statusColor } from '../utils/helpers';
import {
  FiGrid, FiPackage, FiShoppingBag, FiTrendingUp, FiDollarSign, FiClock,
  FiSearch, FiDownload, FiEdit2, FiTrash2, FiPlus, FiX, FiImage,
  FiLogOut, FiArrowLeft, FiArrowUpRight, FiChevronDown, FiInbox,
} from 'react-icons/fi';

/* ── Small helpers ─────────────────────────────────────────── */

const NAV = [
  { key: 'Overview', label: 'Overview', icon: FiGrid },
  { key: 'Products', label: 'Products', icon: FiPackage },
  { key: 'Orders',   label: 'Orders',   icon: FiShoppingBag },
];

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
  const { admin, adminLogout } = useAdminAuth();
  const navigate = useNavigate();

  const [tab, setTab] = useState('Overview');
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

  // product editor
  const [modalOpen, setModalOpen] = useState(false);
  const [editProduct, setEditProduct] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({ name: '', description: '', price: '', category: '', image: '', imageFile: null, sizes: '', colors: '', stock: '', featured: false });
  const fileInputRef = useRef(null);
  const objectUrlRef = useRef(null);

  useEffect(() => {
    if (!admin) { navigate('/admin/login', { replace: true }); return; }
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [admin]);

  // Lock body scroll while the mobile rail is open.
  useEffect(() => {
    document.body.style.overflow = navOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [navOpen]);

  // Release the object URL backing the image preview when it's replaced/unmounted.
  useEffect(() => () => { if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current); }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [pRes, oRes] = await Promise.all([
        axios.get('/api/products'),
        axios.get('/api/orders', { headers: getAdminAuthHeader() }),
      ]);
      setProducts(Array.isArray(pRes.data) ? pRes.data : []);
      setOrders(Array.isArray(oRes.data) ? oRes.data : []);
    } catch {
      toast.error('Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    adminLogout();
    navigate('/admin/login', { replace: true });
  };

  const switchTab = (key) => { setTab(key); setNavOpen(false); };

  /* ── Product editor ── */

  const openModal = (product = null) => {
    if (product) {
      setEditProduct(product);
      setForm({
        name: product.name ?? '', description: product.description ?? '', price: product.price ?? '',
        category: product.category ?? '', image: product.image ?? '', imageFile: null,
        sizes: (product.sizes || []).join(', '), colors: (product.colors || []).join(', '),
        stock: product.stock ?? '', featured: Boolean(product.featured),
      });
    } else {
      setEditProduct(null);
      setForm({ name: '', description: '', price: '', category: '', image: '', imageFile: null, sizes: '', colors: '', stock: '', featured: false });
    }
    setModalOpen(true);
  };

  const handleFormChange = (e) => {
    const { name, type, checked, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
  };

  const handleImageFile = (e) => {
    const file = e.target.files?.[0] ?? null;
    if (objectUrlRef.current) { URL.revokeObjectURL(objectUrlRef.current); objectUrlRef.current = null; }
    if (file) {
      const url = URL.createObjectURL(file);
      objectUrlRef.current = url;
      setForm((prev) => ({ ...prev, imageFile: file, image: url }));
    } else {
      setForm((prev) => ({ ...prev, imageFile: null }));
    }
  };

  const clearImage = () => {
    if (objectUrlRef.current) { URL.revokeObjectURL(objectUrlRef.current); objectUrlRef.current = null; }
    setForm((prev) => ({ ...prev, imageFile: null, image: '' }));
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!form.name || !form.category || !form.price || !form.stock) {
      toast.error('Please fill in Name, Category, Price and Stock');
      return;
    }
    if (!form.image && !form.imageFile) {
      toast.error('Please add a product image or paste an image URL');
      return;
    }
    setSubmitting(true);
    try {
      const payload = new FormData();
      payload.append('name', form.name);
      payload.append('description', form.description);
      payload.append('price', form.price);
      payload.append('category', form.category);
      payload.append('sizes', JSON.stringify(form.sizes.split(',').map((s) => s.trim()).filter(Boolean)));
      payload.append('colors', JSON.stringify(form.colors.split(',').map((s) => s.trim()).filter(Boolean)));
      payload.append('stock', form.stock);
      payload.append('featured', form.featured.toString());

      if (form.imageFile) {
        payload.append('image', form.imageFile);
      } else if (typeof form.image === 'string' && form.image) {
        payload.append('image', form.image);
      }

      if (editProduct) {
        await axios.put(`/api/products/${editProduct._id}`, payload, {
          headers: { ...getAdminAuthHeader(), 'Content-Type': 'multipart/form-data' },
        });
        toast.success('Product updated!');
      } else {
        await axios.post('/api/products', payload, {
          headers: { ...getAdminAuthHeader(), 'Content-Type': 'multipart/form-data' },
        });
        toast.success('Product created!');
      }
      closeModal();
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to save');
    } finally {
      setSubmitting(false);
    }
  };

  const closeModal = () => {
    if (objectUrlRef.current) { URL.revokeObjectURL(objectUrlRef.current); objectUrlRef.current = null; }
    if (fileInputRef.current) fileInputRef.current.value = '';
    setModalOpen(false);
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
                    <button type="button" className="adm-btn adm-btn-solid" onClick={() => switchTab('Products')}>
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
                    <div style={{ display: 'flex', gap: '0.6rem' }}>
                      <button type="button" className="adm-btn adm-btn-ghost" onClick={exportProductsCsv} disabled={!filteredProducts.length}><FiDownload /> Export</button>
                      <button type="button" className="adm-btn adm-btn-solid" onClick={() => openModal()}><FiPlus /> Add product</button>
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
                                <td><span className="adm-chip">{p.category || '—'}</span></td>
                                <td className="adm-money">{formatPrice(p.price)}</td>
                                <td>
                                  <span className={`adm-stock${(p.stock || 0) <= 0 ? ' out' : p.stock < 5 ? ' low' : ''}`}><i /> {p.stock ?? 0}</span>
                                </td>
                                <td>
                                  <div className="adm-row-actions">
                                    <button type="button" className="adm-mini" title="Edit" onClick={() => openModal(p)}><FiEdit2 /></button>
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
                        action={<button type="button" className="adm-btn adm-btn-solid" onClick={() => openModal()}><FiPlus /> Add product</button>}
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
            </>
          )}
        </div>
      </div>

      {/* ── Product editor ── */}
      <div className={`modal-overlay${modalOpen ? ' open' : ''}`} onClick={(e) => e.target === e.currentTarget && closeModal()}>
        <div className="modal adm-modal" role="dialog" aria-modal="true" aria-label={editProduct ? 'Edit product' : 'Add product'}>
          <div className="adm-modal-head">
            <div>
              <h2>{editProduct ? 'Edit product' : 'Add product'}</h2>
              <p>{editProduct ? `Updating “${editProduct.name}”` : 'Fill in the details to publish a new item.'}</p>
            </div>
            <button type="button" className="adm-modal-x" onClick={closeModal} aria-label="Close"><FiX /></button>
          </div>

          <form className="adm-form" onSubmit={handleSave}>
            <div className="adm-form-grid">
              <div className="adm-field span-2">
                <label htmlFor="ap-name">Product name</label>
                <input id="ap-name" name="name" type="text" value={form.name} onChange={handleFormChange} required />
              </div>
              <div className="adm-field">
                <label htmlFor="ap-category">Category</label>
                <input id="ap-category" name="category" type="text" value={form.category} onChange={handleFormChange} placeholder="e.g. Hoodies" required />
              </div>
              <div className="adm-field">
                <label htmlFor="ap-price">Price (₹)</label>
                <input id="ap-price" name="price" type="number" min="0" value={form.price} onChange={handleFormChange} required />
              </div>
              <div className="adm-field">
                <label htmlFor="ap-stock">Stock</label>
                <input id="ap-stock" name="stock" type="number" min="0" value={form.stock} onChange={handleFormChange} required />
              </div>
              <div className="adm-field">
                <label htmlFor="ap-sizes">Sizes <span className="adm-muted">(comma separated)</span></label>
                <input id="ap-sizes" name="sizes" type="text" value={form.sizes} onChange={handleFormChange} placeholder="S, M, L, XL" />
              </div>
              <div className="adm-field span-2">
                <label htmlFor="ap-colors">Colours <span className="adm-muted">(comma separated)</span></label>
                <input id="ap-colors" name="colors" type="text" value={form.colors} onChange={handleFormChange} placeholder="Black, Cream, Gold" />
              </div>

              <div className="adm-field span-2">
                <label>Product image</label>
                <div className="adm-upload">
                  {form.image
                    ? <OptimizedCloudinaryImage src={form.image} alt="Preview" className="adm-upload-preview" width="84" height="100" />
                    : <span className="adm-upload-preview adm-upload-fallback"><FiImage /></span>}
                  <div className="adm-upload-body">
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/jpeg,image/png,image/webp,image/gif"
                      onChange={handleImageFile}
                      className="adm-file-input"
                    />
                    <input
                      name="image"
                      type="text"
                      value={form.imageFile ? '' : form.image}
                      onChange={handleFormChange}
                      placeholder="…or paste an image URL"
                      disabled={Boolean(form.imageFile)}
                    />
                    {form.image && (
                      <button type="button" className="adm-btn adm-btn-ghost adm-btn-sm" onClick={clearImage} style={{ alignSelf: 'flex-start' }}><FiX /> Clear image</button>
                    )}
                  </div>
                </div>
              </div>

              <div className="adm-field span-2">
                <label htmlFor="ap-desc">Description</label>
                <textarea id="ap-desc" name="description" value={form.description} onChange={handleFormChange} rows={4} />
              </div>
            </div>

            <div className="adm-checks">
              <label className="adm-check" htmlFor="ap-featured">
                <input id="ap-featured" type="checkbox" name="featured" checked={form.featured} onChange={handleFormChange} />
                Mark as featured
              </label>
            </div>

            <div className="adm-modal-foot">
              <button type="button" className="adm-btn adm-btn-ghost" onClick={closeModal}>Cancel</button>
              <button type="submit" className="adm-btn adm-btn-solid" disabled={submitting}>
                {submitting ? 'Saving…' : editProduct ? 'Save changes' : 'Create product'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}