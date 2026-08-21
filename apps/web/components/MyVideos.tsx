"use client";

// The account-level save area: every video that finished rendering in
// Agent lands here (GET /users/{id}/videos → apps/api's
// job_manager.list_done_jobs_for_user), independent of which browser/
// device you're on. Editing is a deliberate opt-in from here — click
// "Edit" (or select several and "Add to editor") to send a video to the
// Editor page's work queue (lib/editor-queue.ts); Editor no longer
// auto-lists every job on its own, which used to duplicate this list.
// Editing re-renders the SAME job in place (apps/api's manual editor has
// no multi-clip merge), so the updated result reappears right here, in
// the same card, next time this list is fetched — not as a new entry.
//
// Search/sort/rename/delete/list-view/hover-preview/duration badges are
// all client-side/local-state affairs on top of the one `videos` fetch —
// rename and delete are the two that round-trip to apps/api
// (renameVideoAction/deleteVideoAction), mutating local state on success
// rather than refetching the whole list.
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { deleteVideoAction, getMyVideosAction, renameVideoAction } from "@/app/(app)/agent/actions";
import { GenerateCaptionButton } from "@/components/GenerateCaptionButton";
import { ShareToCommunityPanel } from "@/components/ShareToCommunityPanel";
import { addToEditorQueue } from "@/lib/editor-queue";
import { basename, type SavedVideo } from "@/lib/edit-jobs";
import type { Lang } from "@/lib/i18n";
import { relativeTime } from "@/lib/relative-time";

type SortBy = "newest" | "oldest" | "az";
type ViewMode = "grid" | "list";

const ICONS = {
  check: "M5 12.5 10 17l9-10",
  share: "M12 19V5 M5 12l7-7 7 7",
  search: "M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14Z M16.2 16.2 21 21",
  pencil: "M4 17.5V20h2.5L18.4 8.1a1.5 1.5 0 0 0 0-2.1l-.4-.4a1.5 1.5 0 0 0-2.1 0L4 17.5Z M13.5 6.5l3 3",
  trash: "M4 7h16 M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2 M7 7l1 13a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1l1-13 M10 11v6 M14 11v6",
  grid: "M4 5.5A1.5 1.5 0 0 1 5.5 4h4A1.5 1.5 0 0 1 11 5.5v4A1.5 1.5 0 0 1 9.5 11h-4A1.5 1.5 0 0 1 4 9.5v-4Z M13 5.5A1.5 1.5 0 0 1 14.5 4h4A1.5 1.5 0 0 1 20 5.5v4A1.5 1.5 0 0 1 18.5 11h-4A1.5 1.5 0 0 1 13 9.5v-4Z M4 14.5A1.5 1.5 0 0 1 5.5 13h4a1.5 1.5 0 0 1 1.5 1.5v4A1.5 1.5 0 0 1 9.5 20h-4A1.5 1.5 0 0 1 4 18.5v-4Z M13 14.5a1.5 1.5 0 0 1 1.5-1.5h4a1.5 1.5 0 0 1 1.5 1.5v4a1.5 1.5 0 0 1-1.5 1.5h-4a1.5 1.5 0 0 1-1.5-1.5v-4Z",
  list: "M4 6h16M4 12h16M4 18h16",
  download: "M12 3v13 M7 11l5 5 5-5 M4 20h16",
  // Same path as AppSidebar.tsx's Editor nav icon — "send to editor" and
  // the Editor nav item should read as the same destination, not collide
  // visually with the rename pencil.
  editor: "M4 6.5A1.5 1.5 0 0 1 5.5 5h9A1.5 1.5 0 0 1 16 6.5v11A1.5 1.5 0 0 1 14.5 19h-9A1.5 1.5 0 0 1 4 17.5v-11Z M16 9.5l4-2.3v9.6l-4-2.3 M8 9.5l1.6 1.6L8 12.7",
};

function Icon({ path, size = 14 }: { path: string; size?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
      <path d={path} />
    </svg>
  );
}

