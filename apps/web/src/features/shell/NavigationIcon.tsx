type Name =
  | "dashboard"
  | "tickets"
  | "objects"
  | "units"
  | "tenants"
  | "leases"
  | "agenda"
  | "operations"
  | "notifications"
  | "staff"
  | "import"
  | "profile"
  | "billing"
  | "chat"
  | "logout"
  | "menu"
  | "close"
  | "forward";
const paths: Record<Name, string> = {
  forward: "M9 5l7 7-7 7",
  dashboard: "M3 10 12 3l9 7v10a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1Z",
  tickets: "M9 4h6m-6 0H5v17h14V4h-4M9 3h6v4H9ZM8 12h8M8 16h5",
  billing: "M4 5h16v15H4ZM4 9h16M14 14h3",
  chat: "M4 4h16v13H9l-5 4ZM8 9h8M8 13h5",
  objects: "M3 21V9l9-6 9 6v12ZM8 21v-8h8v8M7 9h.01M12 9h.01M17 9h.01M12 13v8",
  units: "M3 3h18v18H3ZM3 11h18M12 3v18M7 7h.01M7 16h.01M17 7h.01M17 16h.01",
  tenants:
    "M8 21v-3a4 4 0 0 1 8 0v3M6 21H3v-3a4 4 0 0 1 3-4M18 14a4 4 0 0 1 3 4v3h-3M12 3a4 4 0 1 0 0 8 4 4 0 0 0 0-8Z",
  leases: "M5 3h10l4 4v14H5ZM14 3v5h5M8 12h8M8 16h5",
  agenda: "M4 5h16v16H4ZM8 3v4M16 3v4M4 10h16M8 14h2M14 14h2M8 18h2",
  operations:
    "m14 5 5-2a6 6 0 0 1-7 8L5 21l-3-3 10-8a6 6 0 0 1 3-7ZM3 3l6 6M3 3v4M3 3h4",
  notifications: "M5 17h14l-2-3V9a5 5 0 0 0-10 0v5ZM10 21h4M12 2v2",
  staff:
    "M4 21v-2a5 5 0 0 1 10 0v2M9 3a4 4 0 1 0 0 8 4 4 0 0 0 0-8ZM16 10h6M19 7v6M17 18h5",
  import: "M4 3h10l4 4v4M4 3v18h8M13 3v5h5M14 16h8m-3-3 3 3-3 3",
  profile: "M4 21v-2a8 8 0 0 1 16 0v2M12 3a4 4 0 1 0 0 8 4 4 0 0 0 0-8Z",
  logout: "M10 4H4v16h6M10 12h11m-4-4 4 4-4 4",
  menu: "M4 6h16M4 12h16M4 18h16",
  close: "m6 6 12 12M18 6 6 18",
};
export function NavigationIcon({ name }: { name: Name }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="22"
      height="22"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <path d={paths[name]} />
    </svg>
  );
}
