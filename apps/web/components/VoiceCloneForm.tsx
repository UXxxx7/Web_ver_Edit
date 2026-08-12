"use client";

import { useState } from "react";
import { createVoiceClone } from "@/app/(app)/edit/actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export function VoiceCloneForm() {
  const [voiceId, setVoiceId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function handleSubmit(formData: FormData) {
    setError(null);
    setPending(true);
    const result = await createVoiceClone(formData);
    setPending(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setVoiceId(result.data.voiceId);
  }

  if (voiceId) {
    return (
      <Card>
        <CardContent className="flex flex-col gap-3">
          <p className="text-sm text-primary">Voice clone ready.</p>
          <p className="text-sm text-muted-foreground">
            Every C-roll you generate from now on automatically uses this cloned voice instead of a stock
            HeyGen voice — nothing else to configure.
          </p>
          <Button variant="outline" className="w-fit" onClick={() => setVoiceId(null)}>Clone a different sample</Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent>
        <form action={(fd) => handleSubmit(fd)} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium" htmlFor="audio">Voice sample</label>
            <input
              id="audio" name="audio" type="file" accept="audio/*" required
              className="rounded-lg border border-input bg-transparent px-3 py-2 text-sm file:mr-3 file:rounded-md file:border-0 file:bg-secondary file:px-3 file:py-1.5 file:text-sm file:font-medium"
            />
            <p className="text-xs text-muted-foreground">
              A clean ~30s+ recording of your own voice, no background noise — used once to create an
              ElevenLabs Instant Voice Clone tied to your account.
            </p>
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <Button type="submit" disabled={pending} className="w-fit">
            {pending ? "Cloning…" : "Clone my voice"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
