import type { PropsWithChildren } from 'hono/jsx';

interface LayoutProps {
  title: string;
  siteName?: string;
}

export const Layout = ({
  title,
  siteName = 'EasyOAuth',
  children,
}: PropsWithChildren<LayoutProps>) => {
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
      <body class="min-h-screen bg-slate-900 text-slate-100 flex flex-col justify-center items-center py-12 px-4 sm:px-6 lg:px-8">
        <div class="w-full max-w-md space-y-8">
          <div class="text-center">
            <h1 class="text-3xl font-extrabold tracking-tight text-white">{siteName}</h1>
          </div>
          <div class="bg-slate-800/80 backdrop-blur border border-slate-700 rounded-2xl shadow-xl p-8 space-y-6">
            {children}
          </div>
          <div class="text-center text-xs text-slate-500">
            Powered by <span class="font-semibold text-slate-400">easy-oauth-worker</span>
          </div>
        </div>
      </body>
    </html>
  );
};
