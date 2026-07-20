import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useServerFn } from "@tanstack/react-start";
import { ensureTeacherAccount } from "@/lib/teacher.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import { GraduationCap, Sparkles, Trophy, BookOpen } from "lucide-react";

export const Route = createFileRoute("/auth")({ component: AuthPage });

function AuthPage() {
  const navigate = useNavigate();
  const seedTeacher = useServerFn(ensureTeacherAccount);

  // Ensure the fixed teacher account exists on first visit (idempotent)
  useEffect(() => {
    seedTeacher().catch(() => {});
  }, [seedTeacher]);

  async function afterLogin() {
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) return;
    const { data: roles } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userData.user.id);
    const isTeacher = (roles ?? []).some((r) => r.role === "teacher");
    navigate({ to: isTeacher ? "/teacher" : "/student" });
  }

  return (
    <main className="min-h-screen px-4 py-10 md:py-16">
      <div className="mx-auto max-w-6xl">
        <header className="mb-10 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="grid h-10 w-10 place-items-center rounded-2xl bg-primary text-2xl">🐱</div>
            <span className="text-2xl font-extrabold tracking-tight">
              Meow<span className="text-primary"> English</span> <span className="text-secondary">🐾</span>
            </span>
          </div>
        </header>

        <div className="grid items-center gap-10 md:grid-cols-2">
          <section>
            <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-accent px-3 py-1 text-xs font-bold text-accent-foreground">
              <Sparkles className="h-3.5 w-3.5" /> Aprenda inglês com os gatinhos 🐈
            </div>
            <h1 className="text-4xl md:text-6xl leading-tight">
              Ronrone em inglês,
              <br />
              <span className="text-primary">um passinho fofo</span>
              <br />
              <span className="text-secondary">de cada vez. 🐾</span>
            </h1>
            <p className="mt-5 max-w-md text-base text-muted-foreground">
              Fases rápidas, testes divertidos e uma trilha felina que te faz voltar sempre. Miau! 😺
            </p>
            <div className="mt-8 grid max-w-md grid-cols-3 gap-3">
              <Feature icon={<BookOpen className="h-5 w-5" />} label="Fases 🐾" />
              <Feature icon={<Trophy className="h-5 w-5" />} label="Testes 🐟" />
              <Feature icon={<GraduationCap className="h-5 w-5" />} label="Progresso 😸" />
            </div>
          </section>

          <Card className="rounded-3xl border-2 p-6 shadow-xl">
            <div className="mb-4 text-center">
              <h2 className="text-2xl">Entrar 🐾</h2>
              <p className="text-xs text-muted-foreground mt-1">
                Só a professora cria contas. Peça seu login para ela!
              </p>
            </div>
            <LoginForm onDone={afterLogin} />
          </Card>
        </div>
      </div>
    </main>
  );
}

function Feature({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-2xl bg-card p-3 text-center shadow-sm">
      <div className="grid h-9 w-9 place-items-center rounded-xl bg-accent text-accent-foreground">{icon}</div>
      <span className="text-xs font-bold">{label}</span>
    </div>
  );
}

function LoginForm({ onDone }: { onDone: () => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  return (
    <form
      className="space-y-4"
      onSubmit={async (e) => {
        e.preventDefault();
        setLoading(true);
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        setLoading(false);
        if (error) return toast.error(error.message);
        toast.success("Miau! Bem-vindo(a) de volta 🐱");
        onDone();
      }}
    >
      <div className="space-y-1.5">
        <Label htmlFor="email">E-mail</Label>
        <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required className="rounded-xl" />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="password">Senha</Label>
        <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required className="rounded-xl" />
      </div>
      <Button type="submit" disabled={loading} className="w-full rounded-2xl py-6 text-base font-bold btn-pop">
        {loading ? "Entrando..." : "Entrar"}
      </Button>
    </form>
  );
}
