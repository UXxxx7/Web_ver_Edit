"use client";

// Same Figma-app style left rail as before, now responsive: below `lg` it's
// a slide-out drawer behind a hamburger top bar instead of a permanently
// visible 240px column eating half a phone screen. `open` state has to live
// in a Client Component (layout.tsx stays a Server Component for the
// user/profile/lang fetch), so the whole rail — top bar, backdrop, aside —
// moved here as one unit rather than only the toggle button.
import Link from "next/link";
import { useState } from "react";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { ThemeToggle } from "@/components/ThemeToggle";
import type { Lang } from "@/lib/i18n";

const NAV = [
  {
    href: "/", label: "Dashboard",
    icon: "M4 11.5 12 4l8 7.5 M6 10v9.5h12V10",
  },
  {
    href: "/agent", label: "Agent",
    icon: "M12 3v3.5M12 17.5V21M3 12h3.5M17.5 12H21M5.8 5.8l2.5 2.5M15.7 15.7l2.5 2.5M18.2 5.8l-2.5 2.5M8.3 15.7l-2.5 2.5",
  },
  {
    href: "/editor", label: "Editor",
    icon: "M4 6.5A1.5 1.5 0 0 1 5.5 5h9A1.5 1.5 0 0 1 16 6.5v11A1.5 1.5 0 0 1 14.5 19h-9A1.5 1.5 0 0 1 4 17.5v-11Z M16 9.5l4-2.3v9.6l-4-2.3 M8 9.5l1.6 1.6L8 12.7",
  },
  {
    href: "/videos", label: "My Videos",
    icon: "M4 6.5A1.5 1.5 0 0 1 5.5 5h9A1.5 1.5 0 0 1 16 6.5v11A1.5 1.5 0 0 1 14.5 19h-9A1.5 1.5 0 0 1 4 17.5v-11Z M16 9.5l4-2.3v9.6l-4-2.3",
  },
  {
    href: "/community", label: "Community",
    icon: "M9 12a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z M3 20c1-4 3.2-6 6-6s5 2 6 6 M16.5 8a2.5 2.5 0 1 0 0-5 M15 14.5c2.2.5 3.6 2.4 4.2 5.5",
  },
  {
    href: "/profile", label: "Profile",
    icon: "M12 12a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z M5 19c1.2-3.5 4-5 7-5s5.8 1.5 7 5",
  },
];

export function AppSidebar({
  lang, userEmail, avatarUrl, avatarInitial, signOutAction,
}: {
  lang: Lang;
  userEmail: string;
  avatarUrl: string;
  avatarInitial: string;
  signOutAction: () => void;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      {/* Mobile-only top bar — the sidebar itself is `fixed` off-canvas
          below `lg`, so this is the only thing occupying normal flex flow
          on phones, giving the content area a place to start below it. */}
      <div className="flex h-14 shrink-0 items-center gap-3 border-b border-sidebar-border bg-sidebar px-4 text-sidebar-foreground lg:hidden">
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Open menu"
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
        >
          <svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M4 7h16M4 12h16M4 17h16" />
          </svg>
        </button>
        <Link href="/" className="flex items-center gap-2">
          <span className="h-[7px] w-[7px] rotate-45 rounded-[2px] bg-primary" />
          <span className="text-[14.5px] font-bold tracking-tight">OpenMontage</span>
        </Link>
      </div>

      {open && (
        <div
          className="fixed inset-0 z-30 bg-black/40 lg:hidden"
          onClick={() => setOpen(false)}
          aria-hidden
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-40 flex w-60 shrink-0 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground transition-transform duration-200 lg:static lg:translate-x-0 ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex items-center justify-between px-5 py-5">
          <Link href="/" className="flex items-center gap-2" onClick={() => setOpen(false)}>
            <span className="h-[7px] w-[7px] rotate-45 rounded-[2px] bg-primary" />
            <span className="text-[14.5px] font-bold tracking-tight">OpenMontage</span>
            <span className="rounded-full bg-muted px-2 py-0.5 font-mono text-[10.5px] font-medium uppercase tracking-wide text-muted-foreground">
              Studio
            </span>
          </Link>
          <button
            type="button"
            onClick={() => setOpen(false)}
            aria-label="Close menu"
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground lg:hidden"
          >
            <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M6 6l12 12M18 6 6 18" />
            </svg>
          </button>
        </div>
        <nav className="flex flex-col gap-0.5 px-3">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setOpen(false)}
              className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-[13.5px] font-semibold text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
            >
              <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
                <path d={item.icon} />
              </svg>
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="mt-auto border-t border-sidebar-border px-3 py-3">
          <div className="flex flex-col gap-1.5">
            <ThemeToggle />
            <LanguageSwitcher lang={lang} className="w-full [&>button]:flex-1" />
          </div>
          <Link
            href="/profile"
            onClick={() => setOpen(false)}
            className="mt-2 flex items-center gap-2 rounded-lg px-3 py-1.5 transition-colors hover:bg-sidebar-accent"
          >
            <span className="flex h-6 w-6 shrink-0 items-center justify-center overflow-hidden rounded-full bg-secondary text-[10.5px] font-bold text-secondary-foreground">
              {avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element -- data URL avatar, see AvatarUpload.tsx
                <img src={avatarUrl} alt="" className="h-full w-full object-cover" />
              ) : (
                avatarInitial || null
              )}
            </span>
            <span className="truncate text-[12px] text-muted-foreground">{userEmail}</span>
          </Link>
          <form action={signOutAction}>
            <button
              type="submit"
              className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-[13.5px] font-semibold text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
            >
              <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
                <path d="M9 4H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h3 M15 16l4-4-4-4 M19 12H9" />
              </svg>
              Sign out
            </button>
          </form>
        </div>
      </aside>
    </>
  );
}
