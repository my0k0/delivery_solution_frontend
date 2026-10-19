import {
  Users,
  UserCog,
  ShieldCheck,
  Settings,
  Store,
  Contact,
  Bike,
  Package,
  ClipboardCheck,
  MapPinned,
  Handshake,
  HandCoins,
  LayoutDashboard,
  FileBarChart,
  ClipboardList,
  WalletCards,
  type LucideIcon,
} from "lucide-react";
import type { PermissionKey } from "@/types/permission";

export interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  /** Route gate. Absent = always visible (Settings). */
  permission?: PermissionKey;
  /**
   * Role gate. Absent = any role. Only the rider destinations need it: their
   * permission (`deliveries.read`) is held by office roles too, but the
   * `/riders/me/*` endpoints behind them answer 403 for a non-rider.
   */
  roles?: readonly string[];
}

/** A labelled set of destinations that the sidebar renders as one section. */
export interface NavGroup {
  id: string;
  label: string;
  items: NavItem[];
}

/**
 * Single source of truth for the sidebar and the landing redirect. Every
 * destination sits in exactly one group, and group order is sidebar order.
 *
 * A group left with fewer than two visible items is rendered by the sidebar as
 * plain links — there is nothing to collapse — so `settings` needs no special
 * casing and a group narrowed by permissions degrades on its own.
 */
export const NAV_GROUPS: NavGroup[] = [
  {
    id: "reports",
    label: "Reports",
    items: [
      { to: "/dashboard", label: "Office dashboard", icon: LayoutDashboard, permission: "reports.read" },
      { to: "/reports/orders", label: "Order report", icon: FileBarChart, permission: "reports.read" },
      { to: "/reports/shop-statement", label: "Shop statement", icon: Store, permission: "reports.read" },
      { to: "/reports/rider-collection", label: "Rider collection", icon: ClipboardList, permission: "reports.read" },
      { to: "/reports/rider-payout", label: "Rider payout", icon: WalletCards, permission: "reports.read" },
    ],
  },
  {
    id: "orders",
    label: "Orders",
    items: [
      { to: "/orders", label: "Orders", icon: Package, permission: "orders.read" },
      { to: "/orders/approval", label: "Confirm deliveries", icon: ClipboardCheck, permission: "deliveries.approve" },
      { to: "/rider-handovers", label: "Rider handovers", icon: HandCoins, permission: "rider-handovers.read" },
    ],
  },
  {
    id: "directory",
    label: "Shops & customers",
    items: [
      { to: "/shops", label: "Shops", icon: Store, permission: "shops.read" },
      { to: "/customers", label: "Customers", icon: Contact, permission: "customers.read" },
    ],
  },
  {
    id: "delivery-setup",
    label: "Delivery setup",
    items: [
      { to: "/riders", label: "Riders", icon: Bike, permission: "riders.read" },
      { to: "/townships", label: "Townships", icon: MapPinned, permission: "townships.read" },
      { to: "/partners", label: "Delivery partners", icon: Handshake, permission: "partners.read" },
    ],
  },
  {
    id: "administration",
    label: "Administration",
    items: [
      { to: "/users", label: "Users", icon: Users, permission: "users.read" },
      { to: "/roles", label: "Roles", icon: UserCog, permission: "roles.read" },
      {
        to: "/permissions",
        label: "Permissions",
        icon: ShieldCheck,
        permission: "permissions.read",
      },
    ],
  },
  {
    id: "my-work",
    label: "My work",
    items: [
      { to: "/rider-dashboard", label: "My dashboard", icon: LayoutDashboard, permission: "deliveries.read", roles: ["RIDER"] },
      { to: "/rider-board", label: "My deliveries", icon: Bike, permission: "deliveries.read", roles: ["RIDER"] },
    ],
  },
  {
    id: "settings",
    label: "Settings",
    items: [{ to: "/settings/password", label: "Settings", icon: Settings }],
  },
];

/**
 * Every destination in sidebar order, flattened. Derived from `NAV_GROUPS` —
 * edit the groups, never this list.
 */
export const NAV_ITEMS: NavItem[] = NAV_GROUPS.flatMap((group) => group.items);

/**
 * A nav item is visible when the caller's role is allowed and the permission is
 * held. Single source of truth for the sidebar and the landing redirect — the
 * two used to filter on the permission alone, so an office user saw the rider
 * links and landed on pages that 403.
 */
export function isNavItemVisible(
  item: NavItem,
  hasPermission: (name: PermissionKey) => boolean,
  role: string | undefined,
): boolean {
  if (item.roles && !(role !== undefined && item.roles.includes(role)))
    return false;
  return !item.permission || hasPermission(item.permission);
}

/** Groups narrowed to the destinations the caller may open, with empty groups
 * dropped. A group that survives with one item is rendered as a plain link. */
export function visibleNavGroups(
  hasPermission: (name: PermissionKey) => boolean,
  role: string | undefined,
): NavGroup[] {
  return NAV_GROUPS.map((group) => ({
    ...group,
    items: group.items.filter((item) =>
      isNavItemVisible(item, hasPermission, role),
    ),
  })).filter((group) => group.items.length > 0);
}

/**
 * The visible group a path belongs to, so the sidebar can open the section
 * holding the current page. Longest destination wins, so a nested route can
 * never be attributed to a shorter prefix it merely starts with.
 */
export function groupIdForPath(
  pathname: string,
  groups: NavGroup[],
): string | undefined {
  let match: { id: string; length: number } | undefined;
  for (const group of groups) {
    for (const item of group.items) {
      if (!isPathWithin(pathname, item.to)) continue;
      if (match === undefined || item.to.length > match.length) {
        match = { id: group.id, length: item.to.length };
      }
    }
  }
  return match?.id;
}

/** Path equality, or a nested path — `/orders` must not match `/orders-archive`. */
function isPathWithin(pathname: string, destination: string): boolean {
  return pathname === destination || pathname.startsWith(`${destination}/`);
}

/**
 * First sidebar destination the caller can actually open. Falls back to
 * Settings (ungated) so a low-permission user never lands in a redirect loop.
 */
export function firstAllowedPath(
  hasPermission: (name: PermissionKey) => boolean,
  role: string | undefined,
): string {
  for (const item of NAV_ITEMS) {
    if (isNavItemVisible(item, hasPermission, role)) return item.to;
  }
  return "/settings/password";
}
