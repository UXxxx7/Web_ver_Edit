import { requireUser } from "@/lib/auth";

// Placeholder — the nav entry exists so the section is visible/demoable,
// but this isn't the real feature. The team already built a working
// Community feed (post/comment on videos) on origin/main
// (components/CommunityFeed.tsx, lib/community.ts) that this branch hasn't
// pulled in yet. Swap this page for that once it's merged in, rather than
// building a second competing implementation here.
export default async function CommunityPage() {
  await requireUser();
  return (
    <div className="dash">
      <div className="px-4 py-16 sm:px-8">
        <div className="mx-auto max-w-md rounded-2xl border border-border bg-card p-8 text-center shadow-[0_3px_16px_-6px_rgba(15,27,60,0.12)]">
          <span
            className="mx-auto inline-flex h-11 w-11 items-center justify-center rounded-lg"
            style={{ background: "color-mix(in srgb, #3E63FF 12%, transparent)", color: "#3E63FF" }}
          >
            <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 12a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z M3 20c1-4 3.2-6 6-6s5 2 6 6 M16.5 8a2.5 2.5 0 1 0 0-5 M15 14.5c2.2.5 3.6 2.4 4.2 5.5" />
            </svg>
          </span>
          <h2 className="mt-4 text-lg font-bold text-foreground">社群功能就快出</h2>
          <p className="mt-1.5 text-[13px] leading-relaxed text-muted-foreground">
            大家可以係到分享自己嘅片、互相留言交流。呢部分仲喺開發緊。
          </p>
        </div>
      </div>
    </div>
  );
}
