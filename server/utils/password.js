// Shared password policy so registration, admin creation and seeding all
// enforce the same rules. Returns a human-readable problem string, or null
// when the password is acceptable.
const COMMON_PASSWORDS = new Set([
  'password', 'password1', 'password123', 'admin123', 'admin', 'administrator',
  'qwerty', 'qwerty123', '12345678', '123456789', '1234567890', 'letmein',
  'welcome', 'welcome1', 'iloveyou', 'changeme', 'secret123', 'ziishe123',
]);

export const passwordProblem = (password, { minLength = 8 } = {}) => {
  const value = String(password || '');
  if (!value) return 'Password is required';
  // bcrypt only hashes the first 72 bytes — reject anything longer instead of
  // silently ignoring the tail.
  if (value.length > 72) return 'Password must be at most 72 characters';
  if (value.length < minLength) {
    return `Password must be at least ${minLength} characters`;
  }
  if (!/[a-zA-Z]/.test(value) || !/[0-9]/.test(value)) {
    return 'Password must include both letters and numbers';
  }
  if (COMMON_PASSWORDS.has(value.toLowerCase())) {
    return 'That password is too common — choose something unique';
  }
  return null;
};

export const MIN_ADMIN_PASSWORD_LENGTH = 8;