function formatDuration(seconds: number): string {
  const total = Math.round(seconds);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

const T = {
  zh: {
    loading: "載入緊…",
    emptyTitle: "仲未有片",
    emptyBody: "上載一條片同AI講點剪，完成之後會自動喺呢度出現。",
    emptyCta: "去Agent剪片",
    heading: "我的影片",
    sub: "已經完成嘅片，可以隨時下載、分享，或者揀返去編輯器再調整。",
    addToEditor: (n: number) => `加入編輯器（${n}）`,
    downloadSelected: (n: number) => `下載（${n}）`,
    deleteSelected: (n: number) => `刪除（${n}）`,
    deselect: "取消選取",
    select: "選取",
    download: "下載",
    linkCopied: "已複製連結",
    share: "分享",
    edit: "編輯",
    rename: "改名",
    deleteOne: "刪除",
    postToCommunity: "貼上社群",
    searchPh: "搜尋你嘅片…",
    noSearchResults: "搵唔到相關嘅片。",
    sortNewest: "最新優先",
    sortOldest: "最舊優先",
    sortAz: "A-Z",
    confirmDeleteOne: "刪除呢條片？呢個動作冇得復原。",
    confirmDeleteSelected: (n: number) => `刪除呢 ${n} 條片？呢個動作冇得復原。`,
    renamePlaceholder: "改個名…",
  },
  en: {
    loading: "Loading…",
    emptyTitle: "No videos yet",
    emptyBody: "Upload a video and tell AI how to edit it — finished ones show up here automatically.",
    emptyCta: "Go edit in Agent",
    heading: "My Videos",
    sub: "Finished videos — download, share, or send back to the editor for another pass any time.",
    addToEditor: (n: number) => `Add to editor (${n})`,
    downloadSelected: (n: number) => `Download (${n})`,
    deleteSelected: (n: number) => `Delete (${n})`,
    deselect: "Deselect",
    select: "Select",
    download: "Download",
    linkCopied: "Link copied",
    share: "Share",
    edit: "Edit",
    rename: "Rename",
    deleteOne: "Delete",
    postToCommunity: "Post to Community",
    searchPh: "Search your videos…",
    noSearchResults: "No matching videos.",
    sortNewest: "Newest first",
    sortOldest: "Oldest first",
    sortAz: "A-Z",
    confirmDeleteOne: "Delete this video? This can't be undone.",
    confirmDeleteSelected: (n: number) => `Delete these ${n} videos? This can't be undone.`,
    renamePlaceholder: "Rename…",
  },
} satisfies Record<Lang, {
  loading: string; emptyTitle: string; emptyBody: string; emptyCta: string; heading: string; sub: string;
  addToEditor: (n: number) => string; downloadSelected: (n: number) => string; deleteSelected: (n: number) => string;
  deselect: string; select: string; download: string; linkCopied: string; share: string; edit: string;
  rename: string; deleteOne: string; postToCommunity: string; searchPh: string; noSearchResults: string;
  sortNewest: string; sortOldest: string; sortAz: string; confirmDeleteOne: string;
  confirmDeleteSelected: (n: number) => string; renamePlaceholder: string;
}>;

function fileUrl(jobId: string, path: string | null) {
  const name = basename(path);
  return name ? `/api/edit-files/${jobId}/${encodeURIComponent(name)}` : null;
}

function displayTitle(video: SavedVideo): string {
  return video.title || video.edit_request;
}

function ShareButton({ url, t, className }: { url: string; t: (typeof T)[Lang]; className?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={() => {
        navigator.clipboard.writeText(url).then(() => {
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        });
      }}
      className={className ?? "flex-1 rounded-lg border border-border px-3 py-1.5 text-[12.5px] font-semibold text-foreground transition-colors hover:border-primary/50"}
    >
      {copied ? t.linkCopied : t.share}
    </button>
  );
}

export function MyVideos({ lang }: { lang: Lang }) {
  const t = T[lang];
  const router = useRouter();
  const [videos, setVideos] = useState<SavedVideo[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  // Which card has its "post to Community" panel expanded — at most one at
  // a time, same reasoning as CommunityFeed's own single-compose-open UX.
  const [postOpenFor, setPostOpenFor] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState<SortBy>("newest");
  const [viewMode, setViewMode] = useState<ViewMode>("grid");
  const [durations, setDurations] = useState<Record<string, number>>({});
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameDraft, setRenameDraft] = useState("");
  const renameInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    getMyVideosAction().then((result) => {
      if (result.ok) setVideos(result.data);
      else setError(result.error);
    });
  }, []);

  useEffect(() => {
    if (renamingId) renameInputRef.current?.focus();
  }, [renamingId]);

  function toggleSelected(jobId: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(jobId)) next.delete(jobId);
      else next.add(jobId);
      return next;
    });
  }

  function editOne(jobId: string) {
    addToEditorQueue(jobId);
    router.push("/editor");
  }

  function editSelected() {
    selected.forEach((jobId) => addToEditorQueue(jobId));
    router.push("/editor");
  }

  function downloadSelected() {
    if (!videos) return;
    for (const video of videos) {
      if (!selected.has(video.job_id)) continue;
      const url = fileUrl(video.job_id, video.final_path);
      if (!url) continue;
      const a = document.createElement("a");
      a.href = url;
      a.download = "";
      document.body.appendChild(a);
      a.click();
      a.remove();
    }
  }

  function startRename(video: SavedVideo) {
    setRenamingId(video.job_id);
    setRenameDraft(displayTitle(video));
  }

  async function submitRename(jobId: string) {
    const title = renameDraft.trim();
    setRenamingId(null);
    const result = await renameVideoAction(jobId, title);
    if (result.ok) {
      setVideos((prev) => prev?.map((v) => (v.job_id === jobId ? { ...v, title: result.data.title } : v)) ?? prev);
    }
  }

  async function removeOne(jobId: string) {
    if (!window.confirm(t.confirmDeleteOne)) return;
    const result = await deleteVideoAction(jobId);
    if (result.ok) {
      setVideos((prev) => prev?.filter((v) => v.job_id !== jobId) ?? prev);
      setSelected((prev) => {
        const next = new Set(prev);
        next.delete(jobId);
        return next;
      });
    }
  }

  async function removeSelected() {
    if (!window.confirm(t.confirmDeleteSelected(selected.size))) return;
    const ids = [...selected];
    await Promise.all(ids.map((id) => deleteVideoAction(id)));
    setVideos((prev) => prev?.filter((v) => !selected.has(v.job_id)) ?? prev);
    setSelected(new Set());
  }

  if (videos === null) {
    return (
      <div className="px-4 py-16 text-center text-[13.5px] text-muted-foreground sm:px-8">
        {error ? error : t.loading}
      </div>
    );
  }

  if (videos.length === 0) {
    return (
      <div className="px-4 py-16 sm:px-8">
        <div className="mx-auto max-w-md rounded-2xl border border-border bg-card p-8 text-center shadow-[0_3px_16px_-6px_rgba(15,27,60,0.12)]">
          <h2 className="text-lg font-bold text-foreground">{t.emptyTitle}</h2>
          <p className="mt-1.5 text-[13px] leading-relaxed text-muted-foreground">
            {t.emptyBody}
          </p>
          <a
            href="/agent"
            className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-foreground px-5 py-2.5 text-[13.5px] font-semibold text-background transition-transform hover:-translate-y-px"
          >
            {t.emptyCta}
          </a>
        </div>
      </div>
    );
  }

  const query = search.trim().toLowerCase();
  const shown = videos
    .filter((v) => !query || displayTitle(v).toLowerCase().includes(query))
    .sort((a, b) => {
      if (sortBy === "az") return displayTitle(a).localeCompare(displayTitle(b));
      const aTime = a.created_at ?? "";
      const bTime = b.created_at ?? "";
      return sortBy === "newest" ? bTime.localeCompare(aTime) : aTime.localeCompare(bTime);
    });

  return (
    <div className="px-4 py-8 pb-24 sm:px-8">
      <div className="mx-auto max-w-5xl">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-2xl font-bold tracking-tight text-foreground">{t.heading}</h2>
            <p className="mt-1 text-[13px] text-muted-foreground">{t.sub}</p>
          </div>
          {selected.size > 0 && (
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={downloadSelected}
                className="rounded-lg border border-border px-4 py-2 text-[13px] font-semibold text-foreground transition-colors hover:border-primary/50"
              >
                {t.downloadSelected(selected.size)}
              </button>
              <button
                type="button"
                onClick={removeSelected}
                className="rounded-lg border border-border px-4 py-2 text-[13px] font-semibold text-destructive transition-colors hover:border-destructive/50"
              >
                {t.deleteSelected(selected.size)}
              </button>
              <button
                type="button"
                onClick={editSelected}
                className="rounded-lg bg-foreground px-4 py-2 text-[13px] font-semibold text-background transition-transform hover:-translate-y-px"
              >
                {t.addToEditor(selected.size)}
              </button>
            </div>
          )}
        </div>

        {/* Search + sort + grid/list toggle — becomes necessary the moment
            this library grows past a screenful, same as any file browser. */}
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <div className="flex min-w-[200px] flex-1 items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-2">
            <Icon path={ICONS.search} size={14} />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t.searchPh}
              className="min-w-0 flex-1 bg-transparent text-[13px] text-foreground outline-none placeholder:text-muted-foreground"
            />
          </div>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as SortBy)}
            className="rounded-lg border border-border bg-card px-2.5 py-2 text-[12.5px] font-medium text-foreground outline-none transition-colors focus-visible:border-primary"
          >
            <option value="newest">{t.sortNewest}</option>
            <option value="oldest">{t.sortOldest}</option>
            <option value="az">{t.sortAz}</option>
          </select>
          <div className="flex items-center gap-0.5 rounded-lg border border-border p-0.5">
            <button
              type="button"
              onClick={() => setViewMode("grid")}
              aria-pressed={viewMode === "grid"}
              className={`flex h-8 w-8 items-center justify-center rounded-md transition-colors ${viewMode === "grid" ? "bg-secondary text-foreground" : "text-muted-foreground hover:text-foreground"}`}
            >
              <Icon path={ICONS.grid} size={15} />
            </button>
            <button
              type="button"
              onClick={() => setViewMode("list")}
              aria-pressed={viewMode === "list"}
              className={`flex h-8 w-8 items-center justify-center rounded-md transition-colors ${viewMode === "list" ? "bg-secondary text-foreground" : "text-muted-foreground hover:text-foreground"}`}
            >
              <Icon path={ICONS.list} size={15} />
            </button>
          </div>
        </div>

        {shown.length === 0 && (
          <p className="mt-8 text-center text-[13.5px] text-muted-foreground">{t.noSearchResults}</p>
        )}

        {viewMode === "grid" ? (
          <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {shown.map((video) => {
              const url = fileUrl(video.job_id, video.final_path);
              const isSelected = selected.has(video.job_id);
              const duration = durations[video.job_id];
              return (
                <div
                  key={video.job_id}
                  className={`overflow-hidden rounded-2xl border bg-card shadow-[0_3px_16px_-6px_rgba(15,27,60,0.12)] transition-colors ${
                    isSelected ? "border-primary" : "border-border"
                  }`}
                >
                  <div
                    className="relative"
                    onMouseEnter={(e) => e.currentTarget.querySelector("video")?.play().catch(() => {})}
                    onMouseLeave={(e) => {
                      const v = e.currentTarget.querySelector("video");
                      if (v) { v.pause(); v.currentTime = 0; }
                    }}
                  >
                    {url && (
                      <video
                        controls
                        muted
                        loop
                        preload="metadata"
                        src={url}
                        className="aspect-[9/16] w-full bg-black object-cover"
                        onLoadedMetadata={(e) => { const dur = e.currentTarget.duration; setDurations((d) => ({ ...d, [video.job_id]: dur })); }}
                      />
                    )}
                    <button
                      type="button"
                      onClick={() => toggleSelected(video.job_id)}
                      aria-pressed={isSelected}
                      aria-label={isSelected ? t.deselect : t.select}
                      className={`absolute left-2.5 top-2.5 flex h-6 w-6 items-center justify-center rounded-md border-2 transition-colors ${
                        isSelected
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-white/70 bg-black/30 text-transparent hover:border-white"
                      }`}
                    >
                      <Icon path={ICONS.check} size={14} />
                    </button>
                    {duration ? (
                      <span className="absolute bottom-2 right-2 rounded bg-black/70 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-white">
                        {formatDuration(duration)}
                      </span>
                    ) : null}
                  </div>
                  <div className="p-4">
                    {renamingId === video.job_id ? (
                      <input
                        ref={renameInputRef}
                        type="text"
                        value={renameDraft}
                        onChange={(e) => setRenameDraft(e.target.value)}
                        onBlur={() => submitRename(video.job_id)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") submitRename(video.job_id);
                          if (e.key === "Escape") setRenamingId(null);
                        }}
                        placeholder={t.renamePlaceholder}
                        className="w-full rounded-md border border-primary bg-transparent px-1.5 py-0.5 text-[13px] text-foreground outline-none"
                      />
                    ) : (
                      <button
                        type="button"
                        onClick={() => startRename(video)}
                        className="group flex w-full items-start gap-1 text-left"
                        title={t.rename}
                      >
                        <p className="line-clamp-2 flex-1 text-[13px] leading-snug text-foreground">{displayTitle(video)}</p>
                        <Icon path={ICONS.pencil} size={11} />
                      </button>
                    )}
                    <p className="mt-0.5 text-[11px] text-muted-foreground">{relativeTime(video.created_at, lang)}</p>
                    <div className="mt-3 flex gap-2">
                      {url && (
                        <a
                          href={url}
                          download
                          className="flex-1 rounded-lg bg-primary px-3 py-1.5 text-center text-[12.5px] font-semibold text-primary-foreground transition-transform hover:-translate-y-px"
                        >
                          {t.download}
                        </a>
                      )}
                      {url && <ShareButton url={url} t={t} />}
                      <button
                        type="button"
                        onClick={() => editOne(video.job_id)}
                        className="flex-1 rounded-lg border border-border px-3 py-1.5 text-[12.5px] font-semibold text-foreground transition-colors hover:border-primary/50"
                      >
                        {t.edit}
                      </button>
                      <button
                        type="button"
                        onClick={() => removeOne(video.job_id)}
                        aria-label={t.deleteOne}
                        title={t.deleteOne}
                        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-border text-muted-foreground transition-colors hover:border-destructive/50 hover:text-destructive"
                      >
                        <Icon path={ICONS.trash} size={14} />
                      </button>
                    </div>

                    <div className="mt-2">
                      <GenerateCaptionButton jobId={video.job_id} lang={lang} />
                    </div>

                    {postOpenFor === video.job_id ? (
                      <div className="mt-2">
                        <ShareToCommunityPanel jobId={video.job_id} lang={lang} />
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setPostOpenFor(video.job_id)}
                        className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-[12.5px] font-semibold text-foreground transition-colors hover:border-primary/50"
                      >
                        <Icon path={ICONS.share} size={13} />
                        {t.postToCommunity}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="mt-5 flex flex-col gap-2">
            {shown.map((video) => {
              const url = fileUrl(video.job_id, video.final_path);
              const isSelected = selected.has(video.job_id);
              const duration = durations[video.job_id];
              return (
                <div
                  key={video.job_id}
                  className={`flex items-center gap-3 rounded-xl border bg-card p-2.5 shadow-[0_3px_16px_-6px_rgba(15,27,60,0.12)] transition-colors ${
                    isSelected ? "border-primary" : "border-border"
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => toggleSelected(video.job_id)}
                    aria-pressed={isSelected}
                    aria-label={isSelected ? t.deselect : t.select}
                    className={`flex h-5 w-5 shrink-0 items-center justify-center rounded border-2 transition-colors ${
                      isSelected ? "border-primary bg-primary text-primary-foreground" : "border-border text-transparent hover:border-primary/50"
                    }`}
                  >
                    <Icon path={ICONS.check} size={12} />
                  </button>
                  <div
                    className="relative w-12 shrink-0 overflow-hidden rounded-md bg-black"
                    onMouseEnter={(e) => e.currentTarget.querySelector("video")?.play().catch(() => {})}
                    onMouseLeave={(e) => {
                      const v = e.currentTarget.querySelector("video");
                      if (v) { v.pause(); v.currentTime = 0; }
                    }}
                  >
                    {url && (
                      <video
                        muted
                        loop
                        preload="metadata"
                        src={url}
                        className="aspect-[9/16] w-full object-cover"
                        onLoadedMetadata={(e) => { const dur = e.currentTarget.duration; setDurations((d) => ({ ...d, [video.job_id]: dur })); }}
                      />
                    )}
                    {duration ? (
                      <span className="absolute bottom-0.5 right-0.5 rounded bg-black/70 px-1 py-0 font-mono text-[9px] font-semibold text-white">
                        {formatDuration(duration)}
                      </span>
                    ) : null}
                  </div>
                  <div className="min-w-0 flex-1">
                    {renamingId === video.job_id ? (
                      <input
                        ref={renameInputRef}
                        type="text"
                        value={renameDraft}
                        onChange={(e) => setRenameDraft(e.target.value)}
                        onBlur={() => submitRename(video.job_id)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") submitRename(video.job_id);
                          if (e.key === "Escape") setRenamingId(null);
                        }}
                        placeholder={t.renamePlaceholder}
                        className="w-full rounded-md border border-primary bg-transparent px-1.5 py-0.5 text-[13px] text-foreground outline-none"
                      />
                    ) : (
                      <button
                        type="button"
                        onClick={() => startRename(video)}
                        className="group flex items-center gap-1.5 text-left"
                        title={t.rename}
                      >
                        <p className="truncate text-[13px] font-medium text-foreground">{displayTitle(video)}</p>
                        <Icon path={ICONS.pencil} size={11} />
                      </button>
                    )}
                    <p className="text-[11px] text-muted-foreground">{relativeTime(video.created_at, lang)}</p>
                  </div>
                  <div className="flex shrink-0 items-center gap-1.5">
                    {url && (
                      <a
                        href={url}
                        download
                        aria-label={t.download}
                        title={t.download}
                        className="flex h-8 w-8 items-center justify-center rounded-lg border border-border text-foreground transition-colors hover:border-primary/50"
                      >
                        <Icon path={ICONS.download} size={14} />
                      </a>
                    )}
                    {url && (
                      <ShareButton
                        url={url}
                        t={t}
                        className="flex h-8 w-8 items-center justify-center rounded-lg border border-border text-foreground transition-colors hover:border-primary/50"
                      />
                    )}
                    <button
                      type="button"
                      onClick={() => editOne(video.job_id)}
                      aria-label={t.edit}
                      title={t.edit}
                      className="flex h-8 w-8 items-center justify-center rounded-lg border border-border text-foreground transition-colors hover:border-primary/50"
                    >
                      <Icon path={ICONS.editor} size={14} />
                    </button>
                    <button
                      type="button"
                      onClick={() => removeOne(video.job_id)}
                      aria-label={t.deleteOne}
                      title={t.deleteOne}
                      className="flex h-8 w-8 items-center justify-center rounded-lg border border-border text-muted-foreground transition-colors hover:border-destructive/50 hover:text-destructive"
                    >
                      <Icon path={ICONS.trash} size={14} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
