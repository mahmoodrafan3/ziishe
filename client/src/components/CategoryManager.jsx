import { useEffect, useState } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';
import { getAdminAuthHeader } from '../utils/helpers';
import { FiCheck, FiPlus, FiTrash2, FiX } from 'react-icons/fi';

// Shared add/rename/delete dialog for catalogue categories. Opened from the
// admin Products tab and from the product form's category field.
//
// `onChange` is optional and receives:
//   { type: 'created', category: { _id, name } }
//   { type: 'renamed', from, to }
//   { type: 'deleted', name }
export default function CategoryManager({ open, onClose, onChange }) {
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(false);
  const [drafts, setDrafts] = useState({});
  const [newCategory, setNewCategory] = useState('');
  const [adding, setAdding] = useState(false);
  const [savingId, setSavingId] = useState(null);
  const [deletingId, setDeletingId] = useState(null);

  // Reload each time the dialog opens so it always shows the current list.
  useEffect(() => {
    if (!open) return undefined;
    let cancelled = false;
    setLoading(true);
    setNewCategory('');
    axios.get('/api/categories')
      .then(({ data }) => {
        if (cancelled) return;
        const list = Array.isArray(data) ? data : [];
        setCategories(list);
        setDrafts(Object.fromEntries(list.map((category) => [category._id, category.name])));
      })
      .catch(() => {
        if (!cancelled) toast.error('Could not load categories');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [open]);

  if (!open) return null;

  const sortCategories = (list) => [...list].sort((a, b) => a.name.localeCompare(b.name));

  const handleAdd = async (e) => {
    e.preventDefault();
    const name = newCategory.trim();
    if (!name) return;
    setAdding(true);
    try {
      const { data } = await axios.post(
        '/api/categories',
        { name },
        { headers: getAdminAuthHeader() },
      );
      const created = { _id: data._id, name: data.name };
      setCategories((prev) => sortCategories([...prev, created]));
      setDrafts((prev) => ({ ...prev, [data._id]: data.name }));
      setNewCategory('');
      onChange?.({ type: 'created', category: created });
      toast.success(`Category “${data.name}” added`);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to add category');
    } finally {
      setAdding(false);
    }
  };

  const handleRename = async (category) => {
    const name = (drafts[category._id] || '').trim();
    if (!name || name === category.name) return;
    setSavingId(category._id);
    try {
      const { data } = await axios.put(
        `/api/categories/${category._id}`,
        { name },
        { headers: getAdminAuthHeader() },
      );
      setCategories((prev) => sortCategories(
        prev.map((item) => (item._id === category._id ? { _id: data._id, name: data.name } : item)),
      ));
      setDrafts((prev) => ({ ...prev, [data._id]: data.name }));
      onChange?.({ type: 'renamed', from: category.name, to: data.name });
      toast.success('Category renamed');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to rename category');
    } finally {
      setSavingId(null);
    }
  };

  const handleDelete = async (category) => {
    if (!window.confirm(`Delete the “${category.name}” category?`)) return;
    setDeletingId(category._id);
    try {
      await axios.delete(`/api/categories/${category._id}`, { headers: getAdminAuthHeader() });
      setCategories((prev) => prev.filter((item) => item._id !== category._id));
      onChange?.({ type: 'deleted', name: category.name });
      toast.success('Category removed');
    } catch (err) {
      // Categories still used by products are protected by the API.
      toast.error(err.response?.data?.message || 'Failed to remove category');
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div
      className="modal-overlay open"
      role="presentation"
      onClick={onClose}
    >
      <div
        className="modal adm-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="ap-categories-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="adm-modal-head">
          <div>
            <h2 id="ap-categories-title">Categories</h2>
            <p>Add, rename or remove categories. Renaming one updates every product in it.</p>
          </div>
          <button
            type="button"
            className="adm-modal-x"
            onClick={onClose}
            aria-label="Close categories"
          >
            <FiX />
          </button>
        </div>

        <div className="adm-cat-body">
          <form className="adm-cat-add" onSubmit={handleAdd}>
            <input
              type="text"
              value={newCategory}
              onChange={(e) => setNewCategory(e.target.value)}
              placeholder="New category name"
              maxLength={40}
              aria-label="New category name"
            />
            <button
              type="submit"
              className="adm-btn adm-btn-solid adm-btn-sm"
              disabled={adding || !newCategory.trim()}
            >
              <FiPlus /> {adding ? 'Adding…' : 'Add'}
            </button>
          </form>

          {loading ? (
            <div className="adm-skeleton"><i /><i /><i /></div>
          ) : categories.length ? (
            <ul className="adm-cat-list">
              {categories.map((category) => {
                const draft = drafts[category._id] ?? category.name;
                const changed = draft.trim() !== '' && draft.trim() !== category.name;
                return (
                  <li key={category._id} className="adm-cat-row">
                    <input
                      type="text"
                      value={draft}
                      maxLength={40}
                      onChange={(e) => setDrafts((prev) => ({
                        ...prev,
                        [category._id]: e.target.value,
                      }))}
                      aria-label={`Rename ${category.name}`}
                    />
                    <button
                      type="button"
                      className="adm-mini"
                      title="Save name"
                      disabled={!changed || savingId === category._id}
                      onClick={() => handleRename(category)}
                    >
                      <FiCheck />
                    </button>
                    <button
                      type="button"
                      className="adm-mini danger"
                      title="Delete category"
                      disabled={deletingId === category._id}
                      onClick={() => handleDelete(category)}
                    >
                      <FiTrash2 />
                    </button>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="adm-cat-empty">No categories yet. Add the first one above.</p>
          )}
        </div>

        <div className="adm-modal-foot">
          <button type="button" className="adm-btn adm-btn-ghost" onClick={onClose}>
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
