import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ProfileForm } from "@/components/ProfileForm";
import { requireUser } from "@/lib/auth";
import { getProfile } from "@/lib/data";

export default async function ProfilePage() {
  const user = await requireUser();
  const profile = await getProfile(user.id);

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-10">
      <Card>
        <CardHeader>
          <CardTitle>Profile</CardTitle>
          <CardDescription>{user.email}</CardDescription>
        </CardHeader>
        <CardContent>
          <ProfileForm profile={profile} />
        </CardContent>
      </Card>
    </div>
  );
}
