import { describe, it, expect } from 'vitest';
import {
  base32Encode,
  base32Decode,
  generateTotpSecret,
  generateTotp,
  verifyTotp,
  generateTotpUri,
} from '../src/crypto/totp';

describe('TOTP and Base32 Web Crypto Tests', () => {
  describe('Base32 encoding and decoding', () => {
    it('encodes and decodes ascii strings correctly', () => {
      const text = 'Hello, World!';
      const bytes = new TextEncoder().encode(text);
      const encoded = base32Encode(bytes);

      expect(typeof encoded).toBe('string');
      expect(encoded.length).toBeGreaterThan(0);

      const decodedBytes = base32Decode(encoded);
      const decodedText = new TextDecoder().decode(decodedBytes);
      expect(decodedText).toBe(text);
    });

    it('handles case-insensitivity, whitespace, and hyphens in decoding', () => {
      const bytes = new Uint8Array([1, 2, 3, 4, 5]);
      const encoded = base32Encode(bytes);

      const messy = `  ${encoded.toLowerCase().slice(0, 4)}-${encoded.slice(4)}  `;
      const decoded = base32Decode(messy);
      expect(decoded).toEqual(bytes);
    });

    it('generates a 32-character Base32 secret for 20 bytes', () => {
      const secret = generateTotpSecret(20);
      expect(typeof secret).toBe('string');
      expect(secret.length).toBe(32);
      expect(/^[A-Z2-7]+$/.test(secret)).toBe(true);
    });
  });

  describe('TOTP generation and verification', () => {
    const testSecret = 'JBSWY3DPEHPK3PXP'; // Base32 for "Hello!\xde\xad\xbe\xef"

    it('generates a 6-digit numeric string', async () => {
      const code = await generateTotp(testSecret);
      expect(code).toMatch(/^\d{6}$/);
    });

    it('generates consistent code for the same time window', async () => {
      const windowStart = Math.floor(1700000000 / 30) * 30;
      const code1 = await generateTotp(testSecret, windowStart + 2);
      const code2 = await generateTotp(testSecret, windowStart + 15);
      expect(code1).toBe(code2);
    });

    it('verifies code successfully within the current time window', async () => {
      const time = 1700000000;
      const code = await generateTotp(testSecret, time);
      const valid = await verifyTotp(testSecret, code, { timestampSeconds: time });
      expect(valid).toBe(true);
    });

    it('verifies code within drift window (+/- 30s)', async () => {
      const time = 1700000000;
      const codePast = await generateTotp(testSecret, time - 30);
      const codeFuture = await generateTotp(testSecret, time + 30);

      // Default window = 1 allows +/- 30s
      expect(await verifyTotp(testSecret, codePast, { timestampSeconds: time })).toBe(true);
      expect(await verifyTotp(testSecret, codeFuture, { timestampSeconds: time })).toBe(true);

      // Out of window (60s) should fail
      const codeTooOld = await generateTotp(testSecret, time - 60);
      expect(await verifyTotp(testSecret, codeTooOld, { timestampSeconds: time })).toBe(false);
    });

    it('rejects invalid code format or wrong code', async () => {
      const time = 1700000000;
      expect(await verifyTotp(testSecret, '12345', { timestampSeconds: time })).toBe(false);
      expect(await verifyTotp(testSecret, 'abcdef', { timestampSeconds: time })).toBe(false);
      expect(await verifyTotp(testSecret, '000000', { timestampSeconds: time })).toBe(false);
    });
  });

  describe('TOTP URI generator', () => {
    it('generates valid otpauth URL with escaped parameters', () => {
      const uri = generateTotpUri('alice_tester', 'JBSWY3DPEHPK3PXP', 'My Auth');
      expect(uri).toBe(
        'otpauth://totp/My%20Auth:alice_tester?secret=JBSWY3DPEHPK3PXP&issuer=My%20Auth&algorithm=SHA1&digits=6&period=30'
      );
    });
  });
});
