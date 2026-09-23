import { Layout } from '../layout';

interface ForgotPasswordViewProps {
  siteName?: string;
  error?: string;
  success?: string;
  email?: string;
}

export const ForgotPasswordView = ({
  siteName,
  error,
  success,
  email,
}: ForgotPasswordViewProps) => {
  return (
    <Layout title="Forgot Password" siteName={siteName}>
      <div>
        <h2 class="text-xl font-bold text-white text-center">Reset your password</h2>
        <p class="text-xs text-slate-400 text-center mt-1">
          Enter your email address and we'll send you a link to reset your password.
        </p>
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

      {!success && (
        <form method="post" action="/forgot-password" class="space-y-4">
          <div>
            <label class="block text-sm font-medium text-slate-300 mb-1" for="email">
              Email address
            </label>
            <input
              id="email"
              name="email"
              type="email"
              required
              value={email || ''}
              class="w-full px-3 py-2 bg-slate-900/80 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm"
              placeholder="you@example.com"
            />
          </div>

          <button
            type="submit"
            class="w-full py-2.5 px-4 bg-indigo-600 hover:bg-indigo-500 text-white font-medium rounded-lg text-sm shadow-sm transition-colors duration-200"
          >
            Send Reset Instructions
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
