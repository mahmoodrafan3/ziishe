import { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';
import { getAdminAuthHeader, formatPrice } from '../utils/helpers';
import { FiCheck, FiSearch, FiX } from 'react-icons/fi';

const EMPTY = {
  code: '',
  type: 'percent',
  value: '',
  scope: 'all',
  products: [],
  categories: [],
  minSubtotal: '',
  description: '',
  active: true,
  expiresAt: '',
};

const toDateInput = (value) => {
  if (!value) return '';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '' : date.toISOString().slice(0, 10);
};

// Create/edit dialog for discount coupons. `coupon` is null for a new one and
// the saved coupon document when editing.
export default function CouponEditor({ open, coupon, products, categories, onClose, onSaved }) {
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const [productQuery, setProductQuery] = useState('');

  useEffect(() => {
    if (!open) return;
    setProductQuery('');
    setForm(coupon
      ? {
          code: coupon.code || '',
          type: coupon.type || 'percent',
          value: String(coupon.value ?? ''),
          scope: coupon.scope || 'all',
          products: (coupon.products || []).map(String),
          categories: coupon.categories || [],
          minSubtotal: coupon.minSubtotal ? String(coupon.minSubtotal) : '',
          description: coupon.description || '',
          active: coupon.active !== false,
          expiresAt: toDateInput(coupon.expiresAt),
        }
      : EMPTY);
  }, [open, coupon]);

  const filteredProducts = useMemo(() => {
    const q = productQuery.trim().toLowerCase();
    if (!q) return products;
    return products.filter((p) => `${p.name} ${p.category}`.toLowerCase().includes(q));
  }, [products, productQuery]);

  if (!open) return null;

  const change = (e) => {
    const { name, value, type, checked } = e.target;
    setForm((prev) => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
  };

  const toggleProduct = (id) =>
    setForm((prev) => ({
      ...prev,
      products: prev.products.includes(id)
        ? prev.products.filter((item) => item !== id)
        : [...prev.products, id],
    }));

  const toggleCategory = (name) =>
    setForm((prev) => ({
      ...prev,
      categories: prev.categories.includes(name)
        ? prev.categories.filter((item) => item !== name)
        : [...prev.categories, name],
    }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.code.trim()) { toast.error('Enter a coupon code'); return; }
    if (!(Number(form.value) > 0)) { toast.error('Enter a discount value'); return; }
    if (form.scope === 'products' && form.products.length === 0) {
      toast.error('Pick at least one product'); return;
    }
    if (form.scope === 'categories' && form.categories.length === 0) {
      toast.error('Pick at least one category'); return;
    }

    setSaving(true);
    try {
      const payload = {
        code: form.code,
        type: form.type,
        value: Number(form.value),
        scope: form.scope,
        products: form.scope === 'products' ? form.products : [],
        categories: form.scope === 'categories' ? form.categories : [],
        minSubtotal: Number(form.minSubtotal) || 0,
        description: form.description,
        active: form.active,
        expiresAt: form.expiresAt || null,
      };
      const { data } = coupon
        ? await axios.put(`/api/coupons/${coupon._id}`, payload, { headers: getAdminAuthHeader() })
        : await axios.post('/api/coupons', payload, { headers: getAdminAuthHeader() });
      toast.success(coupon ? 'Coupon updated' : `Coupon ${data.code} created`);
      onSaved?.(data);
      onClose?.();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not save this coupon');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-overlay open" role="presentation" onClick={onClose}>
      <div
        className="modal adm-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="ap-coupon-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="adm-modal-head">
          <div>
            <h2 id="ap-coupon-title">{coupon ? 'Edit coupon' : 'New coupon'}</h2>
            <p>Set the discount and choose whether it covers the whole cart, certain products or a category.</p>
          </div>
          <button type="button" className="adm-modal-x" onClick={onClose} aria-label="Close coupon form">
            <FiX />
          </button>
        </div>

        <form className="adm-form" onSubmit={handleSubmit}>
          <div className="adm-form-grid">
            <div className="adm-field">
              <label htmlFor="cp-code">Coupon code</label>
              <input
                id="cp-code"
                name="code"
                type="text"
                value={form.code}
                onChange={(e) => setForm((prev) => ({ ...prev, code: e.target.value.toUpperCase() }))}
                placeholder="e.g. BLAZER20"
                maxLength={24}
                required
              />
            </div>
            <div className="adm-field">
              <label htmlFor="cp-expiry">Expires on <span className="adm-muted">(optional)</span></label>
              <input id="cp-expiry" name="expiresAt" type="date" value={form.expiresAt} onChange={change} />
            </div>

            <div className="adm-field">
              <label htmlFor="cp-type">Discount type</label>
              <select id="cp-type" name="type" className="adm-select" value={form.type} onChange={change}>
                <option value="percent">Percentage (%)</option>
                <option value="fixed">Flat amount (₹)</option>
              </select>
            </div>
            <div className="adm-field">
              <label htmlFor="cp-value">{form.type === 'percent' ? 'Discount (%)' : 'Discount (₹)'}</label>
              <input
                id="cp-value"
                name="value"
                type="number"
                min="1"
                max={form.type === 'percent' ? 100 : undefined}
                step={form.type === 'percent' ? 1 : 1}
                value={form.value}
                onChange={change}
                placeholder={form.type === 'percent' ? '20' : '200'}
                required
              />
            </div>

            <div className="adm-field span-2">
              <label htmlFor="cp-scope">Applies to</label>
              <select id="cp-scope" name="scope" className="adm-select" value={form.scope} onChange={change}>
                <option value="all">Whole cart</option>
                <option value="products">Specific products</option>
                <option value="categories">A category</option>
              </select>
            </div>

            {form.scope === 'products' && (
              <div className="adm-field span-2">
                <label>Choose products <span className="adm-muted">({form.products.length} selected)</span></label>
                <label className="adm-search coupon-picker-search">
                  <FiSearch aria-hidden="true" />
                  <input
                    type="search"
                    value={productQuery}
                    onChange={(e) => setProductQuery(e.target.value)}
                    placeholder="Search products…"
                  />
                </label>
                <div className="coupon-picker">
                  {filteredProducts.length ? filteredProducts.map((product) => (
                    <label key={product._id} className="coupon-picker-row">
                      <input
                        type="checkbox"
                        checked={form.products.includes(String(product._id))}
                        onChange={() => toggleProduct(String(product._id))}
                      />
                      <span className="coupon-picker-name">{product.name}</span>
                      <span className="coupon-picker-meta">{product.category} · {formatPrice(product.price)}</span>
                    </label>
                  )) : <p className="coupon-picker-empty">No products match that search.</p>}
                </div>
              </div>
            )}

            {form.scope === 'categories' && (
              <div className="adm-field span-2">
                <label>Choose categories <span className="adm-muted">({form.categories.length} selected)</span></label>
                <div className="coupon-chips">
                  {categories.length ? categories.map((name) => {
                    const on = form.categories.includes(name);
                    return (
                      <button
                        key={name}
                        type="button"
                        className={`coupon-chip${on ? ' on' : ''}`}
                        onClick={() => toggleCategory(name)}
                        aria-pressed={on}
                      >
                        {on && <FiCheck aria-hidden="true" />} {name}
                      </button>
                    );
                  }) : <p className="coupon-picker-empty">No categories yet.</p>}
                </div>
              </div>
            )}

            <div className="adm-field">
              <label htmlFor="cp-min">Minimum order value (₹) <span className="adm-muted">(optional)</span></label>
              <input
                id="cp-min"
                name="minSubtotal"
                type="number"
                min="0"
                value={form.minSubtotal}
                onChange={change}
                placeholder="0"
              />
            </div>
            <div className="adm-field">
              <label htmlFor="cp-desc">Description <span className="adm-muted">(shown at checkout)</span></label>
              <input
                id="cp-desc"
                name="description"
                type="text"
                value={form.description}
                onChange={change}
                maxLength={160}
                placeholder="20% off blazers"
              />
            </div>
          </div>

          <div className="adm-checks">
            <label className="adm-check" htmlFor="cp-active">
              <input id="cp-active" type="checkbox" name="active" checked={form.active} onChange={change} />
              Coupon is active
            </label>
          </div>

          <div className="adm-modal-foot">
            <button type="button" className="adm-btn adm-btn-ghost" onClick={onClose}>Cancel</button>
            <button type="submit" className="adm-btn adm-btn-solid" disabled={saving}>
              {saving ? 'Saving…' : coupon ? 'Save changes' : 'Create coupon'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
