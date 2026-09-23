import { Layout } from '../layout';

interface ConsentViewProps {
  siteName?: string;
  clientName: string;
  userEmail: string;
  scopes: string[];
  clientId: string;
  redirectUri: string;
  scopeString: string;
  codeChallenge: string;
  codeChallengeMethod: string;
  state?: string;
  nonce?: string;
  csrfToken?: string;
}

const SCOPE_DESCRIPTIONS: Record<string, { label: string; desc: string }> = {
  openid: {
    label: 'OpenID Connect',
    desc: 'Verify your identity and associate your account',
  },
  email: {
    label: 'Email Address',
    desc: 'View your primary email address and verification status',
  },
  profile: {
    label: 'Profile Info',
    desc: 'Access your basic profile data and account timestamps',
  },
};

export const ConsentView = ({
  siteName,
  clientName,
  userEmail,
  scopes,
  clientId,
  redirectUri,
  scopeString,
  codeChallenge,
  codeChallengeMethod,
  state,
  nonce,
  csrfToken,
}: ConsentViewProps) => {
  return (
    <Layout title={`Authorize ${clientName}`} siteName={siteName}>
      <div class="text-center space-y-2">
        <div class="w-12 h-12 bg-indigo-500/20 text-indigo-400 rounded-full flex items-center justify-center mx-auto text-xl font-bold">
          🔑
        </div>
        <h2 class="text-xl font-bold text-white">Authorization Request</h2>
        <p class="text-xs text-slate-400">
          Logged in as <span class="font-medium text-slate-200">{userEmail}</span>
        </p>
      </div>

      <div class="bg-slate-900/60 border border-slate-700/60 rounded-xl p-4 text-sm text-slate-300">
        <p class="text-sm font-semibold text-white mb-2">
          <span class="text-indigo-400">{clientName}</span> is requesting access to:
        </p>
        <ul class="space-y-2.5">
          {scopes.map((s) => {
            const info = SCOPE_DESCRIPTIONS[s] || { label: s, desc: `Access scope: ${s}` };
            return (
              <li class="flex items-start space-x-2.5">
                <span class="text-emerald-400 mt-0.5">✓</span>
                <div>
                  <div class="font-medium text-slate-200 text-xs">{info.label}</div>
                  <div class="text-xs text-slate-400">{info.desc}</div>
                </div>
              </li>
            );
          })}
        </ul>
      </div>

      <form method="post" action="/oauth/consent" class="space-y-3">
        <input type="hidden" name="client_id" value={clientId} />
        <input type="hidden" name="redirect_uri" value={redirectUri} />
        <input type="hidden" name="scope" value={scopeString} />
        <input type="hidden" name="code_challenge" value={codeChallenge} />
        <input type="hidden" name="code_challenge_method" value={codeChallengeMethod} />
        {state && <input type="hidden" name="state" value={state} />}
        {nonce && <input type="hidden" name="nonce" value={nonce} />}
        {csrfToken && <input type="hidden" name="_csrf" value={csrfToken} />}

        <div class="flex space-x-3 pt-2">
          <button
            type="submit"
            name="decision"
            value="deny"
            class="w-1/2 py-2.5 px-4 bg-slate-700 hover:bg-slate-600 text-slate-200 font-medium rounded-lg text-sm transition-colors duration-200"
          >
            Cancel
          </button>
          <button
            type="submit"
            name="decision"
            value="allow"
            class="w-1/2 py-2.5 px-4 bg-indigo-600 hover:bg-indigo-500 text-white font-medium rounded-lg text-sm shadow-sm transition-colors duration-200"
          >
            Authorize
          </button>
        </div>
      </form>
    </Layout>
  );
};
