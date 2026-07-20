import { Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { LogOut } from "lucide-react";

export function AppHeader({ title, subtitle, mode }: { title: string; subtitle?: string; mode?: "student" | "teacher" }) {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [name, setName] = useState<string>("");

  useEffect(() => {
    (async () => {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) return;
      const { data: profile } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("id", userData.user.id)
        .maybeSingle();
      setName(profile?.full_name ?? "");
    })();
  }, []);

  async function signOut() {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  return (
    <header className="sticky top-0 z-30 border-b bg-background/80 backdrop-blur">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
        <Link to="/" className="flex items-center gap-2">
          <div className="grid h-9 w-9 place-items-center rounded-2xl bg-primary text-xl">🐱</div>
          <div className="leading-tight">
            <div className="text-sm font-extrabold">Meow English 🐾</div>
            <div className="text-[11px] text-muted-foreground">{subtitle ?? title}</div>
          </div>
        </Link>
        <div className="flex items-center gap-2">
          {name && mode === "student" && (
            <div className="hidden rounded-full bg-accent px-3 py-1 text-xs font-bold sm:block">
              Olá, {name.split(" ")[0]} 👋
            </div>
          )}
          {mode === "teacher" && (
            <div className="hidden rounded-full bg-secondary px-3 py-1 text-xs font-bold text-secondary-foreground sm:block">
              Modo Professor
            </div>
          )}
          <Button variant="ghost" size="sm" className="rounded-xl" onClick={signOut}>
            <LogOut className="mr-1 h-4 w-4" /> Sair
          </Button>
        </div>
      </div>
    </header>
  );
}
