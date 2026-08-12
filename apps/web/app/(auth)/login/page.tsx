import { LoginForm } from "@/components/LoginForm";
import { getLang } from "@/lib/i18n.server";

export default async function LoginPage() {
  const lang = await getLang();
  return <LoginForm lang={lang} />;
}
