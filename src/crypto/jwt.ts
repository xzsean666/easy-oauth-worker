import { base64UrlEncode, base64UrlDecode } from './token';

export interface ExtendedJsonWebKey extends JsonWebKey {
  kid?: string;
}

export interface JwtHeader {
  alg: string;
  typ: string;
  kid?: string;
  [key: string]: unknown;
}

export interface StandardClaims {
  iss?: string;
  sub?: string;
  aud?: string | string[];
  exp?: number;
  nbf?: number;
  iat?: number;
  jti?: string;
  [key: string]: unknown;
}

export interface JwksResponse {
  keys: ExtendedJsonWebKey[];
}

const RSA_PARAMS = {
  name: 'RSASSA-PKCS1-v1_5',
  modulusLength: 2048,
  publicExponent: new Uint8Array([1, 0, 1]),
  hash: 'SHA-256',
};

/**
 * Generates an RS256 CryptoKeyPair.
 */
export async function generateRsaKeyPair(): Promise<CryptoKeyPair> {
  return crypto.subtle.generateKey(RSA_PARAMS, true, ['sign', 'verify']) as Promise<CryptoKeyPair>;
}

/**
 * Exports a public or private CryptoKey to JWK format.
 */
export async function exportJwk(key: CryptoKey, kid?: string): Promise<ExtendedJsonWebKey> {
  const jwk = (await crypto.subtle.exportKey('jwk', key)) as ExtendedJsonWebKey;
  if (kid) {
    jwk.kid = kid;
  }
  jwk.alg = 'RS256';
  jwk.use = 'sig';
  return jwk;
}

/**
 * Imports a private RSA key from JWK.
 */
export async function importPrivateKey(jwkOrJson: ExtendedJsonWebKey | string): Promise<CryptoKey> {
  const jwk = typeof jwkOrJson === 'string' ? (JSON.parse(jwkOrJson) as ExtendedJsonWebKey) : jwkOrJson;
  return crypto.subtle.importKey(
    'jwk',
    jwk,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    true,
    ['sign']
  );
}

/**
 * Imports a public RSA key from JWK.
 */
export async function importPublicKey(jwkOrJson: ExtendedJsonWebKey | string): Promise<CryptoKey> {
  const jwk = typeof jwkOrJson === 'string' ? (JSON.parse(jwkOrJson) as ExtendedJsonWebKey) : jwkOrJson;
  return crypto.subtle.importKey(
    'jwk',
    jwk,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    true,
    ['verify']
  );
}

/**
 * Signs a JWT with RS256 algorithm.
 */
export async function signJwt(
  payload: StandardClaims,
  privateKey: CryptoKey,
  kid: string
): Promise<string> {
  const header: JwtHeader = {
    alg: 'RS256',
    typ: 'JWT',
    kid,
  };

  const enc = new TextEncoder();
  const encodedHeader = base64UrlEncode(enc.encode(JSON.stringify(header)));
  const encodedPayload = base64UrlEncode(enc.encode(JSON.stringify(payload)));
  const dataToSign = `${encodedHeader}.${encodedPayload}`;

  const signature = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5',
    privateKey,
    enc.encode(dataToSign)
  );

  const encodedSignature = base64UrlEncode(signature);
  return `${dataToSign}.${encodedSignature}`;
}

/**
 * Decodes a JWT without signature verification.
 */
export function decodeJwt<T = StandardClaims>(token: string): {
  header: JwtHeader;
  payload: T;
  signature: string;
} {
  const parts = token.split('.');
  if (parts.length !== 3) {
    throw new Error('Invalid JWT format');
  }

  const dec = new TextDecoder();
  const header = JSON.parse(dec.decode(base64UrlDecode(parts[0]))) as JwtHeader;
  const payload = JSON.parse(dec.decode(base64UrlDecode(parts[1]))) as T;

  return {
    header,
    payload,
    signature: parts[2],
  };
}

/**
 * Verifies a JWT's signature and expiration.
 */
export async function verifyJwt<T = StandardClaims>(
  token: string,
  publicKey: CryptoKey
): Promise<T> {
  const parts = token.split('.');
  if (parts.length !== 3) {
    throw new Error('Invalid JWT format');
  }

  const enc = new TextEncoder();
  const dataToVerify = `${parts[0]}.${parts[1]}`;
  const signatureBytes = base64UrlDecode(parts[2]);

  const isValid = await crypto.subtle.verify(
    'RSASSA-PKCS1-v1_5',
    publicKey,
    signatureBytes,
    enc.encode(dataToVerify)
  );

  if (!isValid) {
    throw new Error('Invalid JWT signature');
  }

  const dec = new TextDecoder();
  const payload = JSON.parse(dec.decode(base64UrlDecode(parts[1]))) as T & StandardClaims;

  if (payload.exp && typeof payload.exp === 'number') {
    const now = Math.floor(Date.now() / 1000);
    if (now > payload.exp) {
      throw new Error('JWT has expired');
    }
  }

  return payload as T;
}

/**
 * Converts a public JWK to a standard RFC 7517 JWKS structure.
 */
export function buildJwks(publicJwk: ExtendedJsonWebKey): JwksResponse {
  const safeJwk: ExtendedJsonWebKey = {
    kty: publicJwk.kty,
    use: 'sig',
    alg: 'RS256',
    kid: publicJwk.kid,
    n: publicJwk.n,
    e: publicJwk.e,
  };
  return {
    keys: [safeJwk],
  };
}
