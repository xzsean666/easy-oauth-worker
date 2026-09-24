import { describe, it, expect } from 'vitest';
import { generateQrCodeSvg } from '../src/crypto/qr';

describe('QR Code SVG Generation Service', () => {
  it('throws an error if content is empty', () => {
    expect(() => generateQrCodeSvg('')).toThrow('QR code content cannot be empty');
  });

  it('generates a valid standalone SVG string for OTPAuth URI', () => {
    const uri = 'otpauth://totp/EasyOAuth:alice?secret=JBSWY3DPEHPK3PXP&issuer=EasyOAuth';
    const svg = generateQrCodeSvg(uri);

    expect(typeof svg).toBe('string');
    expect(svg.startsWith('<svg')).toBe(true);
    expect(svg.endsWith('</svg>')).toBe(true);
    expect(svg).toContain('xmlns="http://www.w3.org/2000/svg"');
    expect(svg).toContain('viewBox=');
    expect(svg).toContain('<rect fill=');
    expect(svg).toContain('<path fill=');
  });

  it('respects custom border and color options', () => {
    const text = 'test-qr-code';
    const svg = generateQrCodeSvg(text, {
      border: 4,
      whiteColor: '#ffffff',
      blackColor: '#123456',
      ecc: 'H',
    });

    expect(svg).toContain('fill="#ffffff"');
    expect(svg).toContain('fill="#123456"');
  });

  it('generates an SVG with proper dimensions based on pixelSize', () => {
    const text = 'hello-world';
    const svg1 = generateQrCodeSvg(text, { pixelSize: 5 });
    const svg2 = generateQrCodeSvg(text, { pixelSize: 10 });

    const viewBox1 = svg1.match(/viewBox="0 0 (\d+) (\d+)"/);
    const viewBox2 = svg2.match(/viewBox="0 0 (\d+) (\d+)"/);

    expect(viewBox1).toBeTruthy();
    expect(viewBox2).toBeTruthy();

    const size1 = Number(viewBox1![1]);
    const size2 = Number(viewBox2![1]);

    expect(size2).toBe(size1 * 2);
  });
});
