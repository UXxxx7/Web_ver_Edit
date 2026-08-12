"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { setLangAction } from "@/app/lang-actions";
import { cn } from "@/lib/utils";
import type { Lang } from "@/lib/i18n";

export function LanguageSwitcher({ lang, className }: { lang: Lang; className?: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function switchTo(next: Lang) {
    if (next === lang || pending) return;
    startTransition(async () => {
      await setLangAction(next);
      router.refresh();
    });
  }

  return (
    <div className={cn("flex items-center gap-0.5 rounded-full border border-border bg-card p-0.5", className)}>
      <button
        type="button"
        onClick={() => switchTo("zh")}
        aria-pressed={lang === "zh"}
        className={cn(
          "rounded-full px-2.5 py-1 text-[12px] font-medium transition-colors",
          lang === "zh" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
        )}
      >
        中文
      </button>
      <button
        type="button"
        onClick={() => switchTo("en")}
        aria-pressed={lang === "en"}
        className={cn(
          "rounded-full px-2.5 py-1 text-[12px] font-medium transition-colors",
          lang === "en" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
        )}
      >
        EN
      </button>
    </div>
  );
}
