import { AdminLayout } from './layout';
import type { DashboardStats } from '../../services/admin.service';

interface DashboardViewProps {
  stats: DashboardStats;
  adminUsername?: string;
  siteName?: string;
}

export const DashboardView = ({ stats, adminUsername, siteName }: DashboardViewProps) => {
  const statCards = [
    { label: 'Total Users', value: stats.totalUsers, icon: '👥', color: 'indigo' },
    { label: '2FA Users', value: stats.totpUsers, icon: '🛡️', color: 'emerald' },
    { label: 'Active Sessions', value: stats.activeSessions, icon: '⚡', color: 'amber' },
    { label: 'OAuth Clients', value: stats.totalClients, icon: '📱', color: 'purple' },
  ];

  return (
    <AdminLayout title="Dashboard" currentPath="/admin" adminUsername={adminUsername} siteName={siteName}>
      {/* Overview Stat Cards */}
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((card) => (
          <div class="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-sm space-y-2">
            <div class="flex items-center justify-between text-slate-400">
              <span class="text-xs font-medium uppercase tracking-wider">{card.label}</span>
              <span class="text-lg">{card.icon}</span>
            </div>
            <div class="text-3xl font-extrabold text-white">{card.value}</div>
          </div>
        ))}
      </div>

      {/* Quick Action Navigation */}
      <div class="grid grid-cols-1 md:grid-cols-3 gap-6 pt-4">
        <a
          href="/admin/users"
          class="block bg-slate-900 border border-slate-800 hover:border-indigo-500/50 rounded-xl p-6 transition-all duration-200 group"
        >
          <div class="text-2xl mb-3">👥</div>
          <h3 class="text-base font-semibold text-white group-hover:text-indigo-400">Manage Users</h3>
          <p class="text-xs text-slate-400 mt-1">
            Search registered accounts, toggle activation, view verification status, and revoke sessions.
          </p>
        </a>

        <a
          href="/admin/clients"
          class="block bg-slate-900 border border-slate-800 hover:border-indigo-500/50 rounded-xl p-6 transition-all duration-200 group"
        >
          <div class="text-2xl mb-3">📱</div>
          <h3 class="text-base font-semibold text-white group-hover:text-indigo-400">OAuth Clients</h3>
          <p class="text-xs text-slate-400 mt-1">
            Register new third-party applications, configure allowed redirect URIs, and rotate secrets.
          </p>
        </a>

        <a
          href="/admin/settings"
          class="block bg-slate-900 border border-slate-800 hover:border-indigo-500/50 rounded-xl p-6 transition-all duration-200 group"
        >
          <div class="text-2xl mb-3">⚙️</div>
          <h3 class="text-base font-semibold text-white group-hover:text-indigo-400">System Settings</h3>
          <p class="text-xs text-slate-400 mt-1">
            Inspect OIDC discovery metadata, security architecture, and public provider configurations.
          </p>
        </a>
      </div>
    </AdminLayout>
  );
};
