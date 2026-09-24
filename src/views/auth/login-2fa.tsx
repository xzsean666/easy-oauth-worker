import { Layout } from '../layout';

interface Login2faViewProps {
  siteName?: string;
  error?: string;
  ticket: string;
  returnTo?: string;
}

export const Login2faView = ({
  siteName = 'EasyOAuth',
  error,
  ticket,
  returnTo,
}: Login2faViewProps) => {
  return (
    <Layout title="Two-Factor Authentication" siteName={siteName}>
      <div class="text-center space-y-1">
        <div class="inline-flex items-center justify-center w-12 h-12 rounded-full bg-indigo-500/10 text-indigo-400 text-2xl mb-2">
          🔐
        </div>
        <h2 class="text-xl font-bold text-white">Two-Factor Authentication</h2>
        <p class="text-xs text-slate-400">
          Open your Google Authenticator app and enter the 6-digit code.
        </p>
      </div>

      {error && (
        <div class="bg-rose-500/10 border border-rose-500/30 text-rose-300 px-4 py-3 rounded-lg text-sm">
          {error}
        </div>
      )}

      <form method="post" action="/login/2fa" class="space-y-4">
        <input type="hidden" name="ticket" value={ticket} />
        {returnTo && <input type="hidden" name="return_to" value={returnTo} />}

        <div>
          <label class="block text-xs font-medium text-slate-300 mb-1 text-center" for="totp_code">
            Verification Code
          </label>
          <input
            id="totp_code"
            name="totp_code"
            type="text"
            inputmode="numeric"
            pattern="[0-9]{6}"
            maxlength={6}
            required
            autofocus
            placeholder="123456"
            class="w-full text-center tracking-widest text-2xl font-mono px-3 py-2.5 bg-slate-900/80 border border-slate-700 rounded-lg text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
          />
        </div>

        <button
          type="submit"
          class="w-full py-2.5 px-4 bg-indigo-600 hover:bg-indigo-500 text-white font-medium rounded-lg text-sm shadow-sm transition-colors duration-200"
        >
          Verify Code
        </button>
      </form>

      <div class="text-center text-xs text-slate-400 pt-2 border-t border-slate-700/50">
        Lost access to your authenticator?{' '}
        <a href="/forgot-password" class="text-indigo-400 hover:text-indigo-300">
          Recover Password
        </a>{' '}
        or contact your administrator.
      </div>
    </Layout>
  );
};
