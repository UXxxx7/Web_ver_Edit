"use client";

// The "agent auto-generates a video" surface, matching the original
// WhatsApp interaction shape: one conversation thread, attach as many
// files as you want (main video/photo + b-roll + a style-reference video),
// each attachment gets acknowledged, then Send ("go") finalizes and
// starts the job — reproducing _handle_message's collect-then-'go'
// rhythm (see webhook.py's own header comment on why that code itself
// was WhatsApp-specific and got removed, but the *shape* is reproduced
// here) rather than firing a job per attachment.
import { useRef, useState } from "react";
import { createCrollJob, createEditJob, createVoiceClone, getEditJobStatus } from "@/app/(app)/agent/actions";
import { AgentJobBubble } from "@/components/AgentJobBubble";
import { addRecentJob } from "@/lib/recent-jobs";
import type { EditJob } from "@/lib/edit-jobs";

type StagedFile = { id: string; file: File; kind: "video" | "image" | "audio" };

type ChatMsg =
  | { id: string; role: "user"; text: string; attachmentNames?: string[] }
  | { id: string; role: "bot"; kind: "text"; text: string }
  | { id: string; role: "bot"; kind: "job"; job: EditJob };

const FALLBACK_REPLY =
  "Send me a video and tell me how you'd like it edited (e.g. \"remove dead air, add subtitles\"). " +
  "Attach extra photos/videos too — extra photos become b-roll, a second video becomes a style reference. " +
  "Or attach just a photo for a talking digital-human clip, or a voice sample to clone your voice.";

function attachmentKind(file: File): StagedFile["kind"] | null {
  if (file.type.startsWith("video/")) return "video";
  if (file.type.startsWith("image/")) return "image";
  if (file.type.startsWith("audio/")) return "audio";
  return null;
}

const KIND_LABEL: Record<StagedFile["kind"], string> = { video: "视频", image: "图片", audio: "音频" };

export function AgentChat() {
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [text, setText] = useState("");
  const [staged, setStaged] = useState<StagedFile[]>([]);
  const [sending, setSending] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const idCounter = useRef(0);
  const nextId = () => `m${Date.now()}-${idCounter.current++}`;

  function appendBot(text: string) {
    setMessages((m) => [...m, { id: nextId(), role: "bot", kind: "text", text }]);
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
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    const kind = attachmentKind(file);
    if (!kind) {
      appendBot("That file type isn't supported — attach a video, photo, or audio sample.");
      return;
    }
    if (kind === "audio") {
      handleVoiceSample(file);
      return;
    }
    const entry: StagedFile = { id: nextId(), file, kind };
    setStaged((s) => [...s, entry]);
    const countSoFar = staged.length + 1;
    appendBot(
      `已收到第 ${countSoFar} 个${KIND_LABEL[kind]} (${file.name})。可以继续发素材，也可以用文字补充说明。` +
      "全部发完点 Send 开始，或点 Cancel 取消。"
    );
  }

  async function handleVoiceSample(file: File) {
    appendBot(`已收到语音样本 (${file.name})，正在克隆声音…`);
    const form = new FormData();
    form.set("audio", file);
    const result = await createVoiceClone(form);
    appendBot(
      result.ok
        ? "Voice clone ready — future digital-human clips from you automatically use this voice instead of a stock one."
        : result.error
    );
  }

  function removeStaged(id: string) {
    setStaged((s) => s.filter((f) => f.id !== id));
  }

  function handleCancel() {
    setStaged([]);
    setText("");
    appendBot("已取消，素材已清空。");
  }

  async function handleSend() {
    const trimmed = text.trim();
    if (!trimmed && staged.length === 0) return;
    setSending(true);

    const userMsgId = nextId();
    setMessages((m) => [...m, { id: userMsgId, role: "user", text: trimmed, attachmentNames: staged.map((s) => s.file.name) }]);
    const currentStaged = staged;
    setText("");
    setStaged([]);

    if (currentStaged.length === 0) {
      appendBot(FALLBACK_REPLY);
      setSending(false);
      return;
    }

    const videos = currentStaged.filter((f) => f.kind === "video");
    const images = currentStaged.filter((f) => f.kind === "image");
    const botId = nextId();
    setMessages((m) => [...m, { id: botId, role: "bot", kind: "job", job: PENDING_JOB }]);

    const form = new FormData();
    let result;
    if (videos.length > 0) {
      form.set("video", videos[0].file);
      form.set("edit_request", trimmed);
      // A 2nd video attached is the style-reference clip ("照这个的转场来"),
      // matching /jobs' own reference/reference_kind fields — anything
      // beyond that has no slot in the current API, dropped rather than guessed at.
      if (videos.length > 1) {
        form.set("reference", videos[1].file);
        form.set("reference_kind", "video");
      }
      images.forEach((img) => {
        form.append("broll", img.file);
        form.append("broll_labels", "");
        form.append("broll_kinds", "image");
      });
      result = await createEditJob(form);
    } else {
      form.set("photo", images[0].file);
      form.set("hint", trimmed);
      form.set("lang", /[一-鿿]/.test(trimmed) ? "zh" : "en");
      images.slice(1).forEach((img) => {
        form.append("broll", img.file);
        form.append("broll_labels", "");
        form.append("broll_kinds", "image");
      });
      result = await createCrollJob(form);
    }

    if (!result.ok) {
      setMessages((m) => m.map((msg) => (msg.id === botId ? { id: botId, role: "bot", kind: "text", text: result.error } : msg)));
      setSending(false);
      return;
    }
    addRecentJob(result.data.jobId);
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
                    {msg.attachmentNames && msg.attachmentNames.length > 0 && (
                      <div className="mb-1 text-xs opacity-75">📎 {msg.attachmentNames.join(", ")}</div>
                    )}
                    {msg.text || <span className="opacity-75">(no message)</span>}
                  </div>
                </div>
              );
            }
            return (
              <div key={msg.id} className="msg from-bot">
                <div className="bubble">
                  {msg.kind === "text" ? msg.text : (
                    <AgentJobBubble job={msg.job} onUpdate={(job) => updateJobMessage(msg.id, job)} onHeartbeat={appendBot} />
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </main>

      {staged.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 border-t border-border px-5 py-2 text-xs text-muted-foreground">
          {staged.map((f) => (
            <span key={f.id} className="flex items-center gap-1 rounded-full bg-accent px-2.5 py-1">
              {f.kind === "video" ? "🎬" : "🖼️"} {f.file.name}
              <button className="ml-1 opacity-70 hover:opacity-100" onClick={() => removeStaged(f.id)}>×</button>
            </span>
          ))}
        </div>
      )}

      <div className="gen-bar primary">
        <input ref={fileInputRef} type="file" accept="video/*,image/*,audio/*" className="hidden" onChange={handleFileChosen} />
        <button type="button" className="gen-bar-icon" style={{ background: "none", border: "none", cursor: "pointer", fontSize: 18 }} onClick={handleAttachClick} title="Attach video, photo, or voice sample">
          📎
        </button>
        <input
          type="text"
          value={text}
          placeholder={staged.length > 0 ? "Say something about your attachments… (optional)" : "Type a message, or attach a video/photo/voice sample…"}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleSend(); } }}
        />
        {staged.length > 0 && (
          <button onClick={handleCancel} style={{ background: "transparent", color: "var(--dash-muted)", border: "1px solid var(--dash-border)" }}>
            Cancel
          </button>
        )}
        <button onClick={handleSend} disabled={sending || (!text.trim() && staged.length === 0)}>
          {sending ? "Sending…" : staged.length > 0 ? "Send (go)" : "Send"}
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
