import type { Bindings } from '../types/env';
import type { User } from '../db/schema';
import {
  generateRsaKeyPair,
  exportJwk,
  importPrivateKey,
  importPublicKey,
  signJwt,
  buildJwks,
  type ExtendedJsonWebKey,
  type JwksResponse,
  type StandardClaims,
} from '../crypto/jwt';

export interface OpenIdConfiguration {
  issuer: string;
  authorization_endpoint: string;
  token_endpoint: string;
  userinfo_endpoint: string;
  jwks_uri: string;
  revocation_endpoint: string;
  response_types_supported: string[];
  subject_types_supported: string[];
  id_token_signing_alg_values_supported: string[];
  scopes_supported: string[];
  token_endpoint_auth_methods_supported: string[];
  claims_supported: string[];
  code_challenge_methods_supported: string[];
}

export interface SigningKeyInfo {
  privateKey: CryptoKey;
  publicKey: CryptoKey;
  publicJwk: ExtendedJsonWebKey;
  kid: string;
}

let cachedSigningKey: SigningKeyInfo | null = null;

/**
 * Returns OIDC Discovery Configuration for the specified issuer.
 */
export function getOpenIdConfiguration(issuer: string): OpenIdConfiguration {
  const normalizedIssuer = issuer.replace(/\/+$/, '');

  return {
    issuer: normalizedIssuer,
    authorization_endpoint: `${normalizedIssuer}/oauth/authorize`,
    token_endpoint: `${normalizedIssuer}/oauth/token`,
    userinfo_endpoint: `${normalizedIssuer}/oauth/userinfo`,
    jwks_uri: `${normalizedIssuer}/.well-known/jwks.json`,
    revocation_endpoint: `${normalizedIssuer}/oauth/revoke`,
    response_types_supported: ['code'],
    subject_types_supported: ['public'],
    id_token_signing_alg_values_supported: ['RS256'],
    scopes_supported: ['openid', 'profile', 'email'],
    token_endpoint_auth_methods_supported: ['client_secret_post', 'client_secret_basic', 'none'],
    claims_supported: ['sub', 'iss', 'aud', 'exp', 'iat', 'auth_time', 'email', 'email_verified'],
    code_challenge_methods_supported: ['S256'],
  };
}

/**
 * Retrieves the system signing key (from env.OIDC_SIGNING_KEY or generated in-memory singleton).
 */
export async function getSigningKey(env: Bindings): Promise<SigningKeyInfo> {
  if (cachedSigningKey) {
    return cachedSigningKey;
  }

  if (env.OIDC_SIGNING_KEY) {
    try {
      const privateJwk = JSON.parse(env.OIDC_SIGNING_KEY) as ExtendedJsonWebKey;
      const kid = privateJwk.kid || 'easy-oauth-key-1';
      const privateKey = await importPrivateKey(privateJwk);

      // Create public JWK by stripping private parts
      const publicJwk: ExtendedJsonWebKey = {
        kty: privateJwk.kty,
        alg: 'RS256',
        use: 'sig',
        kid,
        n: privateJwk.n,
        e: privateJwk.e,
      };
      const publicKey = await importPublicKey(publicJwk);

      cachedSigningKey = { privateKey, publicKey, publicJwk, kid };
      return cachedSigningKey;
    } catch (err) {
      console.warn('[oidc.service] Failed to parse OIDC_SIGNING_KEY, falling back to generated key:', err);
    }
  }

  // Generate an in-memory key pair if none configured
  const keyPair = await generateRsaKeyPair();
  const kid = 'easy-oauth-default-key';
  const publicJwk = await exportJwk(keyPair.publicKey, kid);

  cachedSigningKey = {
    privateKey: keyPair.privateKey,
    publicKey: keyPair.publicKey,
    publicJwk,
    kid,
  };

  return cachedSigningKey;
}

/**
 * Returns RFC 7517 compliant JWKS response.
 */
export async function getJwks(env: Bindings): Promise<JwksResponse> {
  const keyInfo = await getSigningKey(env);
  return buildJwks(keyInfo.publicJwk);
}

/**
 * Generates and signs a standard OpenID Connect ID Token (JWT).
 */
export async function generateIdToken(
  env: Bindings,
  params: {
    clientId: string;
    user: User;
    scope: string;
    nonce?: string;
  }
): Promise<string> {
  const keyInfo = await getSigningKey(env);
  const now = Math.floor(Date.now() / 1000);
  const issuer = env.AUTH_URL.replace(/\/+$/, '');

  const claims: StandardClaims = {
    iss: issuer,
    sub: params.user.id,
    aud: params.clientId,
    iat: now,
    exp: now + 3600, // 1 hour validity
    auth_time: now,
  };

  if (params.nonce) {
    claims.nonce = params.nonce;
  }

  const requestedScopes = params.scope.split(' ');
  if (requestedScopes.includes('email')) {
    claims.email = params.user.email;
    claims.email_verified = params.user.email_verified === 1;
  }

  return signJwt(claims, keyInfo.privateKey, keyInfo.kid);
}

/**
 * Constructs UserInfo Claims payload based on authorized scopes.
 */
export function getUserInfoClaims(
  user: User,
  scope: string
): Record<string, unknown> {
  const claims: Record<string, unknown> = {
    sub: user.id,
  };

  const requestedScopes = scope.split(' ');

  if (requestedScopes.includes('email')) {
    claims.email = user.email;
    claims.email_verified = user.email_verified === 1;
  }

  if (requestedScopes.includes('profile')) {
    claims.updated_at = user.updated_at;
  }

  return claims;
}
