const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 7;
const MIN_SESSION_SECRET_BYTES = 32;
const DEFAULT_PASSWORD = 'admin';

function getPassword() {
  return process.env.ADMIN_PASSWORD || DEFAULT_PASSWORD;
}

export function getAdminCookieName() {
  return 'admin_auth';
}

export function getSessionMaxAgeSeconds() {
  return SESSION_MAX_AGE_SECONDS;
}

export function getAdminSessionSecret() {
  const secret = process.env.ADMIN_SESSION_SECRET;
  if (secret && new TextEncoder().encode(secret).byteLength >= MIN_SESSION_SECRET_BYTES) {
    return secret;
  }

  if (process.env.NODE_ENV === 'production') {
    throw new Error('ADMIN_SESSION_SECRET must be at least 32 bytes in production');
  }

  return 'dev-admin-session-secret-minimum-32-bytes';
}

function bytesToBase64(bytes: Uint8Array) {
  if (typeof Buffer !== 'undefined') {
    return Buffer.from(bytes).toString('base64');
  }

  let binary = '';
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary);
}

function base64ToBytes(base64: string) {
  if (typeof Buffer !== 'undefined') {
    return new Uint8Array(Buffer.from(base64, 'base64'));
  }

  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

function toBase64Url(bytes: Uint8Array) {
  return bytesToBase64(bytes)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

function fromBase64Url(value: string) {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
  const padded = normalized + '='.repeat((4 - (normalized.length % 4)) % 4);
  return base64ToBytes(padded);
}

async function signPayload(payload: string) {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(getAdminSessionSecret()),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );

  const signature = await crypto.subtle.sign(
    'HMAC',
    key,
    encoder.encode(payload),
  );

  return toBase64Url(new Uint8Array(signature));
}

export async function createSessionToken() {
  const payload = toBase64Url(
    new TextEncoder().encode(
      JSON.stringify({
        exp: Date.now() + SESSION_MAX_AGE_SECONDS * 1000,
      }),
    ),
  );

  return `${payload}.${await signPayload(payload)}`;
}

export async function verifySessionToken(value: string | undefined) {
  if (!value) {
    return false;
  }

  const [payload, signature] = value.split('.');
  if (!payload || !signature) {
    return false;
  }

  if (signature !== (await signPayload(payload))) {
    return false;
  }

  try {
    const decoded = new TextDecoder().decode(fromBase64Url(payload));
    const parsed = JSON.parse(decoded) as { exp?: number };
    return typeof parsed.exp === 'number' && parsed.exp > Date.now();
  } catch {
    return false;
  }
}

export function isValidAdminPassword(password: string) {
  return password === getPassword();
}

export function isDefaultAdminPassword() {
  return getPassword() === DEFAULT_PASSWORD;
}
