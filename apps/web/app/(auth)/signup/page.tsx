import { SignupForm } from "@/components/SignupForm";
import { getLang } from "@/lib/i18n.server";

export default async function SignupPage() {
  const lang = await getLang();
  return <SignupForm lang={lang} />;
}
