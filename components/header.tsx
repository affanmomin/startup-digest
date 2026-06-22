import Link from "next/link";
import { Sparkles } from "lucide-react";

interface HeaderProps {
  title: string;
  description?: string;
  children?: React.ReactNode;
}

export function Header({ title, description, children }: HeaderProps) {
  return (
    <header className="flex flex-col gap-4 border-b bg-background px-6 py-5 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-center gap-3">
        <Link href="/" className="md:hidden">
          <Sparkles className="h-5 w-5 text-primary" />
        </Link>
        <div>
          <h1 className="text-lg font-semibold tracking-tight">{title}</h1>
          {description ? (
            <p className="text-sm text-muted-foreground">{description}</p>
          ) : null}
        </div>
      </div>
      {children ? <div className="flex items-center gap-2">{children}</div> : null}
    </header>
  );
}
