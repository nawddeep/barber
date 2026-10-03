import { CalendarIcon, DashboardIcon, ListIcon, PinIcon, ScissorsIcon, SettingsIcon, UsersIcon, WalletIcon } from "@/components/ui";

export const ADMIN_NAV = [
  { href: "/admin", label: "Dashboard", icon: DashboardIcon, exact: true },
  { href: "/admin/bookings", label: "Bookings", icon: ListIcon },
  { href: "/admin/calendar", label: "Calendar", icon: CalendarIcon },
  { href: "/admin/branches", label: "Branches & fees", icon: PinIcon, ownerOnly: true },
  { href: "/admin/barbers", label: "Barbers", icon: ScissorsIcon },
  { href: "/admin/customers", label: "Customers", icon: UsersIcon },
  { href: "/admin/payments", label: "Payments", icon: WalletIcon },
  { href: "/admin/settings", label: "Settings", icon: SettingsIcon },
] as const;

export const isActive = (pathname: string, item: { href: string; exact?: boolean }) =>
  item.exact ? pathname === item.href : pathname === item.href || pathname.startsWith(`${item.href}/`);
