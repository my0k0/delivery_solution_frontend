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
  Route,
  Coins,
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

/** Single source of truth for sidebar + landing redirect. */
export const NAV_ITEMS: NavItem[] = [
  { to: "/dashboard", label: "Office dashboard", icon: LayoutDashboard, permission: "reports.read" },
  { to: "/reports/orders", label: "Order report", icon: FileBarChart, permission: "reports.read" },
  { to: "/reports/shop-statement", label: "Shop statement", icon: Store, permission: "reports.read" },
  { to: "/reports/rider-collection", label: "Rider collection", icon: ClipboardList, permission: "reports.read" },
  { to: "/reports/rider-payout", label: "Rider payout", icon: WalletCards, permission: "reports.read" },
  { to: "/rider-dashboard", label: "My dashboard", icon: LayoutDashboard, permission: "deliveries.read", roles: ["RIDER"] },
  { to: "/users", label: "Users", icon: Users, permission: "users.read" },
  { to: "/roles", label: "Roles", icon: UserCog, permission: "roles.read" },
  {
    to: "/permissions",
    label: "Permissions",
    icon: ShieldCheck,
    permission: "permissions.read",
  },
  { to: "/shops", label: "Shops", icon: Store, permission: "shops.read" },
  { to: "/customers", label: "Customers", icon: Contact, permission: "customers.read" },
  { to: "/riders", label: "Riders", icon: Bike, permission: "riders.read" },
  { to: "/orders", label: "Orders", icon: Package, permission: "orders.read" },
  { to: "/orders/approval", label: "Approval queue", icon: ClipboardCheck, permission: "deliveries.approve" },
  { to: "/townships", label: "Townships", icon: MapPinned, permission: "townships.read" },
  { to: "/partners", label: "Delivery partners", icon: Handshake, permission: "partners.read" },
  { to: "/rider-board", label: "My deliveries", icon: Bike, permission: "deliveries.read", roles: ["RIDER"] },
  { to: "/ways", label: "Ways", icon: Route, permission: "ways.read" },
  { to: "/ways/settings", label: "Commission settings", icon: Coins, permission: "ways.read" },
  { to: "/settings/password", label: "Settings", icon: Settings },
];

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

export function visibleNavItems(
  hasPermission: (name: PermissionKey) => boolean,
  role: string | undefined,
): NavItem[] {
  return NAV_ITEMS.filter((item) =>
    isNavItemVisible(item, hasPermission, role),
  );
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
