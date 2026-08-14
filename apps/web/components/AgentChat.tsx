"use client";

// The "agent auto-generates a video" surface, redesigned to match the
// original WhatsApp interaction: one conversation thread, one compose bar
// (attach + text + send) — not separate tabs/forms. What kind of media is
// attached decides what happens next (video -> edit job, photo -> C-roll,
// audio -> voice clone), the same dispatch _handle_message used to do by
// reading msg_type in webhook.py before that logic was stripped out as
// WhatsApp-specific (see webhook.py's own header comment) — reproducing
// the *interaction shape* here, not the removed WhatsApp-message code.
//
// The compose bar's single attachment was upgraded to a multi-asset tray so
// the Arm-B (AI-authored) inputs the backend already accepts can be sent:
// one main video + an optional style reference + any number of manual b-roll
// clips (each with a cue), plus an arm selector (套用模板 / AI 现写). C-roll
// (single photo) and voice-clone (single audio) keep their single-file paths;
// only the video-edit job uses the multi-asset assembly. See
// armb_web_wiring_plan.md §5.
import { useEffect, useRef, useState } from "react";
import { createCrollJob, createEditJob, createVoiceClone, getEditJobStatus } from "@/app/(app)/agent/actions";
import { AgentJobBubble } from "@/components/AgentJobBubble";
import { addRecentJob } from "@/lib/recent-jobs";
import { loadChatHistory, saveChatHistory } from "@/lib/agent-chat-history";
import type { EditJob } from "@/lib/edit-jobs";

type Media = "video" | "image" | "audio";
type Role = "main" | "reference" | "broll";
type Arm = "arm_a" | "arm_b";

type Asset = {
  id: string;
  file: File;
  media: Media;
  role: Role;   // meaningful only for the video-edit path; cosmetic for C-roll/voice-clone
  cue: string;  // only used when role === "broll" -> broll_labels
};

type ChatMsg =
  | { id: string; role: "user"; text: string; attachmentName?: string }
  | { id: string; role: "bot"; kind: "text"; text: string }
  | { id: string; role: "bot"; kind: "job"; job: EditJob };

const FALLBACK_REPLY =
  "Send me a video and tell me how you'd like it edited (e.g. \"remove dead air, add subtitles\"). " +
  "Or attach a photo to generate a talking digital-human clip, or a voice sample to clone your voice.";

function mediaOf(file: File): Media | null {
  if (file.type.startsWith("video/")) return "video";
  if (file.type.startsWith("image/")) return "image";
  if (file.type.startsWith("audio/")) return "audio";
  return null;
}

const ROLE_LABEL: Record<Role, string> = { main: "主视频", reference: "参考风格", broll: "B-roll" };

// Hand-drawn line icons, same treatment as Dashboard/FeatureHub/
// TemplateGallery — no emoji anywhere in the app.
const ICONS = {
  attach: "M17.5 7.5 9 16a3 3 0 1 1-4.24-4.24L13.5 3a4.5 4.5 0 1 1 6.36 6.36L11.5 17.5",
  video: "M4 6.5A1.5 1.5 0 0 1 5.5 5h9A1.5 1.5 0 0 1 16 6.5v11A1.5 1.5 0 0 1 14.5 19h-9A1.5 1.5 0 0 1 4 17.5v-11Z M16 9.5l4-2.3v9.6l-4-2.3",
  image: "M4 6.5A1.5 1.5 0 0 1 5.5 5h13A1.5 1.5 0 0 1 20 6.5v11a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 17.5v-11Z M4 15l4.5-4.5a1.5 1.5 0 0 1 2.1 0L14 14M14 14l1.4-1.4a1.5 1.5 0 0 1 2.1 0L20 15 M9.5 9a1 1 0 1 1-2 0 1 1 0 0 1 2 0Z",
  audio: "M12 3a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V6a3 3 0 0 0-3-3Z M6 11v1a6 6 0 0 0 12 0v-1 M12 18v3M9 21h6",
  captions: "M4 8.5A1.5 1.5 0 0 1 5.5 7h13A1.5 1.5 0 0 1 20 8.5v5A1.5 1.5 0 0 1 18.5 15H10l-4 3v-3H5.5A1.5 1.5 0 0 1 4 13.5v-5Z M7.5 10v2.2M10.5 9.3v3.6M13.5 10v2.2M16.5 9.3v3.6",
  volumeUp: "M4 9v6h4l5 5V4L8 9H4Z M15.5 8.5a5 5 0 0 1 0 7",
  volumeMute: "M4 9v6h4l5 5V4L8 9H4Z M16 9l4 4m0-4-4 4",
};

