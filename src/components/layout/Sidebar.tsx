import { NavLink } from 'react-router-dom'
import { X } from 'lucide-react'
import { cn } from 'cn'
import { useAuthStore } from '@/lib/store/auth.store'
import { visibleNavItems, type NavItem } from '@/config/navigation'
import { Button } from '@/components/ui/button'

interface SidebarProps {
  open: boolean
  onClose: () => void
}

function SidebarNavLink({ item }: { item: NavItem }) {
  const Icon = item.icon
  // All top-level items are exact matches (end) — consistent active state.
  return (
    <NavLink
      key={item.to}
      to={item.to}
      end
      className={({ isActive }) =>
        cn(
          'flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors',
          isActive
            ? 'bg-primary text-primary-foreground'
            : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground',
        )
      }
    >
      <Icon className="size-4" />
      {item.label}
    </NavLink>
  )
}

function SidebarContent() {
  const hasPermission = useAuthStore((state) => state.hasPermission)
  const role = useAuthStore((state) => state.user?.role)
  return (
    <nav className="flex flex-1 flex-col gap-1 px-2 py-2">
      {visibleNavItems(hasPermission, role).map((item) => (
        <SidebarNavLink key={item.to} item={item} />
      ))}
    </nav>
  )
}

/** Sidebar: fixed on desktop, slide-in drawer with overlay on mobile. */
export function Sidebar({ open, onClose }: SidebarProps) {
  return (
    <>
      {/* Desktop */}
      <aside className="hidden w-56 shrink-0 border-r bg-sidebar lg:block">
        <div className="flex h-14 items-center border-b px-4">
          <span className="text-base font-semibold tracking-tight">
            Delivery&nbsp;Solution
          </span>
        </div>
        <SidebarContent />
      </aside>

      {/* Mobile overlay */}
      {open && (
        <div
          className="fixed inset-0 z-40 lg:hidden"
          aria-hidden="true"
          onClick={onClose}
        >
          <div className="absolute inset-0 bg-black/40" />
        </div>
      )}
      {/* Mobile drawer */}
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-50 flex w-56 flex-col bg-sidebar transition-transform lg:hidden',
          open ? 'translate-x-0' : '-translate-x-full',
        )}
      >
        <div className="flex h-14 shrink-0 items-center justify-between border-b px-4">
          <span className="text-base font-semibold tracking-tight">
            Delivery&nbsp;Solution
          </span>
          <Button
            variant="ghost"
            size="icon"
            aria-label="Close menu"
            onClick={onClose}
          >
            <X className="size-4" />
          </Button>
        </div>
        <SidebarContent />
      </aside>
    </>
  )
}
