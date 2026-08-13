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
import { useRef, useState } from "react";
import { createCrollJob, createEditJob, createVoiceClone, getEditJobStatus } from "@/app/(app)/agent/actions";
import { AgentJobBubble } from "@/components/AgentJobBubble";
import { addRecentJob } from "@/lib/recent-jobs";
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

export function AgentChat() {
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [text, setText] = useState("");
  const [assets, setAssets] = useState<Asset[]>([]);
  const [arm, setArm] = useState<Arm>("arm_a");
  const [sending, setSending] = useState(false);
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

  function handleFileChosen(e: React.ChangeEvent<HTMLInputElement>) {
    const chosen = Array.from(e.target.files ?? []);
    e.target.value = "";
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
    addRecentJob(result.data.jobId);   // so the standalone /editor picker can list it
    const status = await getEditJobStatus(result.data.jobId);
    if (status.ok) updateJobMessage(botId, status.data);
    setSending(false);
  }

  return (
    <div className="dash">
      <main className="dash-main">
        <div className="thread">
          {messages.length === 0 && (
            <div className="empty-state">
              <p className="kicker">Agent — auto-generate from a video, photo, or voice sample</p>
              <h2>Attach something, tell me what you want.</h2>
              <p>{FALLBACK_REPLY}</p>
            </div>
          )}
          {messages.map((msg) => {
            if (msg.role === "user") {
              return (
                <div key={msg.id} className="msg from-user">
                  <div className="bubble">
                    {msg.attachmentName && <div className="mb-1 text-xs opacity-75">📎 {msg.attachmentName}</div>}
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
              <span className="opacity-80">
                {a.media === "video" ? "🎬" : a.media === "image" ? "🖼️" : "🎵"} {a.file.name}
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

      <div className="gen-bar primary">
        <input ref={fileInputRef} type="file" multiple accept="video/*,image/*,audio/*" className="hidden" onChange={handleFileChosen} />
        <button type="button" className="gen-bar-icon" style={{ background: "none", border: "none", cursor: "pointer", fontSize: 18 }} onClick={handleAttachClick} title="Attach video, photo, or voice sample">
          📎
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
  planned_edit: null, error_message: null, edit_request: "", degraded_operations: [],
  generation_cost_usd: 0, pipeline: "talking-head", created_at: null, updated_at: null,
};
