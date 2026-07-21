import { AppSidebar } from './AppSidebar';
import { TopBar } from './TopBar';
import { ReleaseNotesDialog } from '@/components/releases/ReleaseNotesDialog';
export function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <AppSidebar />
      <div className="flex flex-col flex-1 overflow-hidden">
        <TopBar />
        <main className="flex-1 overflow-y-auto p-4 md:p-6">
          {children}
        </main>
      </div>
      <ReleaseNotesDialog />
    </div>
  );
}
