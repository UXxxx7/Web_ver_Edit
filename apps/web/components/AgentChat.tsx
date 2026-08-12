"use client";

// The "agent auto-generates a video" surface, redesigned to match the
// original WhatsApp interaction: one conversation thread, one compose bar
// (attach + text + send) — not separate tabs/forms. What kind of media is
// attached decides what happens next (video -> edit job, photo -> C-roll,
// audio -> voice clone), the same dispatch _handle_message used to do by
// reading msg_type in webhook.py before that logic was stripped out as
// WhatsApp-specific (see webhook.py's own header comment) — reproducing
// the *interaction shape* here, not the removed WhatsApp-message code.
import { useRef, useState } from "react";
import { createCrollJob, createEditJob, createVoiceClone, getEditJobStatus } from "@/app/(app)/agent/actions";
import { AgentJobBubble } from "@/components/AgentJobBubble";
import type { EditJob } from "@/lib/edit-jobs";

type Attachment = { file: File; kind: "video" | "image" | "audio" };

type ChatMsg =
  | { id: string; role: "user"; text: string; attachmentName?: string }
  | { id: string; role: "bot"; kind: "text"; text: string }
  | { id: string; role: "bot"; kind: "job"; job: EditJob };

const FALLBACK_REPLY =
  "Send me a video and tell me how you'd like it edited (e.g. \"remove dead air, add subtitles\"). " +
  "Or attach a photo to generate a talking digital-human clip, or a voice sample to clone your voice.";

function attachmentKind(file: File): Attachment["kind"] | null {
  if (file.type.startsWith("video/")) return "video";
  if (file.type.startsWith("image/")) return "image";
  if (file.type.startsWith("audio/")) return "audio";
  return null;
}

export function AgentChat() {
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [text, setText] = useState("");
  const [attachment, setAttachment] = useState<Attachment | null>(null);
  const [sending, setSending] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const idCounter = useRef(0);
  const nextId = () => `m${Date.now()}-${idCounter.current++}`;

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
      setMessages((m) => [...m, { id: nextId(), role: "bot", kind: "text", text: "That file type isn't supported — attach a video, photo, or audio sample." }]);
      return;
    }
    setAttachment({ file, kind });
  }

  async function handleSend() {
    const trimmed = text.trim();
    if (!trimmed && !attachment) return;
    setSending(true);

    const userMsgId = nextId();
    setMessages((m) => [...m, { id: userMsgId, role: "user", text: trimmed, attachmentName: attachment?.file.name }]);
    const currentAttachment = attachment;
    setText("");
    setAttachment(null);

    if (!currentAttachment) {
      setMessages((m) => [...m, { id: nextId(), role: "bot", kind: "text", text: FALLBACK_REPLY }]);
      setSending(false);
      return;
    }

    if (currentAttachment.kind === "audio") {
      const form = new FormData();
      form.set("audio", currentAttachment.file);
      const result = await createVoiceClone(form);
      setMessages((m) => [...m, {
        id: nextId(), role: "bot", kind: "text",
        text: result.ok
          ? "Voice clone ready — future digital-human clips from you automatically use this voice instead of a stock one."
          : result.error,
      }]);
      setSending(false);
      return;
    }

    const botId = nextId();
    setMessages((m) => [...m, { id: botId, role: "bot", kind: "job", job: PENDING_JOB }]);

    const form = new FormData();
    let result;
    if (currentAttachment.kind === "video") {
      form.set("video", currentAttachment.file);
      form.set("edit_request", trimmed);
      result = await createEditJob(form);
    } else {
      form.set("photo", currentAttachment.file);
      form.set("hint", trimmed);
      form.set("lang", /[一-鿿]/.test(trimmed) ? "zh" : "en");
      result = await createCrollJob(form);
    }

    if (!result.ok) {
      setMessages((m) => m.map((msg) => (msg.id === botId ? { id: botId, role: "bot", kind: "text", text: result.error } : msg)));
      setSending(false);
      return;
    }
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

      <div className="gen-bar primary">
        <input ref={fileInputRef} type="file" accept="video/*,image/*,audio/*" className="hidden" onChange={handleFileChosen} />
        <button type="button" className="gen-bar-icon" style={{ background: "none", border: "none", cursor: "pointer", fontSize: 18 }} onClick={handleAttachClick} title="Attach video, photo, or voice sample">
          📎
        </button>
        <input
          type="text"
          value={text}
          placeholder={attachment ? `Say something about ${attachment.file.name}… (optional)` : "Type a message, or attach a video/photo/voice sample…"}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleSend(); } }}
        />
        <button onClick={handleSend} disabled={sending || (!text.trim() && !attachment)}>
          {sending ? "Sending…" : "Send"}
        </button>
      </div>
      {attachment && (
        <div className="border-t border-border px-5 py-2 text-xs text-muted-foreground">
          Attached: {attachment.file.name} ({attachment.kind})
          <button className="ml-2 underline" onClick={() => setAttachment(null)}>remove</button>
        </div>
      )}
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
