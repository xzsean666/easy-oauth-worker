import { describe, it, expect, beforeEach } from 'vitest';
import {
  getOpenIdConfiguration,
  getSigningKey,
  getJwks,
  generateIdToken,
  getUserInfoClaims,
} from '../src/services/oidc.service';
import { verifyJwt, importPublicKey } from '../src/crypto/jwt';
import type { Bindings } from '../src/types/env';
import type { User } from '../src/db/schema';

describe('OpenID Connect (OIDC) Service Tests', () => {
  let mockEnv: Bindings;
  const mockUser: User = {
    id: 'usr_oidc_123',
    email: 'oidc.tester@example.com',
    password_hash: 'hash',
    password_salt: 'salt',
    email_verified: 1,
    is_active: 1,
    is_admin: 0,
    created_at: 1700000000,
    updated_at: 1700005000,
  };

  beforeEach(() => {
    mockEnv = {
      DB: {} as D1Database,
      AUTH_URL: 'https://auth.example.com',
      SITE_NAME: 'EasyOAuth Test',
    };
  });

  describe('OIDC Discovery Configuration', () => {
    it('returns compliant discovery metadata for issuer', () => {
      const config = getOpenIdConfiguration('https://auth.example.com/');

      expect(config.issuer).toBe('https://auth.example.com');
      expect(config.authorization_endpoint).toBe('https://auth.example.com/oauth/authorize');
      expect(config.token_endpoint).toBe('https://auth.example.com/oauth/token');
      expect(config.userinfo_endpoint).toBe('https://auth.example.com/oauth/userinfo');
      expect(config.jwks_uri).toBe('https://auth.example.com/.well-known/jwks.json');
      expect(config.revocation_endpoint).toBe('https://auth.example.com/oauth/revoke');

      expect(config.response_types_supported).toContain('code');
      expect(config.id_token_signing_alg_values_supported).toContain('RS256');
      expect(config.code_challenge_methods_supported).toContain('S256');
      expect(config.scopes_supported).toEqual(expect.arrayContaining(['openid', 'email', 'profile']));
    });
  });

  describe('JWKS Public Keys', () => {
    it('returns public keys without private key exposure', async () => {
      const jwks = await getJwks(mockEnv);

      expect(jwks).toBeDefined();
      expect(Array.isArray(jwks.keys)).toBe(true);
      expect(jwks.keys.length).toBeGreaterThan(0);

      const key = jwks.keys[0];
      expect(key.kty).toBe('RSA');
      expect(key.use).toBe('sig');
      expect(key.alg).toBe('RS256');
      expect(key.kid).toBeDefined();
      expect(key.n).toBeDefined();
      expect(key.e).toBeDefined();
      // Ensure no private key leakage
      expect((key as unknown as Record<string, unknown>).d).toBeUndefined();
    });
  });

  describe('ID Token Generation and Verification', () => {
    it('generates ID token with claims and verifies with public key from JWKS', async () => {
      const idToken = await generateIdToken(mockEnv, {
        clientId: 'client_xyz',
        user: mockUser,
        scope: 'openid email',
        nonce: 'nonce_random_abc',
      });

      expect(typeof idToken).toBe('string');
      expect(idToken.split('.').length).toBe(3);

      // Verify token with public key
      const keyInfo = await getSigningKey(mockEnv);
      const verified = await verifyJwt<{
        iss: string;
        sub: string;
        aud: string;
        email: string;
        email_verified: boolean;
        nonce: string;
        auth_time: number;
      }>(idToken, keyInfo.publicKey);

      expect(verified.iss).toBe('https://auth.example.com');
      expect(verified.sub).toBe(mockUser.id);
      expect(verified.aud).toBe('client_xyz');
      expect(verified.email).toBe('oidc.tester@example.com');
      expect(verified.email_verified).toBe(true);
      expect(verified.nonce).toBe('nonce_random_abc');
      expect(verified.auth_time).toBe(mockUser.created_at);
    });

    it('omits email claim when email scope is not requested', async () => {
      const idToken = await generateIdToken(mockEnv, {
        clientId: 'client_xyz',
        user: mockUser,
        scope: 'openid profile',
      });

      const keyInfo = await getSigningKey(mockEnv);
      const verified = await verifyJwt<Record<string, unknown>>(idToken, keyInfo.publicKey);

      expect(verified.sub).toBe(mockUser.id);
      expect(verified.email).toBeUndefined();
    });
  });

  describe('UserInfo Claims Formatting', () => {
    it('filters claims based on scopes provided', () => {
      // openid only
      const baseClaims = getUserInfoClaims(mockUser, 'openid');
      expect(baseClaims).toEqual({ sub: mockUser.id });

      // openid + email
      const emailClaims = getUserInfoClaims(mockUser, 'openid email');
      expect(emailClaims).toEqual({
        sub: mockUser.id,
        email: 'oidc.tester@example.com',
        email_verified: true,
      });

      // openid + profile
      const profileClaims = getUserInfoClaims(mockUser, 'openid profile');
      expect(profileClaims).toEqual({
        sub: mockUser.id,
        updated_at: 1700005000,
      });
    });
  });
});
