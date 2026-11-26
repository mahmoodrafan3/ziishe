import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import axios from 'axios';
import toast from 'react-hot-toast';
import { useAdminAuth } from '../context/AdminAuthContext';
import { getAdminAuthHeader } from '../utils/helpers';
import { FiArrowLeft, FiImage, FiPlus, FiX } from 'react-icons/fi';
import CategoryManager from '../components/CategoryManager';

// Gallery photos beyond the main one — must match the API's limit.
const MAX_EXTRA_PHOTOS = 6;

// Home page sections a product can be ticked for. Any combination is allowed.
const SECTION_OPTIONS = [
  { value: 'hero', label: 'Hero section' },
  { value: 'curated', label: '2nd section — Curated for Her' },
  { value: 'essentials', label: 'Last section — Wardrobe Essentials' },
];

const EMPTY_FORM = {
  code: '',
  name: '',
  description: '',
  price: '',
  mrp: '',
  offerPercent: '',
  category: '',
  image: '',
  imageFile: null,
  extras: [],
  sizes: '',
  colors: '',
  stock: '',
  featured: false,
  placements: [],
};

const toForm = (product) => {
  // Gallery photos, minus the main one (which has its own field).
  const photos = [...new Set([product.image, ...(product.images || [])].filter(Boolean))];
  const price = Number(product.price) || 0;
  const mrp = Number(product.mrp) || 0;
  return {
    code: product.code ?? '',
    name: product.name ?? '',
    description: product.description ?? '',
    price: product.price ?? '',
    mrp: product.mrp ?? '',
    offerPercent: mrp > price && price > 0
      ? String(Math.round(((mrp - price) / mrp) * 100))
      : '',
    category: product.category ?? '',
    image: product.image ?? '',
    imageFile: null,
    extras: photos.slice(1).map((url) => ({ url, file: null })),
    sizes: (product.sizes || []).join(', '),
    colors: (product.colors || []).join(', '),
    stock: product.stock ?? '',
    featured: Boolean(product.featured),
    placements: Array.isArray(product.placements) ? product.placements : [],
  };
};

// Cloudinary-aware preview image, requesting the size it is displayed at.
const PreviewImage = ({ src, alt, className, width, height }) => {
  if (!src) return null;
  let resolved = src;
  try {
    const url = new URL(src);
    if (url.hostname.includes('cloudinary.com')) {
      url.searchParams.set('w', String(width || 84));
      url.searchParams.set('h', String(height || 100));
      url.searchParams.set('c', 'fill');
      url.searchParams.set('q', 'auto');
      url.searchParams.set('dpr', 'auto');
      resolved = url.toString();
    }
  } catch { /* not an absolute URL — use it as-is */ }
  return <img src={resolved} alt={alt || ''} className={className} width={width} height={height} />;
};