function Icon({ path, size = 13 }: { path: string; size?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="inline-block shrink-0 align-[-2.5px]">
      <path d={path} />
    </svg>
  );
}

// Quick-action chips — fill the compose text with a ready instruction so a
// user doesn't have to phrase "add captions" or "clean up the audio"
// themselves. Audio-cleanup options name the actual presets
// tools/audio/audio_enhance.py already implements (clean_speech,
// noise_reduce, podcast), not invented ones — the planner has a real
// filter chain to map each phrase onto. Caption styles map onto the
// captions.* fields in contracts/style_params.schema.json (position,
// karaoke, highlightColor) via the planner's own free-text understanding,
// same mechanism as any other edit_request — no new backend plumbing.
const QUICK_ACTIONS = [
  { icon: ICONS.captions, label: "TikTok字幕", text: "加字幕，用TikTok風格：大隻黃色字，逐隻字highlight，擺喺畫面中下方。" },
  { icon: ICONS.captions, label: "簡約字幕", text: "加字幕，簡約風格：細粒白色字，喺畫面最底，唔使highlight效果。" },
  { icon: ICONS.volumeUp, label: "人聲清晰", text: "洗靚把聲：人聲清晰，減走吵耳嘅背景雜音（clean_speech）。" },
  { icon: ICONS.volumeMute, label: "強力降噪", text: "把聲環境好嘈，幫我強力降噪（noise_reduce）。" },
] as const;

// What each attachment type actually does — the compose bar accepts video,
// photo, or a voice sample, but nothing else on the page says what each
// one is for until you've already attached something. Same tinted-card
// treatment as FeatureHub's secondary cards, so the empty state reads as
// part of the same product rather than a bare placeholder message.
const USES = [
  {
    icon: ICONS.video, color: "#3E63FF",
    title: "上載一條片", body: "AI幫你剪走贅字、加字幕、裁做直度。",
  },
  {
    icon: ICONS.image, color: "#8B5CF6",
    title: "上載一張相", body: "一鍵生成識講嘢嘅數碼人影片。",
  },
  {
    icon: ICONS.audio, color: "#22C55E",
    title: "上載聲音樣本", body: "複製你把聲，之後可以攞嚟配音。",
  },
] as const;

function AgentIntro({ onAttach }: { onAttach: () => void }) {
  return (
    <div className="mx-auto max-w-2xl px-4 py-14 text-center sm:py-16">
      <h2 className="text-2xl font-bold tracking-tight text-foreground sm:text-[26px]">
        上載一條片、相，或者聲音樣本
      </h2>
      <p className="mx-auto mt-2 max-w-md text-[13.5px] leading-relaxed text-muted-foreground">
        同AI講你想點剪，例如「剪走贅字、加字幕」——揀低面任何一種開始。
      </p>

      <div className="mt-8 grid grid-cols-1 gap-3 text-left sm:grid-cols-3">
        {USES.map((use) => (
          <button
            key={use.title}
            type="button"
            onClick={onAttach}
            className="flex flex-col items-start rounded-2xl border border-border bg-card p-4 shadow-[0_3px_16px_-6px_rgba(15,27,60,0.12)] transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-[0_8px_24px_-8px_rgba(15,27,60,0.16)]"
          >
            <span
              className="inline-flex h-9 w-9 items-center justify-center rounded-lg"
              style={{ background: `color-mix(in srgb, ${use.color} 12%, transparent)`, color: use.color }}
            >
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                <path d={use.icon} />
              </svg>
            </span>
            <h3 className="mt-3 text-[14px] font-semibold text-foreground">{use.title}</h3>
            <p className="mt-1 text-[12.5px] leading-snug text-muted-foreground">{use.body}</p>
          </button>
        ))}
      </div>
    </div>
  );
}

