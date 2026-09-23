const ITERATIONS = 100000;
const HASH_ALG = 'SHA-256';
const KEY_LENGTH = 256; // 32 bytes

function bytesToHex(bytes: Uint8Array): string {
  let hex = '';
  for (let i = 0; i < bytes.length; i++) {
    hex += bytes[i].toString(16).padStart(2, '0');
  }
  return hex;
}

function hexToBytes(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.substring(i, i + 2), 16);
  }
  return bytes;
}

/**
 * Constant-time comparison between two strings to mitigate timing attacks.
 */
export function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) {
    return false;
  }
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

/**
 * Derives a PBKDF2-SHA256 password hash using Web Crypto API.
 */
export async function hashPassword(
  password: string,
  providedSalt?: string
): Promise<{ hash: string; salt: string }> {
  const enc = new TextEncoder();
  let saltBytes: Uint8Array;
  let saltHex: string;

  if (providedSalt) {
    saltHex = providedSalt;
    saltBytes = hexToBytes(providedSalt);
  } else {
    saltBytes = crypto.getRandomValues(new Uint8Array(16));
    saltHex = bytesToHex(saltBytes);
  }

  const baseKey = await crypto.subtle.importKey(
    'raw',
    enc.encode(password),
    { name: 'PBKDF2' },
    false,
    ['deriveBits']
  );

  const derivedBits = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt: saltBytes,
      iterations: ITERATIONS,
      hash: HASH_ALG,
    },
    baseKey,
    KEY_LENGTH
  );

  const hash = bytesToHex(new Uint8Array(derivedBits));
  return { hash, salt: saltHex };
}

/**
 * Verifies a password against the stored hash and salt.
 */
export async function verifyPassword(
  password: string,
  storedHash: string,
  storedSalt: string
): Promise<boolean> {
  const { hash: computedHash } = await hashPassword(password, storedSalt);
  return timingSafeEqual(computedHash, storedHash);
}
