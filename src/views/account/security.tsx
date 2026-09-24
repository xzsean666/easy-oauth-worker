import { raw } from 'hono/html';
import { Layout } from '../layout';
import type { User } from '../../db/schema';

interface SecurityViewProps {
  siteName?: string;
  user: User;
  secret?: string;
  uri?: string;
  qrSvg?: string;
  error?: string;
  success?: string;
}

export const SecurityView = ({
  siteName = 'EasyOAuth',
  user,
  secret,
  uri,
  qrSvg,
  error,
  success,
}: SecurityViewProps) => {
  const is2faActive = user.totp_enabled === 1;

  return (
    <Layout title="Security Settings" siteName={siteName}>
      <div>
        <div class="flex items-center justify-between pb-3 border-b border-slate-700/60">
          <div>
            <h2 class="text-xl font-bold text-white">Account Security</h2>
            <p class="text-xs text-slate-400 mt-0.5">
              Signed in as <span class="font-medium text-slate-200">{user.username}</span>
            </p>
          </div>
          <a
            href="/logout"
            class="text-xs text-rose-400 hover:text-rose-300 transition-colors"
          >
            Sign Out
          </a>
        </div>
      </div>

      {error && (
        <div class="bg-rose-500/10 border border-rose-500/30 text-rose-300 px-4 py-3 rounded-lg text-sm">
          {error}
        </div>
      )}

      {success && (
        <div class="bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 px-4 py-3 rounded-lg text-sm">
          {success}
        </div>
      )}

      {/* TOTP 2FA Section */}
      <div class="space-y-4">
        <div class="flex items-center justify-between">
          <div class="flex items-center space-x-2">
            <span class="text-base font-semibold text-white">Google Authenticator (TOTP)</span>
          </div>
          {is2faActive ? (
            <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
              Enabled
            </span>
          ) : (
            <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-500/20 text-amber-300 border border-amber-500/30">
              Disabled
            </span>
          )}
        </div>

        {is2faActive ? (
          <div class="bg-slate-900/60 border border-slate-700/60 rounded-xl p-4 space-y-4">
            <div class="flex items-start space-x-3">
              <div class="text-emerald-400 text-lg mt-0.5">🛡️</div>
              <div class="text-xs text-slate-300 leading-relaxed">
                Your account is protected by two-factor authentication. You will be asked for a 6-digit dynamic code upon sign-in. This authenticator is also your credential for <strong class="text-white">self-service password recovery</strong>.
              </div>
            </div>

            <div class="pt-3 border-t border-slate-800">
              <h4 class="text-xs font-semibold text-slate-300 mb-2">Turn off two-factor authentication</h4>
              <p class="text-xs text-amber-400/90 mb-3">
                ⚠️ Warning: Disabling 2FA will also disable your ability to self-service recover your password.
              </p>
              <form method="post" action="/account/security/disable-totp" class="space-y-3">
                <div>
                  <label class="block text-xs font-medium text-slate-400 mb-1" for="current_password">
                    Enter your current password to confirm:
                  </label>
                  <input
                    id="current_password"
                    name="current_password"
                    type="password"
                    required
                    placeholder="••••••••"
                    class="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-rose-500"
                  />
                </div>
                <button
                  type="submit"
                  class="w-full py-2 px-3 bg-rose-600/80 hover:bg-rose-600 text-white text-xs font-medium rounded-lg transition-colors"
                >
                  Disable Google Authenticator
                </button>
              </form>
            </div>
          </div>
        ) : (
          <div class="bg-slate-900/60 border border-slate-700/60 rounded-xl p-4 space-y-4">
            <div class="bg-amber-500/10 border border-amber-500/30 rounded-lg p-3 text-xs text-amber-200/90 leading-relaxed">
              <strong class="font-bold text-amber-200">Important: </strong>
              Google Authenticator is the <u>only mechanism</u> for self-service password recovery. If you do not enable it, you will not be able to recover your account if you forget your password.
            </div>

            {secret && (
              <div class="space-y-4 pt-1">
                <div>
                  <label class="block text-xs font-medium text-slate-300 mb-2">
                    1. Scan QR Code in your Authenticator App:
                  </label>

                  {qrSvg && (
                    <div class="flex flex-col items-center justify-center p-4 bg-white rounded-xl shadow-lg border border-slate-200 w-fit mx-auto my-3">
                      <div class="w-48 h-48 flex items-center justify-center [&>svg]:w-full [&>svg]:h-full [&>svg]:rounded">
                        {raw(qrSvg)}
                      </div>
                      <span class="text-[11px] text-slate-600 font-medium mt-2 flex items-center gap-1.5">
                        <svg class="w-3.5 h-3.5 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
                        </svg>
                        Scan with Authenticator App (Google, 1Password, etc.)
                      </span>
                    </div>
                  )}

                  <div class="mt-3 pt-3 border-t border-slate-800 space-y-2">
                    <p class="text-[11px] font-medium text-slate-400">
                      Can't scan? Enter setup key manually:
                    </p>
                    <div class="flex items-center space-x-2">
                      <input
                        type="text"
                        readonly
                        value={secret}
                        class="font-mono text-xs w-full bg-slate-950 border border-slate-700 px-3 py-2 rounded-lg text-indigo-300 select-all"
                      />
                    </div>
                    <p class="text-[10px] text-slate-500">
                      In Google Authenticator: Tap (+) &gt; "Enter a setup key" &gt; paste this Secret.
                    </p>
                  </div>
                </div>

                {uri && (
                  <div class="pt-1">
                    <label class="block text-[11px] font-medium text-slate-400 mb-1">
                      Or copy OTPAuth link:
                    </label>
                    <input
                      type="text"
                      readonly
                      value={uri}
                      class="font-mono text-[10px] w-full bg-slate-950 border border-slate-700 px-2 py-1.5 rounded text-slate-400 select-all"
                    />
                  </div>
                )}

                <form method="post" action="/account/security/enable-totp" class="space-y-3 pt-2 border-t border-slate-800">
                  <input type="hidden" name="secret" value={secret} />
                  <div>
                    <label class="block text-xs font-medium text-slate-300 mb-1" for="totp_code">
                      2. Enter the 6-digit code shown in your app:
                    </label>
                    <input
                      id="totp_code"
                      name="totp_code"
                      type="text"
                      inputmode="numeric"
                      pattern="[0-9]{6}"
                      maxlength={6}
                      required
                      placeholder="123456"
                      class="w-full text-center tracking-widest text-lg font-mono px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                  <button
                    type="submit"
                    class="w-full py-2.5 px-4 bg-indigo-600 hover:bg-indigo-500 text-white font-medium rounded-lg text-xs shadow-sm transition-colors"
                  >
                    Verify &amp; Enable 2FA
                  </button>
                </form>
              </div>
            )}
          </div>
        )}
      </div>

      <div class="text-center text-xs text-slate-400 pt-2 border-t border-slate-700/50">
        <a href="/" class="text-indigo-400 hover:text-indigo-300">
          &larr; Back to Home
        </a>
      </div>
    </Layout>
  );
};
