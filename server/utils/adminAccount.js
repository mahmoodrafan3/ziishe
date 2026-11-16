import crypto from 'crypto';
import { passwordProblem, MIN_ADMIN_PASSWORD_LENGTH } from './password.js';

// Characters that survive .env / shell / JSON handling untouched: no quotes,
// spaces, backslashes or `#`.
const LETTERS = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
const DIGITS = '23456789';
const SYMBOLS = '!@%^*-_+=?';
const CHARSET = LETTERS + DIGITS + SYMBOLS;

const pick = (charset) => charset[crypto.randomInt(charset.length)];

/** Random password that always satisfies the policy (letter + digit + symbol). */
export const generatePassword = (length = 20) => {
  const chars = [pick(LETTERS), pick(DIGITS), pick(SYMBOLS)];
  while (chars.length < length) chars.push(pick(CHARSET));
  for (let i = chars.length - 1; i > 0; i -= 1) {
    const j = crypto.randomInt(i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join('');
};

const readFlag = (argv, name) => {
  const inline = argv.find((arg) => arg.startsWith(`--${name}=`));
  if (inline) return inline.slice(name.length + 3);
  const index = argv.indexOf(`--${name}`);
  if (index !== -1 && argv[index + 1] && !argv[index + 1].startsWith('--')) {
    return argv[index + 1];
  }
  return undefined;
};

/**
 * Admin credentials are managed in MongoDB only — never read from .env.
 *
 *   --email / --admin-email       admin address (default admin@ziishe.com)
 *   --password / --admin-password plain password (min 8 chars, letters+numbers)
 *
 * With no password flag a strong one is generated and returned so the caller
 * can print it once; only its bcrypt hash is stored in MongoDB.
 */
export const resolveAdminCredentials = (argv = process.argv.slice(2)) => {
  const email = String(
    readFlag(argv, 'admin-email') ?? readFlag(argv, 'email') ?? 'admin@ziishe.com'
  ).trim().toLowerCase();

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error(`"${email}" is not a valid admin email.`);
  }

  const given = readFlag(argv, 'admin-password') ?? readFlag(argv, 'password');
  // Trim stray whitespace — a leading/trailing space in a shell flag is almost
  // always accidental and silently becomes part of the password.
  const password = given === undefined ? generatePassword() : String(given).trim();

  const problem = passwordProblem(password, { minLength: MIN_ADMIN_PASSWORD_LENGTH });
  if (problem) {
    throw new Error(
      `${problem} (admin passwords need at least ${MIN_ADMIN_PASSWORD_LENGTH} characters, letters and numbers).`
    );
  }

  return { email, password, generated: given === undefined };
};
