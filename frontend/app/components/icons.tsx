export function Icon({ name, size = 20, className = "" }: { name: string; size?: number; className?: string }) {
  const paths: Record<string, React.ReactNode> = {
    sound: <><path d="m11 4-6 5H2v6h3l6 5V4Z" /><path d="M15 8a6 6 0 0 1 0 8m3-11a10 10 0 0 1 0 14" /></>,
    characters: <><path d="M3 5h12M9 3v2m-3 3c1 4 4 7 8 9M13 5c0 6-4 10-10 12m11 4 5-12 5 12m-8-4h6" /></>,
    eye: <><path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12Z" /><circle cx="12" cy="12" r="3" /></>,
    "eye-off": <><path d="m3 3 18 18M10 5h2c6 0 10 7 10 7a20 20 0 0 1-3 4M6 6a22 22 0 0 0-4 6s4 7 10 7c2 0 3-.5 5-1.5M10 10a3 3 0 0 0 4 4" /></>,
    grid: <><rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="3" width="7" height="7" rx="1.5" /><rect x="3" y="14" width="7" height="7" rx="1.5" /><rect x="14" y="14" width="7" height="7" rx="1.5" /></>,
    book: <><path d="M12 5c-3-2-6-2-9-1v15c3-1 6-1 9 1 3-2 6-2 9-1V4c-3-1-6-1-9 1Z" /><path d="M12 5v15" /></>,
    cards: <><rect x="7" y="6" width="13" height="15" rx="2" /><path d="M16 3H5a2 2 0 0 0-2 2v12M11 11h5m-5 4h3" /></>,
    chart: <path d="M4 3v17h17M8 15l4-5 4 2 5-7" />,
    spark: <path d="m12 3 2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5L12 3ZM20 2v4m-2-2h4" />,
    plug: <path d="m8 3 3 3m5-3-3 3M7 7h10v5a5 5 0 0 1-10 0V7Zm5 10v5" />,
    arrow: <path d="M4 12h15m-6-6 6 6-6 6" />,
    chevron: <path d="m9 5 7 7-7 7" />,
    down: <path d="m6 9 6 6 6-6" />,
    flame: <path d="M12 2c2 5-2 6 1 9 2-1 3-3 3-5 7 7 6 16-4 16C2 22 1 14 7 9c0 4 1 5 2 5 3-3-1-6 3-12Z" />,
    clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
    check: <path d="m5 12 4 4L19 6" />,
    leaf: <path d="M20 3C8 1 2 8 6 15s16 2 14-12ZM4 21 16 8" />,
    search: <><circle cx="10" cy="10" r="6" /><path d="m15 15 5 5" /></>,
    info: <><circle cx="12" cy="12" r="9" /><path d="M12 11v6m0-10v1" /></>,
    mountain: <path d="m2 20 7-13 4 7 3-5 6 11H2Zm4-7 3 1 2-3" />,
  };
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.65" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">{paths[name] ?? paths.book}</svg>;
}
