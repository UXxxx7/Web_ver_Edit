"use client";

// Profile picture — click the circle (or the text link) to pick a photo.
// No object storage wired up yet, so the photo never leaves the browser as
// a raw upload: it's downscaled to a small square and re-encoded to a JPEG
// data URL client-side (canvas), then saved straight into
// profiles.avatar_url as text (see updateAvatarAction's own header).
import { useRef, useState } from "react";
import { updateAvatarAction } from "@/app/(app)/profile/actions";

const MAX_DIM = 256;

function resizeToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const scale = Math.min(1, MAX_DIM / Math.max(img.width, img.height));
        const w = Math.max(1, Math.round(img.width * scale));
        const h = Math.max(1, Math.round(img.height * scale));
        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          reject(new Error("canvas unavailable"));
          return;
        }
        ctx.drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL("image/jpeg", 0.85));
      };
      img.onerror = () => reject(new Error("invalid image"));
      img.src = reader.result as string;
    };
    reader.onerror = () => reject(new Error("read failed"));
    reader.readAsDataURL(file);
  });
}

const ICONS = {
  camera: "M4 8.5A1.5 1.5 0 0 1 5.5 7h2l1-2h6l1 2h2A1.5 1.5 0 0 1 20 8.5v9A1.5 1.5 0 0 1 18.5 19h-13A1.5 1.5 0 0 1 4 17.5v-9Z M12 16a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z",
  person: "M12 12a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z M5 19c1.2-3.5 4-5 7-5s5.8 1.5 7 5",
};

const T = {
  zh: { change: "換相", uploading: "上載緊…", invalidType: "揀返一個相片檔案先。", tooLarge: "張相太大，換第張細啲嘅。", failed: "處理唔到呢張相，試下換第張。" },
  en: { change: "Change photo", uploading: "Uploading…", invalidType: "Choose an image file.", tooLarge: "That image is too large — try a smaller one.", failed: "Couldn't process that photo — try a different file." },
} as const;

export function AvatarUpload({
  avatarUrl, displayName, lang,
}: {
  avatarUrl: string;
  displayName: string;
  lang: "zh" | "en";
}) {
  const t = T[lang];
  const [preview, setPreview] = useState(avatarUrl);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setError(t.invalidType);
      return;
    }
    setUploading(true);
    setError(null);
    try {
      const dataUrl = await resizeToDataUrl(file);
      const result = await updateAvatarAction(dataUrl);
      if (!result.ok) {
        setError(result.error.includes("large") ? t.tooLarge : result.error);
      } else {
        setPreview(dataUrl);
      }
    } catch {
      setError(t.failed);
    } finally {
      setUploading(false);
    }
  }

  const initial = displayName.trim().charAt(0).toUpperCase();

  return (
    <div className="flex items-center gap-4">
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={uploading}
        aria-label={t.change}
        className="group relative flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-full border border-border bg-secondary text-muted-foreground"
      >
        {preview ? (
          // eslint-disable-next-line @next/next/no-img-element -- data URL, next/image can't optimize/needs no optimization here
          <img src={preview} alt="" className="h-full w-full object-cover" />
        ) : initial ? (
          <span className="text-xl font-bold">{initial}</span>
        ) : (
          <svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
            <path d={ICONS.person} />
          </svg>
        )}
        <span className="absolute inset-0 flex items-center justify-center bg-black/50 text-white opacity-0 transition-opacity group-hover:opacity-100">
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d={ICONS.camera} />
          </svg>
        </span>
        {uploading && (
          <span className="absolute inset-0 flex items-center justify-center bg-black/50">
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
          </span>
        )}
      </button>
      <div>
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          className="text-[13px] font-semibold text-primary hover:underline disabled:opacity-60"
        >
          {uploading ? t.uploading : t.change}
        </button>
        {error && <p className="mt-0.5 text-[12px] text-destructive">{error}</p>}
      </div>
      <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={handleFile} />
    </div>
  );
}
