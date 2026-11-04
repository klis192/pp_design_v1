export function ActionIcon({
  name,
}: {
  name:
    | "filter"
    | "settings"
    | "back"
    | "close"
    | "download"
    | "prev"
    | "next"
    | "edit"
    | "list"
    | "board"
    | "plus"
    | "delete"
    | "document"
    | "key"
    | "power"
    | "check"
    | "link"
    | "send"
    | "upload"
    | "refresh"
    | "search"
    | "more"
    | "help"
    | "print"
    | "calendar";
}) {
  const paths = {
    filter: (
      <>
        <path d="M3 4h18l-7 8v7l-4 2v-9Z" />
      </>
    ),
    settings: (
      <>
        <path d="M4 7h16M4 17h16" />
        <circle cx="9" cy="7" r="3" />
        <circle cx="15" cy="17" r="3" />
      </>
    ),
    back: <path d="m10 5-7 7 7 7M3 12h18" />,
    close: <path d="m6 6 12 12M18 6 6 18" />,
    prev: <path d="m14 6-6 6 6 6" />,
    next: <path d="m10 6 6 6-6 6" />,
    plus: <path d="M12 4v16M4 12h16" />,
    delete: <path d="M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7M14 10v7" />,
    document: <path d="M5 3h9l5 5v13H5ZM14 3v6h5M8 13h8M8 17h6" />,
    key: (
      <>
        <circle cx="8" cy="8" r="5" />
        <path d="m12 12 9 9M16 16l3-3M18 18l3-3" />
      </>
    ),
    power: <path d="M12 2v10M6 5a9 9 0 1 0 12 0" />,
    check: <path d="m4 12 5 5L20 6" />,
    link: (
      <path d="m10 13 4-4M8 15l-1 1a4 4 0 0 1-6-6l5-5a4 4 0 0 1 6 0M16 9l1-1a4 4 0 0 1 6 6l-5 5a4 4 0 0 1-6 0" />
    ),
    send: <path d="m3 3 18 9-18 9 4-9Zm4 9h14" />,
    upload: <path d="M12 16V3m-5 5 5-5 5 5M4 16v5h16v-5" />,
    refresh: <path d="M20 7V3l-3 3a8 8 0 1 0 3 9M20 3h-5" />,
    search: (
      <>
        <circle cx="10" cy="10" r="6" />
        <path d="m15 15 6 6" />
      </>
    ),
    more: (
      <>
        <circle cx="5" cy="12" r="1" />
        <circle cx="12" cy="12" r="1" />
        <circle cx="19" cy="12" r="1" />
      </>
    ),
    help: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M9 8a3 3 0 0 1 6 1c0 2-3 2-3 4M12 17h.01" />
      </>
    ),
    print: (
      <>
        <path d="M7 8V3h10v5M7 17H3V9h18v8h-4M7 14h10v7H7Z" />
        <path d="M17 11h.01" />
      </>
    ),
    calendar: (
      <>
        <rect x="3" y="5" width="18" height="16" rx="1" />
        <path d="M7 2v6M17 2v6M3 11h18M7 15h2M13 15h2M7 18h2" />
      </>
    ),
    edit: <path d="m15 4 5 5M4 20l5-1L20 8a3.5 3.5 0 0 0-5-5L4 14Z" />,
    list: <path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" />,
    board: (
      <>
        <rect x="3" y="4" width="5" height="16" rx="1" />
        <rect x="10" y="4" width="5" height="11" rx="1" />
        <rect x="17" y="4" width="4" height="14" rx="1" />
      </>
    ),
    download: (
      <>
        <path d="M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5" />
      </>
    ),
  };
  return (
    <svg
      viewBox="0 0 24 24"
      width="18"
      height="18"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {paths[name]}
    </svg>
  );
}
