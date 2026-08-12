import { Dashboard } from "@/components/Dashboard";
import { requireUser } from "@/lib/auth";
import { listGenerations } from "@/lib/data";

export default async function DashboardPage() {
  const user = await requireUser();
  const history = await listGenerations(user.id);
  return <Dashboard initialHistory={history} />;
}
