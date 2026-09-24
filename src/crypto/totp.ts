/**
 * RFC 6238 Time-Based One-Time Password (TOTP) and Base32 implementation
 * using standard native Web Crypto API (compatible with Cloudflare Workers).
 */

const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

/**
 * Encodes a Uint8Array into a Base32 string (RFC 4648, uppercase, unpadded).
 */
export function base32Encode(buffer: Uint8Array): string {
  let bits = 0;
  let value = 0;
  let output = '';

  for (let i = 0; i < buffer.length; i++) {
    value = (value << 8) | buffer[i];
    bits += 8;

    while (bits >= 5) {
      output += BASE32_ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }

  if (bits > 0) {
    output += BASE32_ALPHABET[(value << (5 - bits)) & 31];
  }

  return output;
}

/**
 * Decodes a Base32 string into a Uint8Array.
 * Case-insensitive, ignores spaces and dashes.
 */
export function base32Decode(input: string): Uint8Array {
  const sanitized = input.toUpperCase().replace(/[\s-]/g, '').replace(/=+$/, '');
  const bytes: number[] = [];
  let bits = 0;
  let value = 0;

  for (let i = 0; i < sanitized.length; i++) {
    const idx = BASE32_ALPHABET.indexOf(sanitized[i]);
    if (idx === -1) {
      throw new Error(`Invalid base32 character: ${sanitized[i]}`);
    }

    value = (value << 5) | idx;
    bits += 5;

    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }

  return new Uint8Array(bytes);
}

/**
 * Generates a random Base32 TOTP secret key (default 20 bytes = 160 bits).
 */
export function generateTotpSecret(byteLength = 20): string {
  const bytes = new Uint8Array(byteLength);
  crypto.getRandomValues(bytes);
  return base32Encode(bytes);
}

/**
 * Computes an HMAC-SHA1 value using native Web Crypto API.
 */
async function hmacSha1(keyBytes: Uint8Array, messageBytes: Uint8Array): Promise<Uint8Array> {
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    keyBytes,
    { name: 'HMAC', hash: 'SHA-1' },
    false,
    ['sign']
  );

  const signature = await crypto.subtle.sign('HMAC', cryptoKey, messageBytes);
  return new Uint8Array(signature);
}

/**
 * Generates a 6-digit TOTP code for a given timestamp and secret.
 * Default period is 30 seconds.
 */
export async function generateTotp(
  secret: string,
  timestampSeconds: number = Math.floor(Date.now() / 1000),
  periodSeconds = 30
): Promise<string> {
  const keyBytes = base32Decode(secret);
  const counter = Math.floor(timestampSeconds / periodSeconds);

  // Convert 64-bit integer counter to 8-byte big-endian array
  const counterBuffer = new Uint8Array(8);
  let temp = counter;
  for (let i = 7; i >= 0; i--) {
    counterBuffer[i] = temp & 0xff;
    temp = Math.floor(temp / 256);
  }

  const hmac = await hmacSha1(keyBytes, counterBuffer);

  // Dynamic truncation (RFC 4226 section 5.4)
  const offset = hmac[hmac.length - 1] & 0x0f;
  const binary =
    ((hmac[offset] & 0x7f) << 24) |
    ((hmac[offset + 1] & 0xff) << 16) |
    ((hmac[offset + 2] & 0xff) << 8) |
    (hmac[offset + 3] & 0xff);

  const otp = binary % 1_000_000;
  return otp.toString().padStart(6, '0');
}

/**
 * Verifies a 6-digit TOTP code against a secret with time-drift tolerance.
 * Window = 1 means checking [now - 30s, now, now + 30s].
 */
export async function verifyTotp(
  secret: string,
  code: string,
  options?: {
    timestampSeconds?: number;
    periodSeconds?: number;
    window?: number;
  }
): Promise<boolean> {
  const trimmed = (code || '').trim().replace(/\s/g, '');
  if (!/^\d{6}$/.test(trimmed)) {
    return false;
  }

  const timestamp = options?.timestampSeconds ?? Math.floor(Date.now() / 1000);
  const period = options?.periodSeconds ?? 30;
  const window = options?.window ?? 1;

  for (let offset = -window; offset <= window; offset++) {
    const testTime = timestamp + offset * period;
    const generated = await generateTotp(secret, testTime, period);
    if (generated === trimmed) {
      return true;
    }
  }

  return false;
}

/**
 * Generates an otpauth:// URI for importing into Google Authenticator or other apps.
 */
export function generateTotpUri(
  accountName: string,
  secret: string,
  issuer: string = 'EasyOAuth'
): string {
  const encIssuer = encodeURIComponent(issuer.trim());
  const encAccount = encodeURIComponent(accountName.trim());
  return `otpauth://totp/${encIssuer}:${encAccount}?secret=${secret}&issuer=${encIssuer}&algorithm=SHA1&digits=6&period=30`;
}
