// @ts-nocheck
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

describe('E2E Visual Test Screenshots & Documentation', () => {
  const rootDir = path.resolve(__dirname, '..');
  const screenshotsDir = path.join(rootDir, 'docs', 'screenshots');
  const reportPath = path.join(rootDir, 'docs', 'VISUAL_TEST_REPORT.md');

  const expectedScreenshots = [
    '01_login_desktop.png',
    '02_login_mobile.png',
    '03_register_desktop.png',
    '04_forgot_password_desktop.png',
    '05_account_security_desktop.png',
    '06_admin_dashboard_desktop.png',
    '07_admin_users_desktop.png',
    '08_admin_clients_desktop.png',
    '09_admin_settings_desktop.png',
    '10_oauth_consent_desktop.png',
    '11_oauth_consent_mobile.png',
    '12_oauth_error_invalid_redirect.png',
  ];

  it('should have docs/VISUAL_TEST_REPORT.md documenting all views', () => {
    expect(fs.existsSync(reportPath)).toBe(true);
    const reportContent = fs.readFileSync(reportPath, 'utf-8');
    for (const file of expectedScreenshots) {
      expect(reportContent).toContain(file);
    }
  });

  it('should have all 12 high-resolution screenshots generated in docs/screenshots', () => {
    expect(fs.existsSync(screenshotsDir)).toBe(true);

    for (const filename of expectedScreenshots) {
      const filePath = path.join(screenshotsDir, filename);
      expect(fs.existsSync(filePath), `Screenshot missing: ${filename}`).toBe(true);

      const stat = fs.statSync(filePath);
      // Ensure file has substantial content (> 5KB)
      expect(stat.size).toBeGreaterThan(5000);

      // Verify PNG magic header: 89 50 4E 47 0D 0A 1A 0A
      const buffer = fs.readFileSync(filePath);
      expect(buffer[0]).toBe(0x89);
      expect(buffer[1]).toBe(0x50);
      expect(buffer[2]).toBe(0x4e);
      expect(buffer[3]).toBe(0x47);
    }
  });

  it('should have scripts/visual-test.js executable utility', () => {
    const scriptPath = path.join(rootDir, 'scripts', 'visual-test.js');
    expect(fs.existsSync(scriptPath)).toBe(true);
  });
});
