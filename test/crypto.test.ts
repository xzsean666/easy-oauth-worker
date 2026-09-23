import { describe, it, expect } from 'vitest';
import { hashPassword, verifyPassword, timingSafeEqual } from '../src/crypto/password';
import {
  generateRandomBytes,
  generateRandomToken,
  generateId,
  base64UrlEncode,
  base64UrlDecode,
} from '../src/crypto/token';
import {
  generateCodeChallenge,
  verifyCodeChallenge,
  isValidCodeVerifier,
} from '../src/crypto/pkce';
import {
  generateRsaKeyPair,
  exportJwk,
  importPrivateKey,
  importPublicKey,
  signJwt,
  verifyJwt,
  decodeJwt,
  buildJwks,
} from '../src/crypto/jwt';

describe('Password Hashing (PBKDF2-SHA256)', () => {
  it('hashes password with random salt and verifies successfully', async () => {
    const password = 'SuperSecretPassword!@#123';
    const { hash, salt } = await hashPassword(password);

    expect(hash).toBeDefined();
    expect(hash.length).toBe(64); // 256 bits = 32 bytes = 64 hex chars
    expect(salt).toBeDefined();
    expect(salt.length).toBe(32); // 16 bytes = 32 hex chars

    const isValid = await verifyPassword(password, hash, salt);
    expect(isValid).toBe(true);
  });

  it('fails verification with incorrect password', async () => {
    const password = 'CorrectPassword';
    const { hash, salt } = await hashPassword(password);

    const isValid = await verifyPassword('WrongPassword', hash, salt);
    expect(isValid).toBe(false);
  });

  it('generates distinct salts and hashes for identical passwords', async () => {
    const pwd = 'samePassword';
    const first = await hashPassword(pwd);
    const second = await hashPassword(pwd);

    expect(first.salt).not.toBe(second.salt);
    expect(first.hash).not.toBe(second.hash);
  });

  it('performs timing safe equality correctly', () => {
    expect(timingSafeEqual('abcdef', 'abcdef')).toBe(true);
    expect(timingSafeEqual('abcdef', 'abcdeg')).toBe(false);
    expect(timingSafeEqual('abcdef', 'abcde')).toBe(false);
  });
});

describe('Token Generation and Base64URL Utilities', () => {
  it('generates random bytes of requested length', () => {
    const bytes16 = generateRandomBytes(16);
    expect(bytes16.length).toBe(16);
    const bytes32 = generateRandomBytes(32);
    expect(bytes32.length).toBe(32);
  });

  it('generates random tokens and prefixed IDs', () => {
    const token = generateRandomToken(32);
    expect(typeof token).toBe('string');
    expect(token.length).toBeGreaterThan(30);

    const userId = generateId('usr');
    expect(userId.startsWith('usr_')).toBe(true);
  });

  it('encodes and decodes base64url without padding or illegal chars', () => {
    const sample = new Uint8Array([0, 15, 255, 128, 64, 32, 16]);
    const encoded = base64UrlEncode(sample);
    expect(encoded).not.toContain('+');
    expect(encoded).not.toContain('/');
    expect(encoded).not.toContain('=');

    const decoded = base64UrlDecode(encoded);
    expect(Array.from(decoded)).toEqual(Array.from(sample));
  });
});

describe('PKCE S256 Challenge Verification', () => {
  // RFC 7636 Appendix B test vector
  const rfcVerifier = 'dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk';
  const rfcExpectedChallenge = 'E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM';

  it('matches RFC 7636 Appendix B test vector', async () => {
    const challenge = await generateCodeChallenge(rfcVerifier);
    expect(challenge).toBe(rfcExpectedChallenge);

    const verified = await verifyCodeChallenge(rfcVerifier, rfcExpectedChallenge, 'S256');
    expect(verified).toBe(true);
  });

  it('rejects invalid verifier or mismatched challenge', async () => {
    const isMismatch = await verifyCodeChallenge('wrong_verifier_123456789012345678901234567890123', rfcExpectedChallenge, 'S256');
    expect(isMismatch).toBe(false);

    // Unsupported method (e.g. 'plain') must be rejected
    const isPlainRejected = await verifyCodeChallenge(rfcVerifier, rfcExpectedChallenge, 'plain');
    expect(isPlainRejected).toBe(false);
  });

  it('validates verifier characters and length', () => {
    expect(isValidCodeVerifier(rfcVerifier)).toBe(true);
    // Too short (< 43)
    expect(isValidCodeVerifier('short_verifier')).toBe(false);
    // Invalid characters (e.g., spaces or non-URL-safe characters)
    expect(isValidCodeVerifier('invalid*verifier*character*with*length*exceeding*43*chars!@#')).toBe(false);
  });
});

