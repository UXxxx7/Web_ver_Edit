import { AgentChat } from "@/components/AgentChat";
import { requireUser } from "@/lib/auth";
import { getLang } from "@/lib/i18n.server";

export default async function AgentPage() {
  await requireUser();
  const lang = await getLang();
  return <AgentChat lang={lang} />;
}
