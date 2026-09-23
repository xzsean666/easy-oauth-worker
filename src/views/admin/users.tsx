import { AdminLayout } from './layout';
import type { SafeUser } from '../../services/admin.service';

interface UsersViewProps {
  users: SafeUser[];
  total: number;
  search?: string;
  adminEmail?: string;
  siteName?: string;
  message?: string;
}

export const UsersView = ({
  users,
  total,
  search,
  adminEmail,
  siteName,
  message,
}: UsersViewProps) => {
  return (
    <AdminLayout title="Users Management" currentPath="/admin/users" adminEmail={adminEmail} siteName={siteName}>
      {message && (
        <div class="bg-indigo-500/10 border border-indigo-500/30 text-indigo-300 px-4 py-3 rounded-lg text-sm">
          {message}
        </div>
      )}

      {/* Search Header */}
      <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <form method="get" action="/admin/users" class="flex w-full sm:w-80 space-x-2">
          <input
            type="text"
            name="search"
            value={search || ''}
            placeholder="Search users by email..."
            class="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
          <button
            type="submit"
            class="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-sm font-medium rounded-lg transition-colors duration-150"
          >
            Search
          </button>
        </form>
        <div class="text-xs text-slate-400">
          Showing <span class="font-semibold text-white">{users.length}</span> of{' '}
          <span class="font-semibold text-white">{total}</span> users
        </div>
      </div>

      {/* Users Table */}
      <div class="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-sm">
        <div class="overflow-x-auto">
          <table class="w-full text-left text-sm text-slate-300">
            <thead class="bg-slate-800/60 text-xs uppercase text-slate-400 font-semibold border-b border-slate-800">
              <tr>
                <th class="px-6 py-3.5">User</th>
                <th class="px-6 py-3.5">Status</th>
                <th class="px-6 py-3.5">Role</th>
                <th class="px-6 py-3.5">Email Verified</th>
                <th class="px-6 py-3.5">Registered</th>
                <th class="px-6 py-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-800/80">
              {users.map((user) => (
                <tr class="hover:bg-slate-800/30 transition-colors">
                  <td class="px-6 py-4 font-medium text-white">{user.email}</td>
                  <td class="px-6 py-4">
                    {user.is_active === 1 ? (
                      <span class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                        Active
                      </span>
                    ) : (
                      <span class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-rose-500/10 text-rose-400 border border-rose-500/20">
                        Disabled
                      </span>
                    )}
                  </td>
                  <td class="px-6 py-4">
                    {user.is_admin === 1 ? (
                      <span class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                        Admin
                      </span>
                    ) : (
                      <span class="text-xs text-slate-400">User</span>
                    )}
                  </td>
                  <td class="px-6 py-4">
                    {user.email_verified === 1 ? (
                      <span class="text-emerald-400 font-medium">✓ Verified</span>
                    ) : (
                      <span class="text-amber-400">Unverified</span>
                    )}
                  </td>
                  <td class="px-6 py-4 text-xs text-slate-400">
                    {new Date(user.created_at * 1000).toLocaleDateString()}
                  </td>
                  <td class="px-6 py-4 text-right space-x-2">
                    {/* Toggle Active */}
                    <form method="post" action={`/admin/users/${user.id}/action`} class="inline-block">
                      <input type="hidden" name="action" value="toggle_active" />
                      <button
                        type="submit"
                        class="text-xs text-slate-400 hover:text-white px-2 py-1 bg-slate-800 hover:bg-slate-700 rounded transition-colors"
                      >
                        {user.is_active === 1 ? 'Disable' : 'Enable'}
                      </button>
                    </form>

                    {/* Manual Verify */}
                    {user.email_verified === 0 && (
                      <form method="post" action={`/admin/users/${user.id}/action`} class="inline-block">
                        <input type="hidden" name="action" value="verify_email" />
                        <button
                          type="submit"
                          class="text-xs text-emerald-400 hover:text-emerald-300 px-2 py-1 bg-emerald-500/10 hover:bg-emerald-500/20 rounded transition-colors"
                        >
                          Verify
                        </button>
                      </form>
                    )}

                    {/* Revoke Sessions */}
                    <form method="post" action={`/admin/users/${user.id}/action`} class="inline-block">
                      <input type="hidden" name="action" value="revoke_sessions" />
                      <button
                        type="submit"
                        class="text-xs text-amber-400 hover:text-amber-300 px-2 py-1 bg-amber-500/10 hover:bg-amber-500/20 rounded transition-colors"
                      >
                        Revoke
                      </button>
                    </form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </AdminLayout>
  );
};
