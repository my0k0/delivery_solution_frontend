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
 *
 * The shell owns the viewport height and clips overflow, so <main> is the only
 * scroll container. This was `min-h-screen`, i.e. a *minimum*: the page grew
 * with its content and the document scrolled, which stretched the sidebar to
 * the full document height and scrolled the nav out of view.
 */
export function AppShell() {
  const user = useAuthStore((state) => state.user);
  const [drawerOpen, setDrawerOpen] = useState(false);

  return (
    <div className="flex h-dvh overflow-hidden">
      <Sidebar open={drawerOpen} onClose={() => setDrawerOpen(false)} />

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Sibling of the scroll container, so it never scrolls — no `sticky` needed. */}
        <header className="z-30 flex h-14 shrink-0 items-center justify-between gap-4 border-b bg-background/80 px-4 backdrop-blur">
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

        {/* min-h-0 because flex items default to min-height:auto and refuse to
            shrink below their content, which would defeat the scroll. */}
        <main className="min-h-0 flex-1 overflow-y-auto px-4 py-6 lg:px-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
