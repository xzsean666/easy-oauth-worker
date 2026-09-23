/**
 * Generates an RS256 CryptoKeyPair in JWK format for easy-oauth-worker.
 *
 * Usage:
 *   npx tsx scripts/generate-keys.ts
 *
 * Then copy the JSON output and configure it via:
 *   wrangler secret put OIDC_SIGNING_KEY
 */

const RSA_PARAMS = {
  name: 'RSASSA-PKCS1-v1_5',
  modulusLength: 2048,
  publicExponent: new Uint8Array([1, 0, 1]),
  hash: 'SHA-256',
};

async function main() {
  console.log('Generating RS256 RSA-2048 keypair using Web Crypto API...\n');

  const keyPair = (await crypto.subtle.generateKey(
    RSA_PARAMS,
    true,
    ['sign', 'verify']
  )) as CryptoKeyPair;

  const privateJwk = (await crypto.subtle.exportKey('jwk', keyPair.privateKey)) as any;
  const publicJwk = (await crypto.subtle.exportKey('jwk', keyPair.publicKey)) as any;

  const kid = `key_${Date.now()}`;
  privateJwk.kid = kid;
  privateJwk.alg = 'RS256';
  privateJwk.use = 'sig';

  publicJwk.kid = kid;
  publicJwk.alg = 'RS256';
  publicJwk.use = 'sig';

  console.log('================================================================');
  console.log('1. OIDC_SIGNING_KEY (Private Key for Signing ID Tokens)');
  console.log('   Run: wrangler secret put OIDC_SIGNING_KEY');
  console.log('   Value to paste:');
  console.log(JSON.stringify(privateJwk));
  console.log('================================================================\n');

  console.log('================================================================');
  console.log('2. Public JWK (Matched in /.well-known/jwks.json)');
  console.log(JSON.stringify(publicJwk, null, 2));
  console.log('================================================================');
}

main().catch(console.error);
