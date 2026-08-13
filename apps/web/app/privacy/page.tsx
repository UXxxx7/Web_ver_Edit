import type { Metadata } from "next";
import { LegalPageShell } from "@/components/LegalPageShell";
import { getLang } from "@/lib/i18n.server";
import { PRIVACY } from "@/lib/legal-content";

export const metadata: Metadata = {
  title: "Privacy Policy — OpenMontage Studio",
  description: "What OpenMontage Studio collects, why, and who it's shared with.",
};

export default async function PrivacyPage() {
  const lang = await getLang();
  return <LegalPageShell doc={PRIVACY[lang]} lang={lang} />;
}
