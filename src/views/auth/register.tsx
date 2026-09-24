import { Layout } from '../layout';

interface RegisterViewProps {
  siteName?: string;
  error?: string;
  username?: string;
  returnTo?: string;
}

export const RegisterView = ({
  siteName = 'EasyOAuth',
  error,
  username,
  returnTo,
}: RegisterViewProps) => {
  return (
    <Layout title="Sign Up" siteName={siteName}>
      <div>
        <h2 class="text-xl font-bold text-white text-center">Create a new account</h2>
        <p class="text-xs text-slate-400 text-center mt-1">
          Fast and secure username registration
        </p>
      </div>

      {error && (
        <div class="bg-rose-500/10 border border-rose-500/30 text-rose-300 px-4 py-3 rounded-lg text-sm">
          {error}
        </div>
      )}

      <form method="post" action="/register" class="space-y-4">
        {returnTo && <input type="hidden" name="return_to" value={returnTo} />}

        <div>
          <label class="block text-xs font-medium text-slate-300 mb-1" for="username">
            Username (Letters, numbers, _, -)
          </label>
          <input
            id="username"
            name="username"
            type="text"
            required
            pattern="[a-zA-Z0-9_-]{3,32}"
            title="3-32 characters (letters, numbers, _, -)"
            value={username || ''}
            class="w-full px-3 py-2 bg-slate-900/80 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm"
            placeholder="alice_dev"
          />
        </div>

        <div>
          <label class="block text-xs font-medium text-slate-300 mb-1" for="password">
            Password (min 8 characters)
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
          <label class="block text-xs font-medium text-slate-300 mb-1" for="confirm_password">
            Confirm Password
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
          Create Account
        </button>
      </form>

      <div class="text-center text-sm text-slate-400 pt-2 border-t border-slate-700/50">
        Already have an account?{' '}
        <a
          href={`/login${returnTo ? `?return_to=${encodeURIComponent(returnTo)}` : ''}`}
          class="text-indigo-400 hover:text-indigo-300 font-medium"
        >
          Sign in
        </a>
      </div>
    </Layout>
  );
};
