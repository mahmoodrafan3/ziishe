import { FiTool } from 'react-icons/fi';

// Shown across the storefront while the admin has maintenance mode switched on.
// The admin console stays reachable so the switch can always be turned back off.
export default function Maintenance({ message }) {
  return (
    <div className="status-page">
      <div className="status-card">
        <span className="status-icon" aria-hidden="true"><FiTool /></span>
        <span className="status-eyebrow">Be right back</span>
        <h1 className="status-title">
          We're doing a little<br />maintenance.
        </h1>
        <p className="status-text">
          {message || 'ZiiShe is getting some care behind the scenes. Please check back in a few minutes.'}
        </p>
        <button type="button" className="btn btn-primary" onClick={() => window.location.reload()}>
          Try again
        </button>
      </div>
      <span className="status-brand">ZiiShe</span>
    </div>
  );
}
