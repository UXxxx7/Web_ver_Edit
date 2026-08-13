"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { signupAction, type AuthFormState } from "@/app/(auth)/actions";
import type { Lang } from "@/lib/i18n";

const initialState: AuthFormState = {};

// Occupation chips — optional, single-select. Values are plain text saved
// straight into profile.role (same free-text field the /profile page edits
// later), so lib/suggestions.ts's industry keyword match (e.g. /保險|insurance/)
// picks it up immediately without needing a separate enum anywhere.
const OCCUPATIONS = {
  zh: ["保險", "地產", "美容", "健身", "財務策劃"],
  en: ["Insurance", "Real estate", "Beauty", "Fitness", "Financial planning"],
} satisfies Record<Lang, string[]>;

const DICT = {
  zh: {
    title: "註冊帳戶",
    desc: "設定一次個人資料，之後每個工具都會用嚟個人化內容。",
    email: "電郵 Email",
    password: "密碼 Password",
    minLength: "最少 8 個字",
    occupation: "你嘅行業？（可選）",
    occupationPh: "揀返上面一個，或者自己打",
    occupationHint: "等我哋可以幫你度返啱你行業嘅內容同idea，唔填都得，之後喺個人資料度都可以填。",
    submit: "免費註冊",
    pending: "註冊緊…",
    hasAccount: "已經有帳戶？",
    signin: "登入",
  },
  en: {
    title: "Create an account",
    desc: "Set up your profile once — every tool uses it to personalize output.",
    email: "Email",
    password: "Password",
    minLength: "At least 8 characters.",
    occupation: "Your industry (optional)",
    occupationPh: "Pick one above, or type your own",
    occupationHint: "Makes it easier to brainstorm ideas for your industry. Leave it blank — you can fill it in later on your profile.",
    submit: "Create account",
    pending: "Creating account…",
    hasAccount: "Already have an account?",
    signin: "Sign in",
  },
} satisfies Record<Lang, unknown>;

export function SignupForm({ lang }: { lang: Lang }) {
  const [state, formAction, pending] = useActionState(signupAction, initialState);
  const [occupation, setOccupation] = useState("");
  const t = DICT[lang];

  return (
    <Card className="shadow-xl shadow-black/5">
      <CardHeader>
        <CardTitle className="text-2xl">{t.title}</CardTitle>
        <CardDescription className="text-[13.5px]">{t.desc}</CardDescription>
      </CardHeader>
      <CardContent>
        <form action={formAction} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="email">{t.email}</Label>
            <Input id="email" name="email" type="email" autoComplete="email" required className="h-11" />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="password">{t.password}</Label>
            <Input id="password" name="password" type="password" autoComplete="new-password" required minLength={8} className="h-11" />
            <p className="text-xs text-muted-foreground">{t.minLength}</p>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="role">{t.occupation}</Label>
            <div className="flex flex-wrap gap-1.5">
              {OCCUPATIONS[lang].map((opt) => (
                <button
                  key={opt}
                  type="button"
                  onClick={() => setOccupation((cur) => (cur === opt ? "" : opt))}
                  aria-pressed={occupation === opt}
                  className={cn(
                    "rounded-full border px-3 py-1.5 text-[13px] font-medium transition-colors",
                    occupation === opt
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border bg-transparent text-muted-foreground hover:border-primary/50 hover:text-foreground"
                  )}
                >
                  {opt}
                </button>
              ))}
            </div>
            <Input
              id="role"
              name="role"
              value={occupation}
              onChange={(e) => setOccupation(e.target.value)}
              placeholder={t.occupationPh}
              className="h-10"
            />
            <p className="text-xs text-muted-foreground">{t.occupationHint}</p>
          </div>

          {state.error && <p className="text-sm text-destructive">{state.error}</p>}
          <Button type="submit" disabled={pending} className="mt-1 h-11 w-full text-base">
            {pending ? t.pending : t.submit}
          </Button>
        </form>
        <p className="mt-5 text-center text-sm text-muted-foreground">
          {t.hasAccount}{" "}
          <Link href="/login" className="font-medium text-primary hover:underline">
            {t.signin}
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}
