import { FiAlertTriangle } from 'react-icons/fi';

// Shown across the storefront while the admin has the technical-issue page
// switched on. The admin console stays reachable so the switch can be turned off.
export default function TechnicalIssue({ message }) {
  return (
    <div className="status-page">
      <div className="status-card">
        <span className="status-icon status-icon--issue" aria-hidden="true"><FiAlertTriangle /></span>
        <span className="status-eyebrow">Temporary issue</span>
        <h1 className="status-title">
          We're fixing something<br />on our side.
        </h1>
        <p className="status-text">
          {message || 'ZiiShe is having a technical issue right now. Our team is already on it — please try again shortly.'}
        </p>
        <button type="button" className="btn btn-primary" onClick={() => window.location.reload()}>
          Reload page
        </button>
      </div>
      <span className="status-brand">ZiiShe</span>
    </div>
  );
}