export function AgentChat() {
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  // Restore after mount, not via a useState lazy initializer — this
  // component is server-rendered first (it's a Client Component, but
  // Next.js still renders it to HTML on the server for the initial
  // payload), where `window`/localStorage don't exist, so a lazy
  // initializer would only ever see history on the client. That made the
  // server's HTML (always empty-state) disagree with the client's very
  // first render (real restored messages) — a hydration mismatch React
  // detects and "fixes" by discarding the server HTML and re-rendering the
  // whole tree client-side. Starting both at [] and restoring here, after
  // hydration, keeps server and first-client-render identical; the restore
  // itself then lands a frame later as an ordinary post-mount state update
  // (same pattern MyVideos.tsx/EditorPicker.tsx already use for their own
  // localStorage-backed lists).
  const restoredRef = useRef(false);
  useEffect(() => {
    setMessages(loadChatHistory<ChatMsg>());
    restoredRef.current = true;
  }, []);
  // Persist on every change, not just on unmount — unmount isn't guaranteed
  // to run in time for a hard navigation/tab close, and this is cheap.
  // Gated on restoredRef: on the very first mount this effect and the
  // restore effect above both fire in the same pass, before setMessages
  // above has actually taken effect — without the guard this would run
  // first with the still-empty initial `messages` and clobber whatever was
  // saved, a moment before the restore effect even reads it back.
  useEffect(() => {
    if (restoredRef.current) saveChatHistory(messages);
  }, [messages]);
  const [text, setText] = useState("");
  const [assets, setAssets] = useState<Asset[]>([]);
  const [arm, setArm] = useState<Arm>("arm_a");
  const [sending, setSending] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const idCounter = useRef(0);
  const nextId = () => `m${Date.now()}-${idCounter.current++}`;

  const hasVideo = assets.some((a) => a.media === "video");

  function pushBotText(t: string) {
    setMessages((m) => [...m, { id: nextId(), role: "bot", kind: "text", text: t }]);
  }

  function updateJobMessage(id: string, job: EditJob) {
    setMessages((m) =>
      m.map((msg) => (msg.id === id && msg.role === "bot" && msg.kind === "job" ? { ...msg, job } : msg))
    );
  }

  function handleAttachClick() {
    fileInputRef.current?.click();
  }

  // Shared by the 📎 button's hidden <input> (FileList from an <input
  // onChange>) and drag-and-drop (FileList from a DataTransfer) — same
  // staging rules either way, so dropping a video behaves identically to
  // clicking attach and picking it.
  function addFiles(chosen: File[]) {
    if (chosen.length === 0) return;

    setAssets((prev) => {
      const next = [...prev];
      let mainExists = next.some((a) => a.role === "main" && a.media === "video");
      for (const file of chosen) {
        const media = mediaOf(file);
        if (!media) {
          pushBotText("That file type isn't supported — attach a video, photo, or audio sample.");
          continue;
        }
        // First video with no main yet -> main; every other video/image -> broll.
        let role: Role = "broll";
        if (media === "video" && !mainExists) {
          role = "main";
          mainExists = true;
        }
        next.push({ id: nextId(), file, media, role, cue: "" });
      }
      return next;
    });
  }

  function handleFileChosen(e: React.ChangeEvent<HTMLInputElement>) {
    const chosen = Array.from(e.target.files ?? []);
    e.target.value = "";
    addFiles(chosen);
  }

  function handleDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setDragActive(false);
    addFiles(Array.from(e.dataTransfer.files ?? []));
  }

  function setAssetRole(id: string, role: Role) {
    setAssets((prev) => {
      let next = prev.map((a) => (a.id === id ? { ...a, role } : a));
      // Reference is at most one — demote any other reference to broll.
      if (role === "reference") {
        next = next.map((a) => (a.id !== id && a.role === "reference" ? { ...a, role: "broll" } : a));
      }
      return next;
    });
  }

  function setAssetCue(id: string, cue: string) {
    setAssets((prev) => prev.map((a) => (a.id === id ? { ...a, cue } : a)));
  }

  function removeAsset(id: string) {
    setAssets((prev) => prev.filter((a) => a.id !== id));
  }

  function resetComposer() {
    setText("");
    setAssets([]);
    setArm("arm_a");
  }

  async function handleSend() {
    const trimmed = text.trim();
    if (!trimmed && assets.length === 0) return;

    // Dispatch by media composition of the tray (not by role) — mirrors the
    // WhatsApp msg_type dispatch. Validate before we mutate the thread.
    const videos = assets.filter((a) => a.media === "video");
    const images = assets.filter((a) => a.media === "image");
    const audios = assets.filter((a) => a.media === "audio");

    let mode: "chat" | "video" | "croll" | "voice";
    if (assets.length === 0) {
      mode = "chat";
    } else if (videos.length > 0) {
      mode = "video";
    } else if (images.length === 1 && audios.length === 0) {
      mode = "croll";
    } else if (audios.length === 1 && images.length === 0) {
      mode = "voice";
    } else {
      pushBotText(
        "这些素材没法一起处理：视频剪辑请放 1 个主视频（可再加参考视频/多个 b-roll）；" +
        "生成数字人请只放 1 张照片；克隆声音请只放 1 段音频。"
      );
      return;
    }

    // For the video path, require exactly one Main video before touching state.
    if (mode === "video") {
      const mains = assets.filter((a) => a.role === "main" && a.media === "video");
      if (mains.length === 0) {
        pushBotText("请把其中一个视频的角色设为「主视频」。");
        return;
      }
      if (mains.length > 1) {
        pushBotText("只能有一个「主视频」，其余视频请设为 B-roll 或参考风格。");
        return;
      }
    }

    setSending(true);
    const summary =
      assets.length === 0 ? undefined :
      assets.length === 1 ? assets[0].file.name :
      `${assets.length} 个文件`;
    const userMsgId = nextId();
    setMessages((m) => [...m, { id: userMsgId, role: "user", text: trimmed, attachmentName: summary }]);

    const snapshot = assets;
    const snapshotArm = arm;
    resetComposer();

    if (mode === "chat") {
      pushBotText(FALLBACK_REPLY);
      setSending(false);
      return;
    }

    if (mode === "voice") {
      const form = new FormData();
      form.set("audio", snapshot[0].file);
      const result = await createVoiceClone(form);
      pushBotText(
        result.ok
          ? "Voice clone ready — future digital-human clips from you automatically use this voice instead of a stock one."
          : result.error
      );
      setSending(false);
      return;
    }

    const botId = nextId();
    setMessages((m) => [...m, { id: botId, role: "bot", kind: "job", job: PENDING_JOB }]);

    let result;
    if (mode === "croll") {
      const form = new FormData();
      form.set("photo", snapshot[0].file);
      form.set("hint", trimmed);
      form.set("lang", /[一-鿿]/.test(trimmed) ? "zh" : "en");
      result = await createCrollJob(form);
    } else {
      // mode === "video": assemble main + optional reference + b-roll[] + arm.
      const main = snapshot.find((a) => a.role === "main" && a.media === "video")!;
      const reference = snapshot.find((a) => a.role === "reference") ?? null;
      const brolls = snapshot.filter((a) => a.role === "broll");

      const form = new FormData();
      form.set("video", main.file);
      form.set("edit_request", trimmed);
      form.set("arm", snapshotArm);
      if (reference) {
        form.set("reference", reference.file);
        form.set("reference_kind", reference.media === "image" ? "image" : "video");
      }
      for (const b of brolls) {
        form.append("broll", b.file);
        form.append("broll_labels", b.cue.trim());
        form.append("broll_kinds", b.media === "image" ? "image" : "video");
      }
      result = await createEditJob(form);
    }

    if (!result.ok) {
      setMessages((m) => m.map((msg) => (msg.id === botId ? { id: botId, role: "bot", kind: "text", text: result.error } : msg)));
      setSending(false);
      return;
    }
    addRecentJob(result.data.jobId);   // so CommunityFeed's share picker can list it (see recent-jobs.ts's own header)
    const status = await getEditJobStatus(result.data.jobId);
    if (status.ok) updateJobMessage(botId, status.data);
    setSending(false);
  }

  return (
    <div
      className={`dash agent-dropzone${dragActive ? " is-drag-active" : ""}`}
      onDragOver={(e) => {
        e.preventDefault();
        setDragActive(true);
      }}
      onDragLeave={(e) => {
        // Only clear on leaving the container itself, not a child element —
        // dragging over the compose bar/thread fires leave+enter on every
        // child boundary crossed, which would otherwise flicker the overlay.
        if (e.currentTarget === e.target) setDragActive(false);
      }}
      onDrop={handleDrop}
    >
      {dragActive && (
        <div className="agent-dropzone-overlay" aria-hidden>
          <p>📎 放低嚟上載</p>
        </div>
      )}
      <main className="dash-main">
        <div className="thread">
          {messages.length === 0 && <AgentIntro onAttach={handleAttachClick} />}
          {messages.map((msg) => {
            if (msg.role === "user") {
              return (
                <div key={msg.id} className="msg from-user">
                  <div className="bubble">
                    {msg.attachmentName && (
                      <div className="mb-1 flex items-center gap-1 text-xs opacity-75">
                        <Icon path={ICONS.attach} size={12} /> {msg.attachmentName}
                      </div>
                    )}
                    {msg.text || <span className="opacity-75">(no message)</span>}
                  </div>
                </div>
              );
            }
            return (
              <div key={msg.id} className="msg from-bot">
                <div className="bubble">
                  {msg.kind === "text" ? msg.text : <AgentJobBubble job={msg.job} onUpdate={(job) => updateJobMessage(msg.id, job)} />}
                </div>
              </div>
            );
          })}
        </div>
      </main>

      {/* Asset tray + arm picker, above the compose bar. */}
      {assets.length > 0 && (
        <div className="border-t border-border px-5 py-3 flex flex-col gap-2">
          {assets.map((a) => (
            <div key={a.id} className="flex flex-wrap items-center gap-2 text-xs">
              <span className="flex items-center gap-1 opacity-80">
                <Icon path={a.media === "video" ? ICONS.video : a.media === "image" ? ICONS.image : ICONS.audio} size={13} />
                {a.file.name}
              </span>
              <select
                value={a.role}
                onChange={(e) => setAssetRole(a.id, e.target.value as Role)}
                className="rounded border border-border bg-transparent px-1.5 py-0.5"
                aria-label="素材角色"
              >
                <option value="main">{ROLE_LABEL.main}</option>
                <option value="reference">{ROLE_LABEL.reference}</option>
                <option value="broll">{ROLE_LABEL.broll}</option>
              </select>
              {a.role === "broll" && (
                <input
                  type="text"
                  value={a.cue}
                  placeholder="插入线索（可选，例：讲到 vscode 时）"
                  onChange={(e) => setAssetCue(a.id, e.target.value)}
                  className="flex-1 min-w-[10rem] rounded border border-border bg-transparent px-1.5 py-0.5"
                />
              )}
              <button className="underline opacity-70 hover:opacity-100" onClick={() => removeAsset(a.id)}>
                移除
              </button>
            </div>
          ))}
          {hasVideo && (
            <div className="flex items-center gap-2 text-xs pt-1">
              <span className="opacity-70">剪辑方式：</span>
              <div className="inline-flex rounded-md border border-border overflow-hidden">
                <button
                  type="button"
                  onClick={() => setArm("arm_a")}
                  className={`px-2.5 py-1 ${arm === "arm_a" ? "bg-primary text-primary-foreground" : "opacity-70"}`}
                >
                  套用模板
                </button>
                <button
                  type="button"
                  onClick={() => setArm("arm_b")}
                  className={`px-2.5 py-1 ${arm === "arm_b" ? "bg-primary text-primary-foreground" : "opacity-70"}`}
                >
                  AI 现写
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {hasVideo && (
        <div className="gen-suggestions">
          {QUICK_ACTIONS.map((a) => (
            <button key={a.label} type="button" className="gen-chip" onClick={() => setText(a.text)}>
              <Icon path={a.icon} size={12} /> {a.label}
            </button>
          ))}
        </div>
      )}

      <div className="gen-bar primary">
        <input ref={fileInputRef} type="file" multiple accept="video/*,image/*,audio/*" className="hidden" onChange={handleFileChosen} />
        <button type="button" className="gen-bar-icon" style={{ background: "none", border: "none", cursor: "pointer" }} onClick={handleAttachClick} title="Attach video, photo, or voice sample">
          <Icon path={ICONS.attach} size={18} />
        </button>
        <input
          type="text"
          value={text}
          placeholder={assets.length > 0 ? "Say how you want it edited…" : "Type a message, or attach a video/photo/voice sample…"}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleSend(); } }}
        />
        <button onClick={handleSend} disabled={sending || (!text.trim() && assets.length === 0)}>
          {sending ? "Sending…" : "Send"}
        </button>
      </div>
    </div>
  );
}

// Placeholder shown the instant a job-creating request is sent, before the
// real job_id/status comes back — AgentJobBubble only reads .status here
// (an in-progress one, so it renders the spinner line) so the rest of the
// fields being empty is harmless; replaced by the real job within one round trip.
const PENDING_JOB: EditJob = {
  job_id: "", status: "RECEIVED", input_video_path: null, preview_path: null, final_path: null,
  planned_edit: null, error_message: null, current_stage: null, edit_request: "", degraded_operations: [],
  generation_cost_usd: 0, pipeline: "talking-head", created_at: null, updated_at: null,
};
