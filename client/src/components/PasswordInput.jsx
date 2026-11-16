import { useId, useState } from 'react';
import { FiEye, FiEyeOff } from 'react-icons/fi';

/**
 * Password input with a show/hide toggle.
 *
 * Wraps the <input> in a positioned container so the existing
 * `.form-group input` / `.admin-login-field input` styles keep applying,
 * while the eye button sits inside the field on the right.
 */
export default function PasswordInput({
  id,
  value,
  onChange,
  placeholder,
  required = false,
  autoComplete = 'current-password',
}) {
  const [visible, setVisible] = useState(false);
  const generatedId = useId();
  const inputId = id || generatedId;

  return (
    <div className="password-field">
      <input
        id={inputId}
        type={visible ? 'text' : 'password'}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        required={required}
        autoComplete={autoComplete}
      />
      <button
        type="button"
        className="password-toggle"
        onClick={() => setVisible((v) => !v)}
        aria-label={visible ? 'Hide password' : 'Show password'}
        aria-pressed={visible}
        aria-controls={inputId}
        title={visible ? 'Hide password' : 'Show password'}
      >
        {visible ? <FiEyeOff aria-hidden="true" /> : <FiEye aria-hidden="true" />}
      </button>
    </div>
  );
}
