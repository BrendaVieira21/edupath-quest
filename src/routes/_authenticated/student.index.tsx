import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AppHeader } from "@/components/AppHeader";
import { Progress } from "@/components/ui/progress";
import { Check, Lock, Star, Trophy } from "lucide-react";
import { lessonsQuery, myProgressQuery, myRoleQuery, myCheckpointsQuery } from "@/lib/queries";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useServerFn } from "@tanstack/react-start";
import { claimTeacherRole } from "@/lib/teacher.functions";
import { getMyXp } from "@/lib/gamification.functions";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/student/")({ component: StudentPage });

function StudentPage() {
  const navigate = useNavigate();
  const { data: role } = useQuery(myRoleQuery());
  const { data: lessons = [] } = useQuery(lessonsQuery());
  const { data: progress = [] } = useQuery(myProgressQuery());
  const { data: checkpoints = [] } = useQuery(myCheckpointsQuery());
  const { data: xp } = useQuery({ queryKey: ["my-xp"], queryFn: () => getMyXp() });

  useEffect(() => {
    if (role === "teacher") navigate({ to: "/teacher" });
  }, [role, navigate]);

  const completedIds = new Set(progress.filter((p) => p.completed_at).map((p) => p.lesson_id));
  const doneCheckpoints = new Set(checkpoints.filter((c) => c.completed_at).map((c) => c.checkpoint_index));
  const total = lessons.length;
  const done = completedIds.size;
  const pct = total ? Math.round((done / total) * 100) : 0;
  const currentIdx = lessons.findIndex((l) => !completedIds.has(l.id));

  // Build items: lessons with checkpoint markers inserted after every 4 lessons
  type Item = { kind: "lesson"; lesson: typeof lessons[number]; idx: number } | { kind: "checkpoint"; cpIndex: number; unlocked: boolean; done: boolean };
  const items: Item[] = [];
  lessons.forEach((lesson, i) => {
    items.push({ kind: "lesson", lesson, idx: i });
    if ((i + 1) % 4 === 0) {
      const cpIndex = Math.floor(i / 4);
      const groupStart = cpIndex * 4;
      const groupDone = lessons.slice(groupStart, groupStart + 4).every((l) => completedIds.has(l.id));
      items.push({ kind: "checkpoint", cpIndex, unlocked: groupDone, done: doneCheckpoints.has(cpIndex) });
    }
  });

  return (
    <div className="min-h-screen pb-16">
      <AppHeader title="Aluno(a)" subtitle="Sua trilha de aprendizado" mode="student" />

      <div className="mx-auto max-w-3xl px-4 pt-6">
        <div className="rounded-3xl border-2 bg-card p-5 shadow-sm">
          <div className="mb-2 flex items-center justify-between">
            <div>
              <h2 className="text-2xl">Sua jornada</h2>
              <p className="text-sm text-muted-foreground">{done} de {total} fases concluídas</p>
            </div>
            <div className="flex items-center gap-1 rounded-full bg-warning/30 px-3 py-1 text-sm font-bold text-warning-foreground">
              <Star className="h-4 w-4 fill-current" /> {xp?.balance ?? done * 10} XP
            </div>
          </div>
          <Progress value={pct} className="h-3 rounded-full" />
        </div>

        <ol className="relative mt-10 space-y-10">
          {items.map((item, i) => {
            const alignRight = i % 2 === 1;
            if (item.kind === "checkpoint") {
              return (
                <li key={`cp-${item.cpIndex}`} className="flex items-center justify-center">
                  <div className="w-full max-w-md rounded-2xl border-2 border-dashed border-warning/50 bg-warning/5 p-4 text-center">
                    <div className="mx-auto mb-2 grid h-16 w-16 place-items-center rounded-full bg-warning/30 text-3xl">
                      {item.done ? <Check className="h-8 w-8 text-success" strokeWidth={3} /> : "🏆"}
                    </div>
                    <div className="text-xs font-bold uppercase tracking-wider text-warning-foreground">Checkpoint {item.cpIndex + 1}</div>
                    <div className="text-lg font-bold">Teste de revisão</div>
                    <div className="text-sm text-muted-foreground">Gerado por IA com base nas 4 últimas aulas</div>
                    {item.unlocked ? (
                      <Link to="/student/checkpoint/$index" params={{ index: String(item.cpIndex) }}
                        className="mt-3 inline-block rounded-xl bg-warning px-4 py-2 text-sm font-bold text-warning-foreground btn-pop">
                        {item.done ? "Refazer" : "Iniciar teste"}
                      </Link>
                    ) : (
                      <div className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-muted-foreground">
                        <Lock className="h-3 w-3" /> Complete as 4 aulas anteriores
                      </div>
                    )}
                  </div>
                </li>
              );
            }
            const { lesson, idx: i2 } = item;
            const isDone = completedIds.has(lesson.id);
            const isCurrent = i2 === currentIdx;
            const isLocked = !isDone && !isCurrent;

            return (
              <li key={lesson.id} className={`flex items-center ${alignRight ? "justify-end" : "justify-start"}`}>
                <div className={`flex w-full max-w-md items-center gap-4 ${alignRight ? "flex-row-reverse" : ""}`}>
                  <PathNode emoji={lesson.emoji} state={isDone ? "done" : isCurrent ? "current" : "locked"} />
                  <div className={`flex-1 ${alignRight ? "text-right" : ""}`}>
                    <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Fase {i2 + 1}</div>
                    <div className="text-lg font-bold">{lesson.title}</div>
                    <div className="text-sm text-muted-foreground">{lesson.description}</div>
                    {!isLocked ? (
                      <Link to="/student/lesson/$lessonId" params={{ lessonId: lesson.id }}
                        className="mt-2 inline-block rounded-xl bg-primary px-3 py-1.5 text-xs font-bold text-primary-foreground btn-pop">
                        {isDone ? "Revisar" : "Começar"}
                      </Link>
                    ) : (
                      <div className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-muted-foreground">
                        <Lock className="h-3 w-3" /> Bloqueada
                      </div>
                    )}
                  </div>
                </div>
              </li>
            );
          })}
        </ol>

        <div className="mt-16">
          <TeacherClaim />
        </div>
      </div>
    </div>
  );
}

