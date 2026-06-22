"use client";

import * as React from "react";
import { Loader2, Save } from "lucide-react";

import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { saveFounderProfileAction } from "@/app/actions";

export interface ProfileValues {
  skills: string;
  preferredStack: string;
  interests: string;
  antiInterests: string;
  weeklyHours: number;
  currentFocus: string;
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <label className="text-sm font-medium">{label}</label>
      {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
      {children}
    </div>
  );
}

export function FounderProfileForm({ initial }: { initial: ProfileValues }) {
  const [saving, setSaving] = React.useState(false);
  const [saved, setSaved] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);
    setSaved(false);
    setError(null);
    const fd = new FormData(e.currentTarget);
    const res = await saveFounderProfileAction(fd);
    setSaving(false);
    if (res.ok) {
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } else {
      setError(res.message);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-5">
      <Field label="Skills" hint="Comma-separated. Fed into every analysis & build plan.">
        <Input name="skills" defaultValue={initial.skills} placeholder="Next.js, design, sales, Postgres" />
      </Field>
      <Field label="Preferred stack" hint="The tools you actually want to build with.">
        <Input name="preferredStack" defaultValue={initial.preferredStack} placeholder="Next.js, Supabase, Stripe, Vercel" />
      </Field>
      <Field label="Interested in" hint="Topics/markets you'd love to build in.">
        <Input name="interests" defaultValue={initial.interests} placeholder="developer tools, B2B SaaS, AI" />
      </Field>
      <Field label="Not interested in" hint="Topics to avoid recommending.">
        <Input name="antiInterests" defaultValue={initial.antiInterests} placeholder="crypto, social apps, hardware" />
      </Field>
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        <Field label="Hours per week" hint="Realistic build time you have.">
          <Input type="number" name="weeklyHours" min={1} max={168} defaultValue={initial.weeklyHours} />
        </Field>
        <Field label="Current focus" hint="What you're working on right now.">
          <Input name="currentFocus" defaultValue={initial.currentFocus} placeholder="Looking for my next SaaS" />
        </Field>
      </div>

      <div className="flex items-center gap-3">
        <Button type="submit" disabled={saving}>
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Save profile
        </Button>
        {saved ? <span className="text-sm text-emerald-600">Saved ✓</span> : null}
        {error ? <span className="text-sm text-destructive">{error}</span> : null}
      </div>
    </form>
  );
}
