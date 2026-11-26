import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import axios from 'axios';
import useLiveUpdates from '../hooks/useLiveUpdates';

const DEFAULT_SETTINGS = {
  maintenanceEnabled: false,
  maintenanceMessage: '',
  issueEnabled: false,
  issueMessage: '',
};

const SiteStatusContext = createContext({
  settings: DEFAULT_SETTINGS,
  loading: true,
  refresh: () => {},
});

// Reads the admin-controlled storefront switches once and keeps them in sync
// over the live connection, so flipping maintenance mode takes effect on every
// open storefront tab.
export function SiteStatusProvider({ children }) {
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const { data } = await axios.get('/api/settings');
      setSettings({ ...DEFAULT_SETTINGS, ...data });
    } catch {
      // A settings hiccup must never take the storefront down — fall back to
      // the normal site.
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  useLiveUpdates((event) => {
    if (event?.type === 'settings') refresh();
  });

  return (
    <SiteStatusContext.Provider value={{ settings, loading, refresh }}>
      {children}
    </SiteStatusContext.Provider>
  );
}

export const useSiteStatus = () => useContext(SiteStatusContext);
