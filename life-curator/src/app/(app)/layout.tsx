import { AppShell } from "@/components/AppShell";
import { AppStoreProvider } from "@/lib/store/AppStore";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <AppStoreProvider>
      <AppShell>{children}</AppShell>
    </AppStoreProvider>
  );
}
