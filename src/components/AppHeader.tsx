import { Link, useNavigate } from "@tanstack/react-router";
import { useApp } from "@/lib/app-store";
import { Button } from "@/components/ui/button";
import { LogOut } from "lucide-react";

export function AppHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  const app = useApp();
  const navigate = useNavigate();
  const student = app.currentStudent();
  return (
    <header className="sticky top-0 z-30 border-b bg-background/80 backdrop-blur">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
        <Link to="/" className="flex items-center gap-2">
          <div className="grid h-9 w-9 place-items-center rounded-2xl bg-primary text-xl">🦉</div>
          <div className="leading-tight">
            <div className="text-sm font-extrabold">LinguaPath</div>
            <div className="text-[11px] text-muted-foreground">{subtitle ?? title}</div>
          </div>
        </Link>
        <div className="flex items-center gap-2">
          {student && (
            <div className="hidden rounded-full bg-accent px-3 py-1 text-xs font-bold sm:block">
              Hi, {student.name.split(" ")[0]} 👋
            </div>
          )}
          {app.session?.kind === "teacher" && (
            <div className="hidden rounded-full bg-secondary px-3 py-1 text-xs font-bold text-secondary-foreground sm:block">
              Teacher mode
            </div>
          )}
          <Button
            variant="ghost"
            size="sm"
            className="rounded-xl"
            onClick={() => { app.logout(); navigate({ to: "/" }); }}
          >
            <LogOut className="mr-1 h-4 w-4" /> Logout
          </Button>
        </div>
      </div>
    </header>
  );
}
