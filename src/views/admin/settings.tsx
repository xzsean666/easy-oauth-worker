import { AdminLayout } from './layout';

interface SettingsViewProps {
  adminUsername?: string;
  siteName?: string;
  authUrl: string;
}

export const SettingsView = ({
  adminUsername,
  siteName,
  authUrl,
}: SettingsViewProps) => {
  return (
    <AdminLayout title="System Settings" currentPath="/admin/settings" adminUsername={adminUsername} siteName={siteName}>
      <div class="space-y-6">
        {/* Provider Endpoints & Identity */}
        <div class="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-sm space-y-4">
          <h2 class="text-base font-semibold text-white">Identity & OIDC Endpoints</h2>
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            <div class="space-y-1">
              <span class="text-slate-400">Site Name</span>
              <div class="font-medium text-white bg-slate-950 p-2.5 rounded-lg border border-slate-800">
                {siteName || 'easy-oauth-worker'}
              </div>
            </div>

            <div class="space-y-1">
              <span class="text-slate-400">Auth URL / Issuer</span>
              <div class="font-mono text-indigo-300 bg-slate-950 p-2.5 rounded-lg border border-slate-800 select-all">
                {authUrl}
              </div>
            </div>

            <div class="space-y-1">
              <span class="text-slate-400">OpenID Connect Discovery URL</span>
              <div class="font-mono text-slate-300 bg-slate-950 p-2.5 rounded-lg border border-slate-800 break-all">
                <a href={`${authUrl}/.well-known/openid-configuration`} target="_blank" class="text-indigo-400 hover:underline">
                  {authUrl}/.well-known/openid-configuration
                </a>
              </div>
            </div>

            <div class="space-y-1">
              <span class="text-slate-400">JSON Web Key Set (JWKS) URL</span>
              <div class="font-mono text-slate-300 bg-slate-950 p-2.5 rounded-lg border border-slate-800 break-all">
                <a href={`${authUrl}/.well-known/jwks.json`} target="_blank" class="text-indigo-400 hover:underline">
                  {authUrl}/.well-known/jwks.json
                </a>
              </div>
            </div>
          </div>
        </div>

        {/* 2FA & Offline Zero-Cost Security */}
        <div class="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-sm space-y-4">
          <div class="flex items-center justify-between">
            <h2 class="text-base font-semibold text-white">Authentication & Recovery Architecture</h2>
            <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              ✓ Pure Username & Zero-Cost TOTP
            </span>
          </div>

          <div class="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
            <div class="space-y-1">
              <span class="text-slate-400">Identity Mode</span>
              <div class="font-mono text-white bg-slate-950 p-2.5 rounded-lg border border-slate-800">
                Pure Username & TOTP (100% Offline)
              </div>
            </div>

            <div class="space-y-1">
              <span class="text-slate-400">2FA / MFA Standard</span>
              <div class="font-mono text-white bg-slate-950 p-2.5 rounded-lg border border-slate-800">
                RFC 6238 TOTP (Google Authenticator)
              </div>
            </div>

            <div class="space-y-1">
              <span class="text-slate-400">Password Recovery</span>
              <div class="font-mono text-white bg-slate-950 p-2.5 rounded-lg border border-slate-800">
                Self-service via TOTP Verification
              </div>
            </div>
          </div>
        </div>

        {/* Security & Cryptography Standards */}
        <div class="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-sm space-y-3">
          <h2 class="text-base font-semibold text-white">Security & Cryptography Specifications</h2>
          <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
            <div class="p-3 bg-slate-950 rounded-lg border border-slate-800 space-y-1">
              <div class="text-slate-400">Password Hashing</div>
              <div class="font-semibold text-white">PBKDF2-SHA256 (100k rounds)</div>
            </div>
            <div class="p-3 bg-slate-950 rounded-lg border border-slate-800 space-y-1">
              <div class="text-slate-400">OIDC Token Signing</div>
              <div class="font-semibold text-white">RS256 (2048-bit RSA)</div>
            </div>
            <div class="p-3 bg-slate-950 rounded-lg border border-slate-800 space-y-1">
              <div class="text-slate-400">PKCE Enforcement</div>
              <div class="font-semibold text-white">S256 Mandatory</div>
            </div>
            <div class="p-3 bg-slate-950 rounded-lg border border-slate-800 space-y-1">
              <div class="text-slate-400">Session Cookie</div>
              <div class="font-semibold text-white">HttpOnly + Secure + Lax</div>
            </div>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
};
