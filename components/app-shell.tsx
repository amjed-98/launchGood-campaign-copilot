import Link from "next/link";
import { BarChart3, ListChecks, PlusCircle, ShieldCheck } from "lucide-react";

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-30 border-b bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3 sm:px-6 lg:px-8">
          <Link href="/dashboard" className="flex min-w-0 items-center gap-3">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-md bg-primary text-primary-foreground shadow-sm">
              <ShieldCheck className="size-5" aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-primary">LaunchGood</p>
              <p className="truncate text-xs text-muted-foreground">Trust & Safety operations</p>
            </div>
          </Link>
          <nav className="flex shrink-0 items-center gap-1 text-sm">
            <Link className="inline-flex items-center gap-2 rounded-md px-3 py-2 font-medium text-muted-foreground hover:bg-muted hover:text-foreground" href="/dashboard">
              <ListChecks className="size-4" aria-hidden="true" />
              Queue
            </Link>
            <Link className="inline-flex items-center gap-2 rounded-md px-3 py-2 font-medium text-muted-foreground hover:bg-muted hover:text-foreground" href="/intake">
              <PlusCircle className="size-4" aria-hidden="true" />
              Intake
            </Link>
            <Link className="inline-flex items-center gap-2 rounded-md px-3 py-2 font-medium text-muted-foreground hover:bg-muted hover:text-foreground" href="/ops">
              <BarChart3 className="size-4" aria-hidden="true" />
              Ops
            </Link>
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">{children}</main>
    </div>
  );
}
