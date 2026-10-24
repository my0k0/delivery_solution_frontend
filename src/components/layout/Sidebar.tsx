import { useState } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import { ChevronDown, X } from 'lucide-react'
import { Accordion } from '@base-ui/react/accordion'
import { cn } from 'cn'
import { useAuthStore } from '@/lib/store/auth.store'
import {
  groupIdForPath,
  visibleNavGroups,
  type NavGroup,
  type NavItem,
} from '@/config/navigation'
import { Button } from '@/components/ui/button'
import { useListQuery } from '@/lib/url/list-query-memory'

interface SidebarProps {
  open: boolean
  onClose: () => void
}

function SidebarNavLink({ item, nested }: { item: NavItem; nested: boolean }) {
  const Icon = item.icon
  // A destination carries the last filtered view of that list, if there was
  // one. The URL alone cannot restore it: this link points at `/orders` with no
  // query, so leaving Orders for another menu and clicking back would drop the
  // filters the officer just set. Subscribed rather than read at render time —
  // the memory is written from an effect, so a plain read goes one filter
  // change behind and clicking the link would drop that change. `end` still
  // matches on the pathname, so the active state ignores the query string.
  const rememberedQuery = useListQuery(item.to)
  // All destinations are exact matches (end) — consistent active state.
  return (
    <NavLink
      to={`${item.to}${rememberedQuery}`}
      end
      className={({ isActive }) =>
        cn(
          'flex items-center gap-2 rounded-md py-2 text-sm font-medium transition-colors',
          nested ? 'pr-3 pl-6' : 'px-3',
          isActive
            ? 'bg-primary text-primary-foreground'
            : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground',
        )
      }
    >
      <Icon className="size-4 shrink-0" />
      {item.label}
    </NavLink>
  )
}

/**
 * One sidebar section: a disclosure trigger plus its destinations. A section
 * with a single destination renders it as a plain link — there is nothing to
 * collapse, and that is what keeps `settings` from needing a case of its own.
 */
function SidebarNavGroup({
  group,
  isOpen,
}: {
  group: NavGroup
  isOpen: boolean
}) {
  if (group.items.length === 1) {
    const [onlyItem] = group.items
    return <SidebarNavLink item={onlyItem} nested={false} />
  }
  return (
    <Accordion.Item value={group.id}>
      <Accordion.Header className="flex">
        <Accordion.Trigger className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors outline-none select-none hover:bg-accent hover:text-accent-foreground focus-visible:ring-2 focus-visible:ring-ring">
          {group.label}
          <ChevronDown
            aria-hidden="true"
            className={cn(
              'ml-auto size-4 shrink-0 transition-transform',
              isOpen && 'rotate-180',
            )}
          />
        </Accordion.Trigger>
      </Accordion.Header>
      <Accordion.Panel className="h-(--collapsible-panel-height) overflow-hidden transition-[height] duration-200 ease-out data-[starting-style]:h-0 data-[ending-style]:h-0">
        <div className="flex flex-col gap-1 pt-1">
          {group.items.map((item) => (
            <SidebarNavLink key={item.to} item={item} nested />
          ))}
        </div>
      </Accordion.Panel>
    </Accordion.Item>
  )
}

/** Shared by the desktop rail and the mobile drawer; scrolls independently. */
function SidebarContent() {
  const hasPermission = useAuthStore((state) => state.hasPermission)
  const role = useAuthStore((state) => state.user?.role)
  const { pathname } = useLocation()
  const groups = visibleNavGroups(hasPermission, role)

  // Derived-or-own: until the user toggles a section, the one holding the
  // current route is the open one. Deriving instead of syncing through an
  // effect also means no render loop, which a fresh array in a dependency
  // would otherwise cause.
  const activeGroupId = groupIdForPath(pathname, groups)
  const [toggledGroupIds, setToggledGroupIds] = useState<string[] | null>(null)
  const openGroupIds =
    toggledGroupIds ?? (activeGroupId === undefined ? [] : [activeGroupId])

  return (
    <nav className="flex min-h-0 flex-1 flex-col overflow-y-auto px-2 py-2">
      <Accordion.Root
        multiple
        value={openGroupIds}
        onValueChange={(value: string[]) => setToggledGroupIds(value)}
        className="flex flex-col gap-1"
      >
        {groups.map((group) => (
          <SidebarNavGroup
            key={group.id}
            group={group}
            isOpen={openGroupIds.includes(group.id)}
          />
        ))}
      </Accordion.Root>
    </nav>
  )
}

/** Sidebar: fixed on desktop, slide-in drawer with overlay on mobile. */
export function Sidebar({ open, onClose }: SidebarProps) {
  return (
    <>
      {/* Desktop. `lg:flex` (not `lg:block`) so the nav's flex-1 can size it and
          scroll inside the viewport instead of growing past it. */}
      <aside className="hidden w-56 shrink-0 flex-col border-r bg-sidebar lg:flex">
        <div className="flex h-14 shrink-0 items-center border-b px-4">
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
