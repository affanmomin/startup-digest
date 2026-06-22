"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowUpRight, ChevronUp, Loader2, Sparkles } from "lucide-react";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { WorthBuildingBadge } from "@/components/score-badge";
import { OpportunityBadge } from "@/components/opportunity-badge";
import { StatusBadge } from "@/components/status-control";
import { FavoriteButton } from "@/components/favorite-button";
import { cn } from "@/lib/utils";
import { analyzeProductAction } from "@/app/actions";

export interface ProductRow {
  id: string;
  name: string;
  tagline: string;
  upvotes: number;
  opportunityScore: number | null;
  cloneScore: number | null;
  buildDifficulty: number | null;
  mvpTime: string | null;
  worthBuilding: boolean | null;
  status: string;
  favorite: boolean;
  topics: string[];
  analyzed: boolean;
}

type SortKey = "opportunity" | "upvotes" | "clone" | "difficulty";
type StatusFilter = "ALL" | "NEW" | "SAVED" | "BUILDING" | "PASSED";

const SORTS: { key: SortKey; label: string }[] = [
  { key: "opportunity", label: "Opportunity" },
  { key: "upvotes", label: "Upvotes" },
  { key: "clone", label: "Clone score" },
  { key: "difficulty", label: "Easiest build" },
];

const STATUS_FILTERS: StatusFilter[] = [
  "ALL",
  "NEW",
  "SAVED",
  "BUILDING",
  "PASSED",
];

