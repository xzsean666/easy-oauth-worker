// @ts-nocheck
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';

describe('Cloudflare Pages Deployment Configuration & Adaptation', () => {
  const rootDir = path.resolve(__dirname, '..');

  it('should have functions/[[path]].ts with onRequest handler', async () => {
    const functionsEntry = path.join(rootDir, 'functions/[[path]].ts');
    expect(fs.existsSync(functionsEntry)).toBe(true);

    const content = fs.readFileSync(functionsEntry, 'utf-8');
    expect(content).toContain("import { handle } from 'hono/cloudflare-pages'");
    expect(content).toContain('export const onRequest = handle(app)');

    const mod = await import('../functions/[[path]]');
    expect(typeof mod.onRequest).toBe('function');
  });

  it('should have public/ directory with robots.txt, favicon.svg, and _headers', () => {
    const publicDir = path.join(rootDir, 'public');
    expect(fs.existsSync(publicDir)).toBe(true);

    const robotsPath = path.join(publicDir, 'robots.txt');
    expect(fs.existsSync(robotsPath)).toBe(true);
    const robots = fs.readFileSync(robotsPath, 'utf-8');
    expect(robots).toContain('Disallow: /admin/');

    const faviconPath = path.join(publicDir, 'favicon.svg');
    expect(fs.existsSync(faviconPath)).toBe(true);
    const favicon = fs.readFileSync(faviconPath, 'utf-8');
    expect(favicon).toContain('<svg');

    const headersPath = path.join(publicDir, '_headers');
    expect(fs.existsSync(headersPath)).toBe(true);
    const headers = fs.readFileSync(headersPath, 'utf-8');
    expect(headers).toContain('X-Frame-Options: DENY');
    expect(headers).toContain('X-Content-Type-Options: nosniff');
  });

  it('should have deploy-pages.sh script with executable permission and --help support', () => {
    const scriptPath = path.join(rootDir, 'scripts/deploy-pages.sh');
    expect(fs.existsSync(scriptPath)).toBe(true);

    const stat = fs.statSync(scriptPath);
    // Check executable bit (user executable)
    expect((stat.mode & 0o100) !== 0).toBe(true);

    const helpOutput = execSync(`bash "${scriptPath}" --help`, { encoding: 'utf-8' });
    expect(helpOutput).toContain('EasyOAuth Cloudflare Pages Deployment Utility');
    expect(helpOutput).toContain('--fast');
    expect(helpOutput).toContain('--project-name');
    expect(helpOutput).toContain('--db-id');
    expect(helpOutput).toContain('--skip-tests');
    expect(helpOutput).toContain('--skip-migrate');
    expect(helpOutput).toContain('--reset-db');
    expect(helpOutput).toContain('--seed');
  });

  it('should register deploy:pages, deploy:fast, and pages:dev in package.json', () => {
    const pkgPath = path.join(rootDir, 'package.json');
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
    expect(pkg.scripts['deploy:pages']).toBe('bash scripts/deploy-pages.sh');
    expect(pkg.scripts['deploy:fast']).toBe('bash scripts/deploy-pages.sh --fast');
    expect(pkg.scripts['pages:dev']).toBe('wrangler pages dev public');
  });

  it('should include functions in tsconfig.json', () => {
    const tsconfigPath = path.join(rootDir, 'tsconfig.json');
    const tsconfig = JSON.parse(fs.readFileSync(tsconfigPath, 'utf-8'));
    expect(tsconfig.include).toContain('functions/**/*');
  });
});
