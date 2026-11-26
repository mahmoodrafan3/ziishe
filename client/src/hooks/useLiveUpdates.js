import { useEffect, useRef } from 'react';
import { API_URL } from '../utils/api';

// One shared EventSource per browser tab. Pages subscribe with a refetch
// callback, so an admin edit reaches every open storefront without a reload.
const listeners = new Set();
let source = null;
let reconnectTimer = null;

const ensureConnection = () => {
  if (source || typeof window === 'undefined' || typeof EventSource === 'undefined') return;

  // Same backend axios talks to — in production that is the Render API, not
  // the Vercel origin, so the stream must not use a relative path.
  source = new EventSource(`${API_URL}/api/products/events`);

  // Hand every subscriber the event type and its JSON payload, so a page can
  // tell a brand-new order apart from a status edit.
  const notify = (type) => (event) => {
    let data = {};
    if (event?.data) {
      try {
        data = JSON.parse(event.data);
      } catch {
        data = {};
      }
    }
    listeners.forEach((fn) => fn({ type, ...data }));
  };
  source.addEventListener('products', notify('products'));
  source.addEventListener('orders', notify('orders'));
  source.addEventListener('settings', notify('settings'));
  source.addEventListener('categories', notify('categories'));

  source.onerror = () => {
    // EventSource retries on its own; only re-create it if it gave up for good.
    if (source && source.readyState === EventSource.CLOSED) {
      source = null;
      if (!reconnectTimer) {
        reconnectTimer = window.setTimeout(() => {
          reconnectTimer = null;
          if (listeners.size) ensureConnection();
        }, 5000);
      }
    }
  };
};

/**
 * Call `onUpdate(event)` whenever the admin changes the catalogue, an order or
 * the store settings. The connection stays open while the tab is alive, so
 * navigating between pages never re-opens it.
 */
export default function useLiveUpdates(onUpdate) {
  const callback = useRef(onUpdate);
  callback.current = onUpdate;

  useEffect(() => {
    const handler = (event) => callback.current?.(event);
    listeners.add(handler);
    ensureConnection();
    return () => { listeners.delete(handler); };
  }, []);
}