export function ProductTable({ products }: { products: ProductRow[] }) {
  const router = useRouter();
  const [query, setQuery] = React.useState("");
  const [sort, setSort] = React.useState<SortKey>("opportunity");
  const [statusFilter, setStatusFilter] = React.useState<StatusFilter>("ALL");
  const [worthOnly, setWorthOnly] = React.useState(false);
  const [favOnly, setFavOnly] = React.useState(false);
  const [topic, setTopic] = React.useState<string>("ALL");
  const [analyzingId, setAnalyzingId] = React.useState<string | null>(null);

  const allTopics = React.useMemo(() => {
    const set = new Set<string>();
    products.forEach((p) => p.topics.forEach((t) => set.add(t)));
    return Array.from(set).sort();
  }, [products]);

  const view = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    let rows = products.filter((p) => {
      if (q && !p.name.toLowerCase().includes(q) && !p.tagline.toLowerCase().includes(q))
        return false;
      if (statusFilter !== "ALL" && p.status !== statusFilter) return false;
      if (worthOnly && !p.worthBuilding) return false;
      if (favOnly && !p.favorite) return false;
      if (topic !== "ALL" && !p.topics.includes(topic)) return false;
      return true;
    });

    rows = [...rows].sort((a, b) => {
      switch (sort) {
        case "upvotes":
          return b.upvotes - a.upvotes;
        case "clone":
          return (b.cloneScore ?? -1) - (a.cloneScore ?? -1);
        case "difficulty":
          return (a.buildDifficulty ?? 99) - (b.buildDifficulty ?? 99);
        case "opportunity":
        default:
          return (b.opportunityScore ?? -1) - (a.opportunityScore ?? -1);
      }
    });
    return rows;
  }, [products, query, sort, statusFilter, worthOnly, favOnly, topic]);

  async function handleAnalyze(id: string) {
    setAnalyzingId(id);
    try {
      await analyzeProductAction(id);
      router.refresh();
    } finally {
      setAnalyzingId(null);
    }
  }

  return (
    <div className="space-y-4">
      {/* Controls */}
      <div className="flex flex-wrap items-center gap-3">
        <Input
          placeholder="Search name or tagline…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="max-w-xs"
        />

        <div className="flex items-center gap-1 rounded-md border p-0.5">
          {SORTS.map((s) => (
            <button
              key={s.key}
              type="button"
              onClick={() => setSort(s.key)}
              className={cn(
                "rounded px-2.5 py-1 text-xs font-medium transition-colors",
                sort === s.key
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-accent"
              )}
            >
              {s.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-1 rounded-md border p-0.5">
          {STATUS_FILTERS.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setStatusFilter(s)}
              className={cn(
                "rounded px-2.5 py-1 text-xs font-medium capitalize transition-colors",
                statusFilter === s
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-accent"
              )}
            >
              {s === "ALL" ? "All" : s.toLowerCase()}
            </button>
          ))}
        </div>

        <button
          type="button"
          onClick={() => setWorthOnly((v) => !v)}
          className={cn(
            "rounded-md border px-2.5 py-1.5 text-xs font-medium transition-colors",
            worthOnly
              ? "bg-emerald-100 text-emerald-800"
              : "text-muted-foreground hover:bg-accent"
          )}
        >
          Worth building only
        </button>

        <button
          type="button"
          onClick={() => setFavOnly((v) => !v)}
          className={cn(
            "rounded-md border px-2.5 py-1.5 text-xs font-medium transition-colors",
            favOnly
              ? "bg-amber-100 text-amber-800"
              : "text-muted-foreground hover:bg-accent"
          )}
        >
          ★ Favorites
        </button>

        {allTopics.length > 0 ? (
          <select
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            className="h-8 rounded-md border bg-background px-2 text-xs"
          >
            <option value="ALL">All topics</option>
            {allTopics.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        ) : null}

        <span className="ml-auto text-xs text-muted-foreground">
          {view.length} of {products.length}
        </span>
      </div>

      <div className="rounded-xl border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Product</TableHead>
              <TableHead className="w-24">Opportunity</TableHead>
              <TableHead className="w-16">Upvotes</TableHead>
              <TableHead className="w-20">Clone</TableHead>
              <TableHead className="w-24">Difficulty</TableHead>
              <TableHead className="w-28">MVP Time</TableHead>
              <TableHead className="w-28">Status</TableHead>
              <TableHead className="w-28">Worth</TableHead>
              <TableHead className="w-24 text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {view.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} className="py-10 text-center text-muted-foreground">
                  {products.length === 0
                    ? "No products yet. Click “Sync Product Hunt” to fetch launches."
                    : "No products match your filters."}
                </TableCell>
              </TableRow>
            ) : (
              view.map((p) => (
                <TableRow key={p.id}>
                  <TableCell>
                    <Link
                      href={`/products/${p.id}`}
                      className="font-medium hover:underline"
                    >
                      {p.name}
                    </Link>
                    <div className="text-xs text-muted-foreground line-clamp-1">
                      {p.tagline}
                    </div>
                  </TableCell>
                  <TableCell>
                    {p.opportunityScore != null ? (
                      <OpportunityBadge score={p.opportunityScore} showLabel={false} />
                    ) : (
                      "—"
                    )}
                  </TableCell>
                  <TableCell>
                    <span className="inline-flex items-center gap-1 text-sm">
                      <ChevronUp className="h-3 w-3" />
                      {p.upvotes}
                    </span>
                  </TableCell>
                  <TableCell>
                    {p.cloneScore != null ? `${p.cloneScore}/10` : "—"}
                  </TableCell>
                  <TableCell>
                    {p.buildDifficulty != null ? `${p.buildDifficulty}/10` : "—"}
                  </TableCell>
                  <TableCell className="text-sm">{p.mvpTime ?? "—"}</TableCell>
                  <TableCell>
                    <StatusBadge status={p.status} />
                  </TableCell>
                  <TableCell>
                    {p.analyzed && p.worthBuilding != null ? (
                      <WorthBuildingBadge worth={p.worthBuilding} />
                    ) : (
                      <Badge variant="outline">Not analyzed</Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <FavoriteButton productId={p.id} favorite={p.favorite} />
                      {!p.analyzed ? (
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={analyzingId === p.id}
                          onClick={() => handleAnalyze(p.id)}
                          title="Analyze"
                        >
                          {analyzingId === p.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Sparkles className="h-4 w-4" />
                          )}
                        </Button>
                      ) : null}
                      <Button asChild variant="ghost" size="sm">
                        <Link href={`/products/${p.id}`}>
                          <ArrowUpRight className="h-4 w-4" />
                        </Link>
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
