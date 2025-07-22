import { cookies } from 'next/headers';

import { AppSidebar } from '@/components/app-sidebar';
import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar';
import { auth } from '../(auth)/auth';
import Script from 'next/script';
import { DataStreamProvider } from '@/components/data-stream-provider';
import { ErrorBoundary } from '@/components/error-boundary';

export const experimental_ppr = true;

export default async function Layout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [session, cookieStore] = await Promise.all([auth(), cookies()]);
  const isCollapsed = cookieStore.get('sidebar:state')?.value !== 'true';

  return (
    <>
      <Script
        src="https://cdn.jsdelivr.net/pyodide/v0.23.4/full/pyodide.js"
        strategy="beforeInteractive"
      />
      <DataStreamProvider>
        <ErrorBoundary
          isolate
          onError={(error, errorInfo) => {
            console.error('Chat layout error:', { error, errorInfo, user: session?.user?.id });
          }}
        >
          <SidebarProvider defaultOpen={!isCollapsed}>
            <ErrorBoundary
              isolate
              onError={(error, errorInfo) => {
                console.error('Sidebar error:', { error, errorInfo });
              }}
            >
              <AppSidebar user={session?.user} />
            </ErrorBoundary>
            <SidebarInset>
              <ErrorBoundary
                isolate
                onError={(error, errorInfo) => {
                  console.error('Chat content error:', { error, errorInfo });
                }}
              >
                {children}
              </ErrorBoundary>
            </SidebarInset>
          </SidebarProvider>
        </ErrorBoundary>
      </DataStreamProvider>
    </>
  );
}