describe('RS256 JWT Signing, Verification and JWKS', () => {
  it('generates key pair, signs JWT, and verifies successfully', async () => {
    const keyPair = await generateRsaKeyPair();
    const kid = 'test-key-2024';
    const publicJwk = await exportJwk(keyPair.publicKey, kid);
    const privateJwk = await exportJwk(keyPair.privateKey, kid);

    expect(publicJwk.kty).toBe('RSA');
    expect(publicJwk.alg).toBe('RS256');
    expect(publicJwk.kid).toBe(kid);

    const now = Math.floor(Date.now() / 1000);
    const payload = {
      iss: 'https://auth.example.com',
      sub: 'usr_abc123',
      aud: 'client_xyz',
      email: 'user@example.com',
      iat: now,
      exp: now + 3600,
    };

    const token = await signJwt(payload, keyPair.privateKey, kid);
    expect(typeof token).toBe('string');
    expect(token.split('.').length).toBe(3);

    // Decode without verify
    const decoded = decodeJwt(token);
    expect(decoded.header.alg).toBe('RS256');
    expect(decoded.header.kid).toBe(kid);
    expect(decoded.payload.sub).toBe('usr_abc123');

    // Verify with imported public key
    const importedPub = await importPublicKey(publicJwk);
    const verifiedPayload = await verifyJwt(token, importedPub);
    expect(verifiedPayload.sub).toBe('usr_abc123');
    expect(verifiedPayload.email).toBe('user@example.com');
  });

  it('rejects tampered JWT signature', async () => {
    const keyPair = await generateRsaKeyPair();
    const kid = 'test-key-tamper';
    const token = await signJwt({ sub: 'usr_valid' }, keyPair.privateKey, kid);

    // Tamper with payload
    const parts = token.split('.');
    const tamperedPayload = base64UrlEncode(new TextEncoder().encode(JSON.stringify({ sub: 'usr_hacked' })));
    const tamperedToken = `${parts[0]}.${tamperedPayload}.${parts[2]}`;

    await expect(verifyJwt(tamperedToken, keyPair.publicKey)).rejects.toThrow('Invalid JWT signature');
  });

  it('rejects expired JWT token', async () => {
    const keyPair = await generateRsaKeyPair();
    const kid = 'test-key-exp';
    const expiredPayload = {
      sub: 'usr_expired',
      exp: Math.floor(Date.now() / 1000) - 60, // expired 1 minute ago
    };

    const token = await signJwt(expiredPayload, keyPair.privateKey, kid);
    await expect(verifyJwt(token, keyPair.publicKey)).rejects.toThrow('JWT has expired');
  });

  it('exports RFC 7517 compliant JWKS structure', async () => {
    const keyPair = await generateRsaKeyPair();
    const kid = 'key-oidc-1';
    const publicJwk = await exportJwk(keyPair.publicKey, kid);
    const jwks = buildJwks(publicJwk);

    expect(jwks).toHaveProperty('keys');
    expect(Array.isArray(jwks.keys)).toBe(true);
    expect(jwks.keys.length).toBe(1);

    const key = jwks.keys[0];
    expect(key.kty).toBe('RSA');
    expect(key.use).toBe('sig');
    expect(key.alg).toBe('RS256');
    expect(key.kid).toBe(kid);
    expect(key.n).toBeDefined();
    expect(key.e).toBeDefined();
    // Sensitive private exponent 'd' must NOT be in public JWKS
    expect((key as unknown as Record<string, unknown>).d).toBeUndefined();
  });
});
