export function Logo({ light = false }: { light?: boolean }) {
  return (
    <span className="inline-flex items-center gap-2">
      <span
        className="grid h-8 w-8 place-items-center rounded-md"
        style={{ background: light ? "#14110c" : "#defa3b", color: light ? "#defa3b" : "#14110c" }}
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
          <rect x="1" y="3" width="6" height="5" rx="1.2" fill="currentColor" />
          <rect x="9" y="3" width="6" height="5" rx="1.2" fill="currentColor" opacity="0.55" />
          <rect x="1" y="10" width="14" height="3" rx="1.2" fill="currentColor" />
        </svg>
      </span>
      <span className="display text-lg font-semibold tracking-tight">Quorum</span>
    </span>
  );
}
