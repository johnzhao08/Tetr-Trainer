export function SettingsButton({ onClick }: { onClick: () => void }) {
  return (
    <button className="button quiet" onClick={onClick}>
      <svg
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M4 7h16M4 17h16" />
        <path d="M9 4v6M15 14v6" />
      </svg>
      Settings
    </button>
  );
}
