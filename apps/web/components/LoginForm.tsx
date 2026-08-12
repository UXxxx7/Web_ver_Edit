"use client";

import Link from "next/link";
import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { loginAction, type AuthFormState } from "@/app/(auth)/actions";
import type { Lang } from "@/lib/i18n";

const initialState: AuthFormState = {};

const DICT = {
  zh: {
    title: "登入",
    desc: "登入使用靈感工具、影片編輯，同埋你嘅歷史紀錄。",
    email: "電郵 Email",
    password: "密碼 Password",
    submit: "登入",
    pending: "登入緊…",
    noAccount: "仲未有帳戶？",
    signup: "免費註冊",
  },
  en: {
    title: "Sign in",
    desc: "Sign in — brainstorm tools, video editor, and your saved history.",
    email: "Email",
    password: "Password",
    submit: "Sign in",
    pending: "Signing in…",
    noAccount: "No account yet?",
    signup: "Sign up",
  },
} satisfies Record<Lang, unknown>;

export function LoginForm({ lang }: { lang: Lang }) {
  const [state, formAction, pending] = useActionState(loginAction, initialState);
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
            <Input id="password" name="password" type="password" autoComplete="current-password" required className="h-11" />
          </div>
          {state.error && <p className="text-sm text-destructive">{state.error}</p>}
          <Button type="submit" disabled={pending} className="mt-1 h-11 w-full text-base">
            {pending ? t.pending : t.submit}
          </Button>
        </form>
        <p className="mt-5 text-center text-sm text-muted-foreground">
          {t.noAccount}{" "}
          <Link href="/signup" className="font-medium text-primary hover:underline">
            {t.signup}
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}
