import { Layout } from '../layout';

interface ResetPasswordViewProps {
  siteName?: string;
  error?: string;
  success?: string;
  token: string;
}

export const ResetPasswordView = ({
  siteName,
  error,
  success,
  token,
}: ResetPasswordViewProps) => {
  return (
    <Layout title="Choose New Password" siteName={siteName}>
      <div>
        <h2 class="text-xl font-bold text-white text-center">Set a new password</h2>
      </div>

      {error && (
        <div class="bg-rose-500/10 border border-rose-500/30 text-rose-300 px-4 py-3 rounded-lg text-sm">
          {error}
        </div>
      )}

      {success ? (
        <div class="space-y-4">
          <div class="bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 px-4 py-3 rounded-lg text-sm">
            {success}
          </div>
          <a
            href="/login"
            class="block w-full text-center py-2.5 px-4 bg-indigo-600 hover:bg-indigo-500 text-white font-medium rounded-lg text-sm transition-colors duration-200"
          >
            Sign in with new password
          </a>
        </div>
      ) : (
        <form method="post" action="/reset-password" class="space-y-4">
          <input type="hidden" name="token" value={token} />

          <div>
            <label class="block text-sm font-medium text-slate-300 mb-1" for="password">
              New Password (min 8 characters)
            </label>
            <input
              id="password"
              name="password"
              type="password"
              required
              minlength={8}
              class="w-full px-3 py-2 bg-slate-900/80 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm"
              placeholder="••••••••"
            />
          </div>

          <div>
            <label class="block text-sm font-medium text-slate-300 mb-1" for="confirm_password">
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
        <a href="/login" class="text-indigo-400 hover:text-indigo-300 font-medium">
          Back to sign in
        </a>
      </div>
    </Layout>
  );
};
