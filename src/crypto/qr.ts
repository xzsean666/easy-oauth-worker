import { renderSVG } from 'uqr';

export interface QrCodeOptions {
  /**
   * Border width in modules (quiet zone). Defaults to 2.
   */
  border?: number;
  /**
   * Size of each pixel module. Defaults to 10.
   */
  pixelSize?: number;
  /**
   * Color of white modules/background. Defaults to '#ffffff'.
   */
  whiteColor?: string;
  /**
   * Color of black modules. Defaults to '#0f172a' (Slate-900).
   */
  blackColor?: string;
  /**
   * Error correction level: 'L' (7%), 'M' (15%), 'Q' (25%), 'H' (30%). Defaults to 'M'.
   */
  ecc?: 'L' | 'M' | 'Q' | 'H';
}

/**
 * Generates a clean, standalone SVG string representing a QR code.
 * Pure TypeScript implementation, 100% compatible with Cloudflare Workers edge runtime.
 *
 * @param text The text or URI to encode (e.g., otpauth://totp/...)
 * @param options Optional rendering parameters
 * @returns SVG XML string
 */
export function generateQrCodeSvg(text: string, options: QrCodeOptions = {}): string {
  if (!text) {
    throw new Error('QR code content cannot be empty');
  }

  return renderSVG(text, {
    border: options.border ?? 2,
    pixelSize: options.pixelSize ?? 10,
    whiteColor: options.whiteColor ?? '#ffffff',
    blackColor: options.blackColor ?? '#0f172a',
    ecc: options.ecc ?? 'M',
  });
}
