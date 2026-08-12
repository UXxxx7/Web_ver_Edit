import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { signOutAction } from "./actions";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login"); // proxy.ts already guards this; belt-and-suspenders for direct server-render.

  return (
    <div className="flex min-h-dvh flex-col bg-background">
      <nav className="flex shrink-0 items-center justify-between border-b border-border bg-card px-5 py-3">
        <Link href="/" className="flex items-center gap-2">
          <span className="h-[7px] w-[7px] rotate-45 rounded-[2px] bg-primary" />
          <span className="text-[14.5px] font-bold tracking-tight">OpenMontage</span>
          <span className="rounded-full bg-muted px-2 py-0.5 font-mono text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            Studio
          </span>
        </Link>
        <div className="flex items-center gap-1 text-[13.5px]">
          <Link href="/" className="rounded-md px-3 py-1.5 font-semibold text-muted-foreground hover:bg-accent hover:text-foreground">
            Dashboard
          </Link>
          <Link href="/profile" className="rounded-md px-3 py-1.5 font-semibold text-muted-foreground hover:bg-accent hover:text-foreground">
            Profile
          </Link>
          <span className="mx-1 hidden text-muted-foreground sm:inline">{user.email}</span>
          <form action={signOutAction}>
            <button
              type="submit"
              className="rounded-md px-3 py-1.5 font-semibold text-muted-foreground hover:bg-accent hover:text-foreground"
            >
              Sign out
            </button>
          </form>
        </div>
      </nav>
      <div className="flex-1">{children}</div>
    </div>
  );
}
