"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  Check,
  Copy,
  Download,
  Loader2,
  Sparkles,
  RefreshCw,
  Wrench,
} from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  ARTIFACT_TYPES,
  ARTIFACT_META,
  type ArtifactType,
} from "@/lib/artifact-meta";
import {
  generateArtifactAction,
  generateAllArtifactsAction,
} from "@/app/actions";

export interface KitArtifact {
  type: string;
  content: string;
}

function slugify(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "product";
}

function download(filename: string, text: string) {
  const blob = new Blob([text], { type: "text/markdown;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export function BuildKit({
  productId,
  productName,
  artifacts,
}: {
  productId: string;
  productName: string;
  artifacts: KitArtifact[];
}) {
  const router = useRouter();
  const byType = React.useMemo(() => {
    const m: Partial<Record<ArtifactType, string>> = {};
    for (const a of artifacts) {
      if ((ARTIFACT_TYPES as readonly string[]).includes(a.type)) {
        m[a.type as ArtifactType] = a.content;
      }
    }
    return m;
  }, [artifacts]);

  const firstWithContent =
    ARTIFACT_TYPES.find((t) => byType[t]) ?? ARTIFACT_TYPES[0];
  const [active, setActive] = React.useState<ArtifactType>(firstWithContent);
  const [busy, setBusy] = React.useState<string | null>(null); // type or "ALL"
  const [error, setError] = React.useState<string | null>(null);
  const [copied, setCopied] = React.useState(false);

  const generatedCount = ARTIFACT_TYPES.filter((t) => byType[t]).length;
  const slug = slugify(productName);

  // After a refresh/generation, if the active tab is empty but others have
  // content, move to the first populated tab (handles partial "generate all").
  React.useEffect(() => {
    if (!byType[active] && generatedCount > 0) {
      const next = ARTIFACT_TYPES.find((t) => byType[t]);
      if (next) setActive(next);
    }
  }, [byType, active, generatedCount]);

  async function gen(type: ArtifactType) {
    setBusy(type);
    setError(null);
    const res = await generateArtifactAction(productId, type);
    if (!res.ok) setError(res.message);
    else {
      setActive(type);
      router.refresh();
    }
    setBusy(null);
  }

  async function genAll() {
    setBusy("ALL");
    setError(null);
    const res = await generateAllArtifactsAction(productId);
    if (!res.ok) setError(res.message);
    else router.refresh();
    setBusy(null);
  }

  function copy(text: string) {
    navigator.clipboard?.writeText(text).then(
      () => {
        setCopied(true);
        setTimeout(() => setCopied(false), 1800);
      },
      () => setError("Couldn't copy to clipboard.")
    );
  }

  function downloadKit() {
    const parts = ARTIFACT_TYPES.filter((t) => byType[t]).map(
      (t) => `# ${ARTIFACT_META[t].label}\n\n${byType[t]}`
    );
    download(`${slug}-build-kit.md`, parts.join("\n\n---\n\n"));
  }

  const activeContent = byType[active];

  return (
    <Card className="border-primary/30">
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Wrench className="h-5 w-5 text-primary" />
            Build Kit
            <Badge variant="secondary">{generatedCount}/{ARTIFACT_TYPES.length}</Badge>
          </CardTitle>
          <div className="flex items-center gap-2">
            {generatedCount > 0 ? (
              <Button variant="outline" size="sm" onClick={downloadKit}>
                <Download className="h-4 w-4" />
                Download kit
              </Button>
            ) : null}
            <Button size="sm" disabled={busy !== null} onClick={genAll}>
              {busy === "ALL" ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Sparkles className="h-4 w-4" />
              )}
              {generatedCount === ARTIFACT_TYPES.length ? "Regenerate all" : "Generate full kit"}
            </Button>
          </div>
        </div>
        <p className="text-sm text-muted-foreground">
          Everything you need to go from idea to building it — personalized to you.
        </p>
        {error ? <p className="text-xs text-destructive">{error}</p> : null}
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Tabs */}
        <div className="flex flex-wrap gap-1 border-b">
          {ARTIFACT_TYPES.map((t) => {
            const has = !!byType[t];
            return (
              <button
                key={t}
                type="button"
                onClick={() => setActive(t)}
                className={cn(
                  "flex items-center gap-1.5 border-b-2 px-3 py-2 text-sm font-medium transition-colors",
                  active === t
                    ? "border-primary text-foreground"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                )}
              >
                {has ? (
                  <Check className="h-3.5 w-3.5 text-emerald-600" />
                ) : (
                  <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/40" />
                )}
                {ARTIFACT_META[t].label}
              </button>
            );
          })}
        </div>

        {/* Panel */}
        <div>
          <p className="mb-3 text-sm text-muted-foreground">
            {ARTIFACT_META[active].short}
          </p>

          {!activeContent ? (
            <div className="rounded-lg border border-dashed p-8 text-center">
              <p className="mb-3 text-sm text-muted-foreground">
                Not generated yet.
              </p>
              <Button size="sm" disabled={busy !== null} onClick={() => gen(active)}>
                {busy === active ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Sparkles className="h-4 w-4" />
                )}
                Generate {ARTIFACT_META[active].label}
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <Button variant="outline" size="sm" onClick={() => copy(activeContent)}>
                  {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  {copied ? "Copied" : "Copy"}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => download(`${slug}-${active.toLowerCase()}.md`, activeContent)}
                >
                  <Download className="h-4 w-4" />
                  Download .md
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={busy !== null}
                  onClick={() => gen(active)}
                >
                  {busy === active ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <RefreshCw className="h-4 w-4" />
                  )}
                  Regenerate
                </Button>
              </div>
              <div className="max-h-[600px] overflow-auto rounded-lg border bg-muted/20 p-5">
                <div className="prose prose-sm max-w-none prose-headings:scroll-mt-20 prose-pre:bg-slate-900 prose-pre:text-slate-50">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>
                    {activeContent}
                  </ReactMarkdown>
                </div>
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