export default function AdminProductEditor() {
  const { id } = useParams();
  const isEdit = Boolean(id);
  const navigate = useNavigate();
  const { admin, loading: authLoading } = useAdminAuth();

  const [form, setForm] = useState(EMPTY_FORM);
  const [loading, setLoading] = useState(isEdit);
  const [submitting, setSubmitting] = useState(false);
  const [categories, setCategories] = useState([]);
  const [categoryModalOpen, setCategoryModalOpen] = useState(false);
  const fileInputRef = useRef(null);
  const objectUrlRef = useRef(null);

  // The editable category list powers the product form's dropdown.
  useEffect(() => {
    if (!admin) return;
    let cancelled = false;
    axios.get('/api/categories')
      .then(({ data }) => {
        if (!cancelled) setCategories(Array.isArray(data) ? data : []);
      })
      .catch(() => {
        /* the select still shows this product's saved category */
      });
    return () => { cancelled = true; };
  }, [admin]);

  // Keep an existing product's category selectable even if it was removed
  // from the managed list.
  const categoryOptions = useMemo(() => {
    const names = categories.map((category) => category.name);
    if (form.category && !names.includes(form.category)) names.push(form.category);
    return names;
  }, [categories, form.category]);

  useEffect(() => {
    if (!authLoading && !admin) navigate('/admin/login', { replace: true });
  }, [admin, authLoading, navigate]);

  // Load the product being edited.
  useEffect(() => {
    if (!admin || !isEdit) return;
    let cancelled = false;
    axios.get(`/api/products/${id}`)
      .then(({ data }) => {
        if (!cancelled) setForm(toForm(data));
      })
      .catch(() => {
        toast.error('Product not found');
        navigate('/admin', { replace: true, state: { tab: 'Products' } });
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [admin, id, isEdit, navigate]);

  // Release object URLs backing image previews when they are replaced/unmounted.
  useEffect(() => () => {
    if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
  }, []);

  const handleFormChange = (e) => {
    const { name, type, checked, value } = e.target;
    setForm((prev) => {
      const next = { ...prev, [name]: type === 'checkbox' ? checked : value };
      // Keep the discount percentage in step when the prices are edited.
      if (name === 'price' || name === 'mrp') {
        const price = Number(next.price) || 0;
        const mrp = Number(next.mrp) || 0;
        next.offerPercent = mrp > price && price > 0
          ? String(Math.round(((mrp - price) / mrp) * 100))
          : '';
      }
      return next;
    });
  };

  // Typing a percentage fills MRP from the offer price, so the admin never has
  // to work out the original price by hand.
  const handleOfferPercentChange = (e) => {
    const raw = e.target.value;
    setForm((prev) => {
      const percent = Number(raw);
      const price = Number(prev.price) || 0;
      const valid = raw !== '' && Number.isFinite(percent) && percent >= 0 && percent < 100 && price > 0;
      return {
        ...prev,
        offerPercent: raw,
        mrp: valid ? String(Math.ceil(price / (1 - percent / 100))) : prev.mrp,
      };
    });
  };

  // The category dialog is shared with the Products tab. Mirror its changes in
  // this form so the dropdown and the selected category stay correct.
  const handleCategoryChange = (event) => {
    if (event?.type === 'created') {
      setCategories((prev) => [...prev, event.category].sort((a, b) => a.name.localeCompare(b.name)));
      setForm((prev) => (prev.category ? prev : { ...prev, category: event.category.name }));
    }
    if (event?.type === 'renamed') {
      setCategories((prev) => prev
        .map((category) => (category.name === event.from ? { ...category, name: event.to } : category))
        .sort((a, b) => a.name.localeCompare(b.name)));
      setForm((prev) => (prev.category === event.from ? { ...prev, category: event.to } : prev));
    }
    if (event?.type === 'deleted') {
      setCategories((prev) => prev.filter((category) => category.name !== event.name));
      setForm((prev) => (prev.category === event.name ? { ...prev, category: '' } : prev));
    }
  };

  const handlePlacementToggle = (placement) => {
    setForm((prev) => ({
      ...prev,
      placements: prev.placements.includes(placement)
        ? prev.placements.filter((item) => item !== placement)
        : [...prev.placements, placement],
    }));
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

  const handleGalleryFiles = (e) => {
    const files = Array.from(e.target.files || []);
    e.target.value = '';
    if (!files.length) return;
    const room = MAX_EXTRA_PHOTOS - form.extras.length;
    if (room <= 0) {
      toast.error(`A product can have up to ${MAX_EXTRA_PHOTOS} extra photos`);
      return;
    }
    if (files.length > room) toast.error(`Only ${room} more photo${room === 1 ? '' : 's'} can be added`);
    setForm((prev) => ({
      ...prev,
      extras: [
        ...prev.extras,
        ...files.slice(0, room).map((file) => ({ url: URL.createObjectURL(file), file })),
      ],
    }));
  };

  const removeExtra = (index) => {
    setForm((prev) => {
      const target = prev.extras[index];
      if (target?.file) URL.revokeObjectURL(target.url);
      return { ...prev, extras: prev.extras.filter((_, i) => i !== index) };
    });
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
    if (form.mrp && Number(form.mrp) < Number(form.price)) {
      toast.error('MRP must be higher than the offer price (or leave it empty)');
      return;
    }
    setSubmitting(true);
    try {
      const payload = new FormData();
      payload.append('name', form.name);
      payload.append('description', form.description);
      payload.append('price', form.price);
      payload.append('mrp', form.mrp || '0');
      payload.append('category', form.category);
      payload.append('sizes', JSON.stringify(form.sizes.split(',').map((s) => s.trim()).filter(Boolean)));
      payload.append('colors', JSON.stringify(form.colors.split(',').map((s) => s.trim()).filter(Boolean)));
      payload.append('stock', form.stock);
      payload.append('featured', form.featured.toString());
      payload.append('placements', JSON.stringify(form.placements));

      if (form.imageFile) {
        payload.append('image', form.imageFile);
      } else if (typeof form.image === 'string' && form.image) {
        payload.append('image', form.image);
      }

      // Extra photos: keep the ones already uploaded, then send new files in order.
      payload.append('images', JSON.stringify(form.extras.filter((item) => !item.file).map((item) => item.url)));
      form.extras.filter((item) => item.file).forEach((item) => payload.append('images', item.file));

      if (isEdit) {
        await axios.put(`/api/products/${id}`, payload, {
          headers: { ...getAdminAuthHeader(), 'Content-Type': 'multipart/form-data' },
        });
        toast.success('Product updated!');
      } else {
        await axios.post('/api/products', payload, {
          headers: { ...getAdminAuthHeader(), 'Content-Type': 'multipart/form-data' },
        });
        toast.success('Product created!');
      }
      navigate('/admin', { state: { tab: 'Products' } });
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to save');
      setSubmitting(false);
    }
  };

  if (authLoading || !admin) return null;

  return (
    <div className="adm-root adm-editor-root">
      <div className="adm-main">
        <header className="adm-topbar">
          <div className="adm-crumb">
            <span>Console</span>
            <strong>Products</strong>
          </div>
          <span className="adm-topbar-avatar" title={admin.name}>{admin.name?.charAt(0).toUpperCase() || 'A'}</span>
        </header>

        <div className="adm-body">
          <div className="adm-page">
            <div className="adm-head">
              <div>
                <span className="adm-eyebrow">Catalogue</span>
                <h1>{isEdit ? 'Edit product' : 'Add product'}</h1>
                <p>
                  {isEdit ? 'Update the details of this piece.' : 'Fill in the details to publish a new item.'}
                  {isEdit && form.code && <span className="adm-code adm-code-head">#{form.code}</span>}
                </p>
              </div>
              <Link to="/admin" state={{ tab: 'Products' }} className="adm-btn adm-btn-ghost">
                <FiArrowLeft /> Back to products
              </Link>
            </div>

            {loading ? (
              <div className="adm-card" style={{ marginTop: '1.75rem' }}>
                <div className="adm-skeleton"><i /><i /><i /><i /><i /><i /></div>
              </div>
            ) : (
              <div className="adm-card adm-editor-card">
                <form className="adm-form" onSubmit={handleSave}>
                  <div className="adm-form-grid">
                    <div className="adm-field span-2">
                      <label htmlFor="ap-name">Product name</label>
                      <input id="ap-name" name="name" type="text" value={form.name} onChange={handleFormChange} required />
                    </div>
                    <div className="adm-field">
                      <label htmlFor="ap-category">Category</label>
                      <select
                        id="ap-category"
                        name="category"
                        className="adm-select"
                        value={form.category}
                        onChange={handleFormChange}
                        required
                      >
                        <option value="">Select a category…</option>
                        {categoryOptions.map((name) => (
                          <option key={name} value={name}>{name}</option>
                        ))}
                      </select>
                      <span className="adm-muted">
                        Missing one? <button type="button" className="adm-inline-link" onClick={() => setCategoryModalOpen(true)}>Edit categories</button>
                      </span>
                    </div>
                    <div className="adm-field">
                      <label htmlFor="ap-price">Offer price (₹)</label>
                      <input id="ap-price" name="price" type="number" min="0" value={form.price} onChange={handleFormChange} required />
                    </div>
                    <div className="adm-field">
                      <label htmlFor="ap-mrp">MRP (₹) <span className="adm-muted">(optional, shown struck through)</span></label>
                      <input id="ap-mrp" name="mrp" type="number" min="0" value={form.mrp} onChange={handleFormChange} placeholder="Original price" />
                      {form.mrp && Number(form.mrp) > Number(form.price) && (
                        <span className="adm-muted">
                          {Math.round(((Number(form.mrp) - Number(form.price)) / Number(form.mrp)) * 100)}% off
                        </span>
                      )}
                    </div>
                    <div className="adm-field">
                      <label htmlFor="ap-offer">Offer % <span className="adm-muted">(auto-fills MRP)</span></label>
                      <input
                        id="ap-offer"
                        type="number"
                        min="0"
                        max="99"
                        step="1"
                        value={form.offerPercent}
                        onChange={handleOfferPercentChange}
                        placeholder="e.g. 30"
                      />
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
                      <label>Home page sections <span className="adm-muted">(tick every section this product should appear in)</span></label>
                      <div className="adm-checks" style={{ paddingTop: 0 }}>
                        {SECTION_OPTIONS.map(({ value, label }) => (
                          <label className="adm-check" key={value} htmlFor={`ap-placement-${value}`}>
                            <input
                              id={`ap-placement-${value}`}
                              type="checkbox"
                              checked={form.placements.includes(value)}
                              onChange={() => handlePlacementToggle(value)}
                            />
                            {label}
                          </label>
                        ))}
                      </div>
                    </div>

                    <div className="adm-field span-2">
                      <label>Product image</label>
                      <div className="adm-upload">
                        {form.image
                          ? <PreviewImage src={form.image} alt="Preview" className="adm-upload-preview" width="84" height="100" />
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
                      <label htmlFor="ap-gallery">More photos <span className="adm-muted">(up to {MAX_EXTRA_PHOTOS}, shown as thumbnails)</span></label>
                      <div className="adm-gallery">
                        {form.extras.map((item, i) => (
                          <div className="adm-gallery-item" key={item.url}>
                            <img src={item.url} alt={`Extra photo ${i + 1}`} />
                            <button
                              type="button"
                              className="adm-gallery-x"
                              onClick={() => removeExtra(i)}
                              aria-label="Remove photo"
                              title="Remove photo"
                            >
                              <FiX />
                            </button>
                          </div>
                        ))}
                        {form.extras.length < MAX_EXTRA_PHOTOS && (
                          <label className="adm-gallery-add" title="Add photos">
                            <FiPlus />
                            <input
                              id="ap-gallery"
                              type="file"
                              accept="image/jpeg,image/png,image/webp,image/gif"
                              multiple
                              onChange={handleGalleryFiles}
                              className="adm-file-hidden"
                            />
                          </label>
                        )}
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
                    <button type="button" className="adm-btn adm-btn-ghost" onClick={() => navigate('/admin', { state: { tab: 'Products' } })}>Cancel</button>
                    <button type="submit" className="adm-btn adm-btn-solid" disabled={submitting}>
                      {submitting ? 'Saving…' : isEdit ? 'Save changes' : 'Create product'}
                    </button>
                  </div>
                </form>
              </div>
            )}
          </div>
        </div>
      </div>

      <CategoryManager
        open={categoryModalOpen}
        onClose={() => setCategoryModalOpen(false)}
        onChange={handleCategoryChange}
      />
    </div>
  );
}
