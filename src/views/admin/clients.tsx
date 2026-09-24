import { AdminLayout } from './layout';
import type { OAuthClient } from '../../db/schema';

interface ClientsViewProps {
  clients: OAuthClient[];
  adminUsername?: string;
  siteName?: string;
  newSecretInfo?: { clientId: string; secret: string };
  message?: string;
  error?: string;
  csrfToken?: string;
}

export const ClientsView = ({
  clients,
  adminUsername,
  siteName,
  newSecretInfo,
  message,
  error,
  csrfToken,
}: ClientsViewProps) => {
  return (
    <AdminLayout title="OAuth 2.0 Clients" currentPath="/admin/clients" adminUsername={adminUsername} siteName={siteName}>
      {newSecretInfo && (
        <div class="bg-amber-500/10 border-2 border-amber-500/40 rounded-xl p-5 space-y-2">
          <div class="flex items-center space-x-2 text-amber-400 font-semibold text-sm">
            <span>⚠️</span>
            <span>Important: Copy New Client Secret Now</span>
          </div>
          <p class="text-xs text-slate-300">
            Client ID: <code class="font-mono text-white bg-slate-800 px-1.5 py-0.5 rounded">{newSecretInfo.clientId}</code>
          </p>
          <div class="flex items-center space-x-3 pt-1">
            <input
              type="text"
              readonly
              value={newSecretInfo.secret}
              class="w-full max-w-xl px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-sm font-mono text-emerald-400 select-all"
            />
          </div>
          <p class="text-xs text-amber-300/80">
            For security reasons, this secret is only shown once and cannot be recovered later.
          </p>
        </div>
      )}

      {message && (
        <div class="bg-indigo-500/10 border border-indigo-500/30 text-indigo-300 px-4 py-3 rounded-lg text-sm">
          {message}
        </div>
      )}

      {error && (
        <div class="bg-rose-500/10 border border-rose-500/30 text-rose-300 px-4 py-3 rounded-lg text-sm">
          {error}
        </div>
      )}

      {/* Create New Client Form */}
      <div class="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-sm space-y-4">
        <h2 class="text-base font-semibold text-white">Register New OAuth Client</h2>
        <form method="post" action="/admin/clients" class="grid grid-cols-1 md:grid-cols-2 gap-4">
          {csrfToken && <input type="hidden" name="_csrf" value={csrfToken} />}
          <div class="space-y-1">
            <label class="block text-xs font-medium text-slate-300" for="name">
              Application Name
            </label>
            <input
              id="name"
              name="name"
              type="text"
              required
              placeholder="e.g. My Next.js Web App"
              class="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div class="space-y-1">
            <label class="block text-xs font-medium text-slate-300" for="allowed_scopes">
              Allowed Scopes (space-separated)
            </label>
            <input
              id="allowed_scopes"
              name="allowed_scopes"
              type="text"
              value="openid profile"
              class="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div class="md:col-span-2 space-y-1">
            <label class="block text-xs font-medium text-slate-300" for="redirect_uris">
              Redirect URIs (one per line)
            </label>
            <textarea
              id="redirect_uris"
              name="redirect_uris"
              rows={2}
              required
              placeholder="https://my-app.com/api/auth/callback"
              class="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono text-xs"
            ></textarea>
          </div>

          <div class="md:col-span-2 flex items-center space-x-2">
            <input
              id="is_public"
              name="is_public"
              type="checkbox"
              value="true"
              class="rounded bg-slate-950 border-slate-700 text-indigo-600 focus:ring-indigo-500"
            />
            <label class="text-xs text-slate-300" for="is_public">
              Public Client (SPA / Mobile App - PKCE without client secret)
            </label>
          </div>

          <div class="md:col-span-2">
            <button
              type="submit"
              class="py-2.5 px-4 bg-indigo-600 hover:bg-indigo-500 text-white font-medium rounded-lg text-sm transition-colors duration-150"
            >
              Create Client Application
            </button>
          </div>
        </form>
      </div>

      {/* Existing Clients List */}
      <div class="space-y-4">
        <h2 class="text-base font-semibold text-white">Registered Clients ({clients.length})</h2>
        <div class="grid grid-cols-1 gap-4">
          {clients.map((client) => {
            let redirectUris: string[] = [];
            try {
              redirectUris = JSON.parse(client.redirect_uris);
            } catch {
              redirectUris = [];
            }

            return (
              <div class="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-sm space-y-3">
                <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                  <div>
                    <h3 class="text-base font-bold text-white">{client.client_name}</h3>
                    <div class="text-xs text-slate-400 mt-0.5">
                      Client ID: <code class="font-mono text-indigo-300 select-all">{client.client_id}</code>
                    </div>
                  </div>
                  <div class="flex items-center space-x-2">
                    {client.is_public === 1 ? (
                      <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-500/10 text-amber-400 border border-amber-500/20">
                        Public Client
                      </span>
                    ) : (
                      <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                        Confidential Client
                      </span>
                    )}
                  </div>
                </div>

                <div class="space-y-1.5 pt-1 text-xs">
                  <div class="text-slate-400">Allowed Redirect URIs:</div>
                  <ul class="space-y-0.5">
                    {redirectUris.map((uri) => (
                      <li class="font-mono text-slate-300 bg-slate-950/60 px-2 py-1 rounded w-fit break-all">
                        {uri}
                      </li>
                    ))}
                  </ul>
                </div>

                <div class="flex items-center justify-end space-x-2 pt-3 border-t border-slate-800/80">
                  {/* Rotate Secret */}
                  <form method="post" action={`/admin/clients/${client.client_id}/rotate`} class="inline-block">
                    {csrfToken && <input type="hidden" name="_csrf" value={csrfToken} />}
                    <button
                      type="submit"
                      class="text-xs text-amber-400 hover:text-amber-300 px-3 py-1.5 bg-amber-500/10 hover:bg-amber-500/20 rounded-lg transition-colors"
                    >
                      Rotate Secret
                    </button>
                  </form>

                  {/* Delete Client */}
                  <form method="post" action={`/admin/clients/${client.client_id}/delete`} class="inline-block">
                    {csrfToken && <input type="hidden" name="_csrf" value={csrfToken} />}
                    <button
                      type="submit"
                      class="text-xs text-rose-400 hover:text-rose-300 px-3 py-1.5 bg-rose-500/10 hover:bg-rose-500/20 rounded-lg transition-colors"
                    >
                      Delete
                    </button>
                  </form>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </AdminLayout>
  );
};
