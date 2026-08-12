import { BrainstormBoard } from "@/components/BrainstormBoard";
import { requireUser } from "@/lib/auth";
import { getProfile, listGenerations } from "@/lib/data";
import { getLang } from "@/lib/i18n.server";

export default async function BrainstormPage() {
  const user = await requireUser();
  const [history, profile, lang] = await Promise.all([listGenerations(user.id), getProfile(user.id), getLang()]);
  return <BrainstormBoard initialHistory={history} profileRole={profile.role} lang={lang} />;
}
