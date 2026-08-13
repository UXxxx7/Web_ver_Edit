// Shared types/constants only — safe to import from both Server and Client
// Components. Server-side cookie reads live in i18n.server.ts (needs
// "server-only" + next/headers, which Client Components can't import).
export type Lang = "zh" | "en";
export const LANG_COOKIE = "ui_lang";
export const DEFAULT_LANG: Lang = "zh";
