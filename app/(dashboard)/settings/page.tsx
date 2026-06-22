import { Header } from "@/components/header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  FounderProfileForm,
  type ProfileValues,
} from "@/components/founder-profile-form";
import { getFounderProfile } from "@/lib/founder";
import { asStringArray } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const profile = await getFounderProfile();

  const initial: ProfileValues = {
    skills: asStringArray(profile?.skills).join(", "),
    preferredStack: asStringArray(profile?.preferredStack).join(", "),
    interests: asStringArray(profile?.interests).join(", "),
    antiInterests: asStringArray(profile?.antiInterests).join(", "),
    weeklyHours: profile?.weeklyHours ?? 10,
    currentFocus: profile?.currentFocus ?? "",
  };

  return (
    <>
      <Header
        title="Founder Profile"
        description="Personalize every analysis and build plan to you. The more you fill in, the sharper the recommendations."
      />
      <main className="flex-1 p-6">
        <Card className="max-w-2xl">
          <CardHeader>
            <CardTitle className="text-base">About you</CardTitle>
          </CardHeader>
          <CardContent>
            <FounderProfileForm initial={initial} />
          </CardContent>
        </Card>
      </main>
    </>
  );
}
