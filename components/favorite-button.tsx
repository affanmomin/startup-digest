"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Star } from "lucide-react";

import { cn } from "@/lib/utils";
import { toggleFavoriteAction } from "@/app/actions";

export function FavoriteButton({
  productId,
  favorite,
  size = 16,
  className,
}: {
  productId: string;
  favorite: boolean;
  size?: number;
  className?: string;
}) {
  const router = useRouter();
  const [fav, setFav] = React.useState(favorite);
  const [pending, setPending] = React.useState(false);

  React.useEffect(() => setFav(favorite), [favorite]);

  async function toggle(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (pending) return;
    const next = !fav;
    setPending(true);
    setFav(next);
    const res = await toggleFavoriteAction(productId);
    if (!res.ok) setFav(!next);
    else router.refresh();
    setPending(false);
  }

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={pending}
      title={fav ? "Unfavorite" : "Favorite"}
      aria-pressed={fav}
      className={cn(
        "inline-flex items-center justify-center rounded-md p-1 transition-colors hover:bg-accent disabled:opacity-50",
        className
      )}
    >
      <Star
        style={{ width: size, height: size }}
        className={cn(
          fav ? "fill-amber-400 text-amber-400" : "text-muted-foreground"
        )}
      />
    </button>
  );
}
