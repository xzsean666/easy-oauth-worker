import type { PropsWithChildren } from 'hono/jsx';

interface AdminLayoutProps {
  title: string;
  currentPath: string;
  adminUsername?: string;
  siteName?: string;
}

export const AdminLayout = ({
  title,
  currentPath,
  adminUsername,
  siteName = 'EasyOAuth Admin',
  children,
}: PropsWithChildren<AdminLayoutProps>) => {
  const navItems = [
    { label: 'Dashboard', path: '/admin', icon: '📊' },
    { label: 'Users', path: '/admin/users', icon: '👥' },
    { label: 'OAuth Clients', path: '/admin/clients', icon: '📱' },
    { label: 'Settings', path: '/admin/settings', icon: '⚙️' },
  ];

  return (
    <html lang="en">
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>{`${title} - ${siteName}`}</title>
        <script src="https://cdn.tailwindcss.com"></script>
        <style>{`
          body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
          }
        `}</style>
      </head>
      <body class="min-h-screen bg-slate-950 text-slate-100 flex flex-col md:flex-row">
        {/* Sidebar */}
        <aside class="w-full md:w-64 bg-slate-900 border-r border-slate-800 p-6 flex flex-col justify-between shrink-0">
          <div class="space-y-6">
            <div>
              <a href="/admin" class="flex items-center space-x-2">
                <span class="text-xl">🛡️</span>
                <span class="text-lg font-bold tracking-tight text-white">{siteName}</span>
              </a>
              <p class="text-xs text-slate-500 mt-1">Provider Admin Console</p>
            </div>

            <nav class="space-y-1">
              {navItems.map((item) => {
                const isActive = currentPath === item.path;
                return (
                  <a
                    href={item.path}
                    class={`flex items-center space-x-3 px-3.5 py-2.5 rounded-lg text-sm font-medium transition-colors duration-150 ${
                      isActive
                        ? 'bg-indigo-600 text-white shadow-sm'
                        : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                    }`}
                  >
                    <span>{item.icon}</span>
                    <span>{item.label}</span>
                  </a>
                );
              })}
            </nav>
          </div>

          <div class="pt-6 border-t border-slate-800/80 space-y-3">
            {adminUsername && (
              <div class="text-xs text-slate-400 truncate">
                Admin: <span class="font-medium text-slate-200">{adminUsername}</span>
              </div>
            )}
            <div class="flex items-center justify-between text-xs text-slate-400">
              <a href="/" class="hover:text-indigo-400">View Site</a>
              <a href="/logout" class="text-rose-400 hover:text-rose-300">Logout</a>
            </div>
          </div>
        </aside>

        {/* Main Content Area */}
        <div class="flex-1 flex flex-col min-w-0 overflow-y-auto">
          <header class="h-16 bg-slate-900/50 backdrop-blur border-b border-slate-800 px-6 flex items-center justify-between">
            <h1 class="text-lg font-semibold text-white">{title}</h1>
            <div class="flex items-center space-x-3">
              <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                ● Live Worker
              </span>
            </div>
          </header>

          <main class="p-6 md:p-8 space-y-6 max-w-7xl w-full">
            {children}
          </main>
        </div>
      </body>
    </html>
  );
};
