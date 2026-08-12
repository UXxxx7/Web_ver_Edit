import { EditorPicker } from "@/components/EditorPicker";
import { requireUser } from "@/lib/auth";

export default async function EditorPage() {
  await requireUser();
  return <EditorPicker />;
}
