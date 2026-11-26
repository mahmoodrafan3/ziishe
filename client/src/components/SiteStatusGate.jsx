import { useLocation } from 'react-router-dom';
import { useSiteStatus } from '../context/SiteStatusContext';
import Maintenance from '../pages/Maintenance';
import TechnicalIssue from '../pages/TechnicalIssue';

// Replaces the storefront with the admin-enabled status page. Admin routes are
// deliberately exempt so the switches can always be turned back off.
export default function SiteStatusGate({ children }) {
  const { settings } = useSiteStatus();
  const { pathname } = useLocation();

  if (pathname.startsWith('/admin')) return children;
  if (settings.maintenanceEnabled) return <Maintenance message={settings.maintenanceMessage} />;
  if (settings.issueEnabled) return <TechnicalIssue message={settings.issueMessage} />;
  return children;
}
