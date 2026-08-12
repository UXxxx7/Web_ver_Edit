import { AgentChat } from "@/components/AgentChat";
import { requireUser } from "@/lib/auth";

export default async function AgentPage() {
  await requireUser();
  return <AgentChat />;
}
