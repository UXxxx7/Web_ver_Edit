"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { updateProfileAction, type ProfileFormState } from "@/app/(app)/profile/actions";
import type { Profile } from "@/lib/data";

const initialState: ProfileFormState = {};

export function ProfileForm({ profile }: { profile: Profile }) {
  const [state, formAction, pending] = useActionState(updateProfileAction, initialState);

  return (
    <form action={formAction} className="flex flex-col gap-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="display_name">Display name</Label>
          <Input id="display_name" name="display_name" defaultValue={profile.display_name} placeholder="e.g. David Chan" />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="role">Role</Label>
          <Input id="role" name="role" defaultValue={profile.role} placeholder="e.g. 保險從業員/KOL" />
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="preferred_lang">Preferred language</Label>
        <select
          id="preferred_lang"
          name="preferred_lang"
          defaultValue={profile.preferred_lang}
          className="h-9 rounded-lg border border-input bg-transparent px-3 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          <option value="zh">中文（廣東話）</option>
          <option value="en">English</option>
        </select>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="brand_voice_notes">Brand voice notes</Label>
        <Textarea
          id="brand_voice_notes"
          name="brand_voice_notes"
          defaultValue={profile.brand_voice_notes}
          rows={4}
          placeholder="Tone, phrases to always/never use, target audience — fed into every script/idea this account generates."
        />
        <p className="text-xs text-muted-foreground">
          Every brainstorm tool includes this automatically — set it once instead of repeating it per prompt.
        </p>
      </div>

      {state.saved && <p className="text-sm text-primary">Saved.</p>}
      {state.error && <p className="text-sm text-destructive">{state.error}</p>}
      <Button type="submit" disabled={pending} className="w-fit">
        {pending ? "Saving…" : "Save profile"}
      </Button>
    </form>
  );
}
