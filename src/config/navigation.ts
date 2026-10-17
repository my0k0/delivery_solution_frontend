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
}

/** Single source of truth for sidebar + landing redirect. */
export const NAV_ITEMS: NavItem[] = [
  { to: "/dashboard", label: "Office dashboard", icon: LayoutDashboard, permission: "reports.read" },
  { to: "/reports/orders", label: "Order report", icon: FileBarChart, permission: "reports.read" },
  { to: "/reports/shop-statement", label: "Shop statement", icon: Store, permission: "reports.read" },
  { to: "/reports/rider-collection", label: "Rider collection", icon: ClipboardList, permission: "reports.read" },
  { to: "/reports/rider-payout", label: "Rider payout", icon: WalletCards, permission: "reports.read" },
  { to: "/rider-dashboard", label: "My dashboard", icon: LayoutDashboard, permission: "deliveries.read" },
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
  { to: "/rider-board", label: "My deliveries", icon: Bike, permission: "deliveries.read" },
  { to: "/ways", label: "Ways", icon: Route, permission: "ways.read" },
  { to: "/ways/settings", label: "Commission settings", icon: Coins, permission: "ways.read" },
  { to: "/settings/password", label: "Settings", icon: Settings },
];

/**
 * First sidebar destination the caller can actually open. Falls back to
 * Settings (ungated) so a low-permission user never lands in a redirect loop.
 */
export function firstAllowedPath(
  hasPermission: (name: PermissionKey) => boolean,
): string {
  for (const item of NAV_ITEMS) {
    if (!item.permission || hasPermission(item.permission)) return item.to;
  }
  return "/settings/password";
}
