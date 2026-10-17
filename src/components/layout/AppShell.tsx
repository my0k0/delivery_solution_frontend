import { useState } from "react";
import { Outlet } from "react-router-dom";
import { Menu } from "lucide-react";
import { useAuthStore } from "@/lib/store/auth.store";
import { Button } from "@/components/ui/button";
import { Sidebar } from "./Sidebar";
import { Navbar } from "./NavBar";

/**
 * Application shell: sidebar (desktop fixed / mobile drawer), topbar with user
 * menu, <Outlet/> for routed pages.
 */
export function AppShell() {
  const user = useAuthStore((state) => state.user);
  const [drawerOpen, setDrawerOpen] = useState(false);

  return (
    <div className="flex min-h-screen">
      <Sidebar open={drawerOpen} onClose={() => setDrawerOpen(false)} />

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-14 items-center justify-between gap-4 border-b bg-background/80 px-4 backdrop-blur">
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              className="lg:hidden"
              aria-label="Open menu"
              onClick={() => setDrawerOpen(true)}
            >
              <Menu className="size-4" />
            </Button>
            <span className="lg:hidden">Delivery&nbsp;Solution</span>
          </div>
          {user && <Navbar user={user} />}
        </header>

        <main className="flex-1 px-4 py-6 lg:px-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
