import { Layout } from '../layout';

interface LoginViewProps {
  siteName?: string;
  error?: string;
  email?: string;
  returnTo?: string;
}

export const LoginView = ({ siteName, error, email, returnTo }: LoginViewProps) => {
  return (
    <Layout title="Sign In" siteName={siteName}>
      <div>
        <h2 class="text-xl font-bold text-white text-center">Sign in to your account</h2>
      </div>

      {error && (
        <div class="bg-rose-500/10 border border-rose-500/30 text-rose-300 px-4 py-3 rounded-lg text-sm">
          {error}
        </div>
      )}

      <form method="post" action="/login" class="space-y-4">
        {returnTo && <input type="hidden" name="return_to" value={returnTo} />}

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

        <div>
          <div class="flex items-center justify-between mb-1">
            <label class="block text-sm font-medium text-slate-300" for="password">
              Password
            </label>
            <a href="/forgot-password" class="text-xs text-indigo-400 hover:text-indigo-300">
              Forgot password?
            </a>
          </div>
          <input
            id="password"
            name="password"
            type="password"
            required
            class="w-full px-3 py-2 bg-slate-900/80 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm"
            placeholder="••••••••"
          />
        </div>

        <button
          type="submit"
          class="w-full py-2.5 px-4 bg-indigo-600 hover:bg-indigo-500 text-white font-medium rounded-lg text-sm shadow-sm transition-colors duration-200"
        >
          Sign In
        </button>
      </form>

      <div class="text-center text-sm text-slate-400 pt-2 border-t border-slate-700/50">
        Don't have an account?{' '}
        <a href={`/register${returnTo ? `?return_to=${encodeURIComponent(returnTo)}` : ''}`} class="text-indigo-400 hover:text-indigo-300 font-medium">
          Create account
        </a>
      </div>
    </Layout>
  );
};
