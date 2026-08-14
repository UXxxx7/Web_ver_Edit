import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { signOutAction } from "./actions";

// Hand-drawn line icons, same treatment as the rest of the app (Dashboard /
// FeatureHub / TemplateGallery) — no emoji, no stock icon set.
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

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login"); // proxy.ts already guards this; belt-and-suspenders for direct server-render.

  return (
    <div className="force-light flex h-dvh bg-background text-foreground">
      {/* Figma-app style left rail, not a top bar — logo, nav items with
          icon+label, account chip pinned to the bottom. */}
      <aside className="flex w-60 shrink-0 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground">
        <Link href="/" className="flex items-center gap-2 px-5 py-5">
          <span className="h-[7px] w-[7px] rotate-45 rounded-[2px] bg-primary" />
          <span className="text-[14.5px] font-bold tracking-tight">OpenMontage</span>
          <span className="rounded-full bg-muted px-2 py-0.5 font-mono text-[10.5px] font-medium uppercase tracking-wide text-muted-foreground">
            Studio
          </span>
        </Link>
        <nav className="flex flex-col gap-0.5 px-3">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
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
          <div className="truncate px-3 py-1 text-[12px] text-muted-foreground">{user.email}</div>
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

      <div className="flex-1 overflow-y-auto">{children}</div>
    </div>
  );
}
