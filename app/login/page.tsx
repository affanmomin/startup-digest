import { Sparkles } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { loginAction } from "@/app/login/actions";

export const dynamic = "force-dynamic";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; next?: string }>;
}) {
  const { error, next } = await searchParams;

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/40 p-6">
      <Card className="w-full max-w-sm">
        <CardHeader className="space-y-2 text-center">
          <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <Sparkles className="h-5 w-5" />
          </div>
          <CardTitle>Startup Digest</CardTitle>
          <p className="text-sm text-muted-foreground">
            Enter your password to continue.
          </p>
        </CardHeader>
        <CardContent>
          <form action={loginAction} className="space-y-3">
            <input type="hidden" name="next" value={next ?? "/"} />
            <Input
              type="password"
              name="password"
              placeholder="Password"
              autoFocus
              required
            />
            {error ? (
              <p className="text-sm text-destructive">Incorrect password.</p>
            ) : null}
            <Button type="submit" className="w-full">
              Sign in
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