function PathNode({ emoji, state }: { emoji: string; state: "done" | "current" | "locked" }) {
  const base = "grid h-20 w-20 shrink-0 place-items-center rounded-full text-3xl select-none";
  if (state === "done")
    return <div className={`${base} bg-success text-success-foreground node-shadow-done`}><Check className="h-8 w-8" strokeWidth={3} /></div>;
  if (state === "current")
    return <div className={`${base} bg-primary text-primary-foreground node-shadow animate-pulse`}>{emoji}</div>;
  return <div className={`${base} bg-muted text-muted-foreground node-shadow-locked opacity-70`}><Lock className="h-7 w-7" /></div>;
}


function TeacherClaim() {
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const claim = useServerFn(claimTeacherRole);
  const qc = useQueryClient();

  async function handleClaim(e: React.FormEvent) {
    e.preventDefault();
    if (!code.trim()) return;
    setLoading(true);
    try {
      await claim({ data: { code: code.trim() } });
      toast.success("Bem-vindo(a), professor(a)!");
      qc.invalidateQueries({ queryKey: myRoleQuery().queryKey });
    } catch (err) {
      toast.error("Código de convite inválido.");
    }
    setLoading(false);
  }

  return (
    <form onSubmit={handleClaim} className="mx-auto flex max-w-sm items-center gap-2 rounded-2xl bg-muted/50 p-3 opacity-50 transition-opacity hover:opacity-100">
      <Input type="password" value={code} onChange={(e) => setCode(e.target.value)} placeholder="Código secreto de professor" className="rounded-xl bg-background text-sm" />
      <Button type="submit" disabled={loading} size="sm" className="rounded-xl btn-pop shrink-0">
        {loading ? "..." : "Ativar"}
      </Button>
    </form>
  );
}
