import type { Metadata } from "next";
import { LegalPageShell } from "@/components/LegalPageShell";
import { getLang } from "@/lib/i18n.server";
import { TERMS } from "@/lib/legal-content";

export const metadata: Metadata = {
  title: "Terms of Service — OpenMontage Studio",
  description: "The terms that govern your use of OpenMontage Studio.",
};

export default async function TermsPage() {
  const lang = await getLang();
  return <LegalPageShell doc={TERMS[lang]} lang={lang} />;
}
