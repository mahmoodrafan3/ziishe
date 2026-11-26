// Configure axios globally so every import { axios } usage gets the right baseURL.
// In development Vite proxies /api -> localhost:5000, so baseURL is effectively
// relative. In production the baseURL points at the deployed Render backend.
import axios from 'axios';

export const API_URL = (import.meta.env.VITE_API_URL || 'http://localhost:5000').replace(/\/$/, '');

axios.defaults.baseURL = API_URL;
axios.defaults.withCredentials = true;
axios.defaults.headers.common['Content-Type'] = 'application/json';

// Attach the stored JWT to every request automatically.
axios.interceptors.request.use((config) => {
  // A header the caller set explicitly (the admin portal passes its own
  // token) must win. Otherwise a customer session in the same browser used to
  // replace the admin token, and every admin API call came back 403.
  const headers = config.headers;
  const existing = typeof headers?.get === 'function'
    ? headers.get('Authorization')
    : headers?.Authorization || headers?.authorization;
  if (existing) return config;

  const user = JSON.parse(localStorage.getItem('ziishe_user') || 'null');
  const admin = JSON.parse(localStorage.getItem('ziishe_admin') || 'null');
  // On the admin console prefer the admin token even when a customer is
  // signed in on the storefront in the same browser.
  const onAdminRoute = typeof window !== 'undefined' && window.location.pathname.startsWith('/admin');
  const token = (onAdminRoute ? admin?.token : user?.token) || admin?.token || user?.token;

  if (token) {
    if (typeof headers?.set === 'function') headers.set('Authorization', `Bearer ${token}`);
    else config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});
