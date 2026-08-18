"use client";

// Light/dark switch for the app shell's sidebar (bottom-left, next to the
// account chip). AppLayout used to hardcode className="dark" on its own
// wrapper div, which silently overrode whatever next-themes' <html> class
// said — this component is the other half of that fix: next-themes'
// ThemeProvider (app/layout.tsx) already wires up system-theme detection
// and localStorage persistence, it just had nothing in the UI calling
// setTheme() yet.
import { useEffect, useState } from "react";
import { useTheme } from "next-themes";

const ICONS = {
  sun: "M12 17a5 5 0 1 0 0-10 5 5 0 0 0 0 10Z M12 2v2.5M12 19.5V22M4.2 4.2l1.8 1.8M18 18l1.8 1.8M2 12h2.5M19.5 12H22M4.2 19.8 6 18M18 6l1.8-1.8",
  moon: "M20.5 14.3A8.5 8.5 0 1 1 9.7 3.5a7 7 0 0 0 10.8 10.8Z",
};

function Icon({ path }: { path: string }) {
  return (
    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
      <path d={path} />
    </svg>
  );
}

export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  // resolvedTheme is undefined until after mount (next-themes reads
  // localStorage/system preference client-side only) — rendering a fixed
  // placeholder pre-mount avoids a server/client markup mismatch instead
  // of guessing which button should look active.
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    Promise.resolve().then(() => setMounted(true));
  }, []);

  const isDark = mounted && resolvedTheme === "dark";

  return (
    <div className="flex items-center gap-1 rounded-lg border border-sidebar-border bg-sidebar-accent/40 p-1">
      <button
        type="button"
        onClick={() => setTheme("light")}
        aria-pressed={mounted && !isDark}
        disabled={!mounted}
        className={`flex flex-1 items-center justify-center gap-1.5 rounded-md py-1.5 text-[12px] font-semibold transition-colors ${
          mounted && !isDark
            ? "bg-sidebar text-sidebar-foreground shadow-sm"
            : "text-muted-foreground hover:text-sidebar-foreground"
        }`}
      >
        <Icon path={ICONS.sun} /> Light
      </button>
      <button
        type="button"
        onClick={() => setTheme("dark")}
        aria-pressed={isDark}
        disabled={!mounted}
        className={`flex flex-1 items-center justify-center gap-1.5 rounded-md py-1.5 text-[12px] font-semibold transition-colors ${
          isDark
            ? "bg-sidebar text-sidebar-foreground shadow-sm"
            : "text-muted-foreground hover:text-sidebar-foreground"
        }`}
      >
        <Icon path={ICONS.moon} /> Dark
      </button>
    </div>
  );
}
