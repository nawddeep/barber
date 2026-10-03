import type { SVGProps } from "react";

export type IconProps = Omit<SVGProps<SVGSVGElement>, "children"> & { size?: number };

function make(name: string, paths: React.ReactNode) {
  const Icon = ({ size = 20, ...rest }: IconProps) => (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden={rest["aria-label"] ? undefined : true}
      focusable="false"
      {...rest}
    >
      {paths}
    </svg>
  );
  Icon.displayName = name;
  return Icon;
}

export const ScissorsIcon = make("ScissorsIcon", (
  <>
    <circle cx="6" cy="6" r="2.6" />
    <circle cx="6" cy="18" r="2.6" />
    <path d="M8 7.8 20 18M8 16.2 20 6" />
  </>
));
export const PinIcon = make("PinIcon", (
  <>
    <path d="M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 0 1 13 0c0 5.4-6.5 11-6.5 11Z" />
    <circle cx="12" cy="10" r="2.3" />
  </>
));
export const CalendarIcon = make("CalendarIcon", (
  <>
    <rect x="3.5" y="5" width="17" height="15.5" rx="3" />
    <path d="M3.5 10h17M8 3v4M16 3v4" />
  </>
));
export const PhoneIcon = make("PhoneIcon", (
  <path d="M5 4h3.5l1.7 4.3-2.2 1.4a11 11 0 0 0 6.3 6.3l1.4-2.2L20 15.5V19a1.5 1.5 0 0 1-1.6 1.5C10.7 20 4 13.3 3.5 5.6A1.5 1.5 0 0 1 5 4Z" />
));
export const ChatIcon = make("ChatIcon", (
  <path d="M4 5.5A2.5 2.5 0 0 1 6.5 3h11A2.5 2.5 0 0 1 20 5.5v8a2.5 2.5 0 0 1-2.5 2.5H10l-4.5 4v-4H6.5A2.5 2.5 0 0 1 4 13.5v-8Z" />
));
export const CheckIcon = make("CheckIcon", <path d="m5 12.5 4.5 4.5L19 7.5" />);
export const ArrowRightIcon = make("ArrowRightIcon", <path d="M4 12h15M13 6l6 6-6 6" />);
export const ArrowLeftIcon = make("ArrowLeftIcon", <path d="M20 12H5M11 6l-6 6 6 6" />);
export const StarIcon = make("StarIcon", (
  <path d="m12 3.5 2.6 5.4 5.9.8-4.3 4.1 1 5.9L12 16.9l-5.2 2.8 1-5.9L3.5 9.7l5.9-.8L12 3.5Z" />
));
export const UserIcon = make("UserIcon", (
  <>
    <circle cx="12" cy="8" r="4" />
    <path d="M4.5 20.5c.8-4 4-6 7.5-6s6.7 2 7.5 6" />
  </>
));
export const SettingsIcon = make("SettingsIcon", (
  <>
    <path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M5.6 18.4l2.1-2.1M16.3 7.7l2.1-2.1" />
    <circle cx="12" cy="12" r="1.6" />
  </>
));
export const DashboardIcon = make("DashboardIcon", (
  <>
    <rect x="3.5" y="3.5" width="7" height="9" rx="2" />
    <rect x="13.5" y="3.5" width="7" height="5" rx="2" />
    <rect x="13.5" y="11.5" width="7" height="9" rx="2" />
    <rect x="3.5" y="15.5" width="7" height="5" rx="2" />
  </>
));
export const ListIcon = make("ListIcon", (
  <path d="M9 6h11M9 12h11M9 18h11M4 6h.01M4 12h.01M4 18h.01" />
));
export const WalletIcon = make("WalletIcon", (
  <>
    <rect x="3" y="5.5" width="18" height="13" rx="3" />
    <path d="M3 10h18M7 15h3" />
  </>
));
export const SearchIcon = make("SearchIcon", (
  <>
    <circle cx="11" cy="11" r="6.5" />
    <path d="m16 16 4.5 4.5" />
  </>
));
export const BoltIcon = make("BoltIcon", <path d="M13 3 5 13.5h6L10 21l8-10.5h-6L13 3Z" />);
export const CloseIcon = make("CloseIcon", <path d="M6 6l12 12M18 6 6 18" />);
export const ChevronUpDownIcon = make("ChevronUpDownIcon", <path d="m8 9 4-4 4 4M8 15l4 4 4-4" />);
export const HomeIcon = make("HomeIcon", (
  <path d="M4 11 12 4l8 7v8.5a1 1 0 0 1-1 1h-4.5v-6h-5v6H5a1 1 0 0 1-1-1V11Z" />
));
export const UsersIcon = make("UsersIcon", (
  <>
    <circle cx="9" cy="8" r="3.5" />
    <path d="M2.5 20c.7-3.6 3.4-5.3 6.5-5.3s5.8 1.7 6.5 5.3M16 4.7a3.5 3.5 0 0 1 0 6.6M18 14.9c1.8.7 3 2.3 3.5 5.1" />
  </>
));
