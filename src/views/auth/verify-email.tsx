import { Layout } from '../layout';

interface VerifyEmailViewProps {
  siteName?: string;
  status: 'pending' | 'success' | 'error';
  message?: string;
}

export const VerifyEmailView = ({
  siteName,
  status,
  message,
}: VerifyEmailViewProps) => {
  return (
    <Layout title="Email Verification" siteName={siteName}>
      <div class="text-center space-y-4">
        {status === 'pending' && (
          <>
            <div class="w-12 h-12 bg-indigo-500/20 text-indigo-400 rounded-full flex items-center justify-center mx-auto text-2xl">
              ✉
            </div>
            <h2 class="text-xl font-bold text-white">Check your email</h2>
            <p class="text-sm text-slate-300">
              {message || "We've sent a verification link to your email address. Please click the link to activate your account."}
            </p>
          </>
        )}

        {status === 'success' && (
          <>
            <div class="w-12 h-12 bg-emerald-500/20 text-emerald-400 rounded-full flex items-center justify-center mx-auto text-2xl">
              ✓
            </div>
            <h2 class="text-xl font-bold text-white">Email verified!</h2>
            <p class="text-sm text-slate-300">
              {message || 'Your email address has been successfully verified.'}
            </p>
            <a
              href="/login"
              class="inline-block w-full py-2.5 px-4 bg-indigo-600 hover:bg-indigo-500 text-white font-medium rounded-lg text-sm transition-colors duration-200"
            >
              Sign In to Your Account
            </a>
          </>
        )}

        {status === 'error' && (
          <>
            <div class="w-12 h-12 bg-rose-500/20 text-rose-400 rounded-full flex items-center justify-center mx-auto text-2xl">
              ✕
            </div>
            <h2 class="text-xl font-bold text-white">Verification Failed</h2>
            <p class="text-sm text-rose-300">
              {message || 'The verification link is invalid or has expired.'}
            </p>
            <a
              href="/login"
              class="inline-block text-sm text-indigo-400 hover:text-indigo-300 font-medium"
            >
              Return to Sign In
            </a>
          </>
        )}
      </div>
    </Layout>
  );
};
