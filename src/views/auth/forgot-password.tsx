import { Layout } from '../layout';

interface ForgotPasswordViewProps {
  siteName?: string;
  error?: string;
  success?: string;
  username?: string;
}

export const ForgotPasswordView = ({
  siteName = 'EasyOAuth',
  error,
  success,
  username,
}: ForgotPasswordViewProps) => {
  return (
    <Layout title="Reset Password" siteName={siteName}>
      <div>
        <h2 class="text-xl font-bold text-white text-center">Reset your password</h2>
        <p class="text-xs text-slate-400 text-center mt-1">
          Recover your account via Google Authenticator (TOTP)
        </p>
      </div>

      {/* Explicit Warning Callout */}
      <div class="bg-amber-500/10 border border-amber-500/30 text-amber-200/90 p-3.5 rounded-xl text-xs space-y-1.5 leading-relaxed">
        <div class="font-bold text-amber-300 flex items-center space-x-1.5">
          <span>⚠️</span>
          <span>Important Security Notice</span>
        </div>
        <p>
          Password recovery requires a dynamic verification code from your <strong>Google Authenticator</strong>.
        </p>
        <p class="text-amber-100 font-medium bg-amber-500/10 p-1.5 rounded">
          Notice: If you have NOT enabled Google Authenticator on your account, you CANNOT recover your password self-service. Please contact an administrator.
        </p>
      </div>

      {error && (
        <div class="bg-rose-500/10 border border-rose-500/30 text-rose-300 px-4 py-3 rounded-lg text-sm">
          {error}
        </div>
      )}

      {success && (
        <div class="space-y-4">
          <div class="bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 px-4 py-3 rounded-lg text-sm">
            {success}
          </div>
          <a
            href="/login"
            class="block w-full text-center py-2.5 px-4 bg-indigo-600 hover:bg-indigo-500 text-white font-medium rounded-lg text-sm transition-colors"
          >
            Proceed to Sign In
          </a>
        </div>
      )}

      {!success && (
        <form method="post" action="/forgot-password" class="space-y-4">
          <div>
            <label class="block text-xs font-medium text-slate-300 mb-1" for="username">
              Username
            </label>
            <input
              id="username"
              name="username"
              type="text"
              required
              value={username || ''}
              class="w-full px-3 py-2 bg-slate-900/80 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm"
              placeholder="Enter your username"
            />
          </div>

          <div>
            <label class="block text-xs font-medium text-slate-300 mb-1" for="totp_code">
              Google Authenticator 6-Digit Code
            </label>
            <input
              id="totp_code"
              name="totp_code"
              type="text"
              inputmode="numeric"
              pattern="[0-9]{6}"
              maxlength={6}
              required
              class="w-full text-center tracking-widest text-lg font-mono px-3 py-2 bg-slate-900/80 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm"
              placeholder="123456"
            />
          </div>

          <div>
            <label class="block text-xs font-medium text-slate-300 mb-1" for="new_password">
              New Password (min 8 characters)
            </label>
            <input
              id="new_password"
              name="new_password"
              type="password"
              required
              minlength={8}
              class="w-full px-3 py-2 bg-slate-900/80 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm"
              placeholder="••••••••"
            />
          </div>

          <div>
            <label class="block text-xs font-medium text-slate-300 mb-1" for="confirm_password">
              Confirm New Password
            </label>
            <input
              id="confirm_password"
              name="confirm_password"
              type="password"
              required
              minlength={8}
              class="w-full px-3 py-2 bg-slate-900/80 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm"
              placeholder="••••••••"
            />
          </div>

          <button
            type="submit"
            class="w-full py-2.5 px-4 bg-indigo-600 hover:bg-indigo-500 text-white font-medium rounded-lg text-sm shadow-sm transition-colors duration-200"
          >
            Reset Password
          </button>
        </form>
      )}

      <div class="text-center text-sm text-slate-400 pt-2 border-t border-slate-700/50">
        Remember your password?{' '}
        <a href="/login" class="text-indigo-400 hover:text-indigo-300 font-medium">
          Sign in
        </a>
      </div>
    </Layout>
  );
};
