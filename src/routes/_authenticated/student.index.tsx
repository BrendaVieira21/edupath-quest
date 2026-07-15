import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { AppHeader } from "@/components/AppHeader";
import { Progress } from "@/components/ui/progress";
import { Check, Lock, Star } from "lucide-react";
import { lessonsQuery, myProgressQuery, myRoleQuery } from "@/lib/queries";

export const Route = createFileRoute("/_authenticated/student/")({ component: StudentPage });

function StudentPage() {
  const navigate = useNavigate();
  const { data: role } = useQuery(myRoleQuery());
  const { data: lessons = [] } = useQuery(lessonsQuery());
  const { data: progress = [] } = useQuery(myProgressQuery());

  useEffect(() => {
    if (role === "teacher") navigate({ to: "/teacher" });
  }, [role, navigate]);

  const completedIds = new Set(progress.filter((p) => p.completed_at).map((p) => p.lesson_id));
  const total = lessons.length;
  const done = completedIds.size;
  const pct = total ? Math.round((done / total) * 100) : 0;
  const currentIdx = lessons.findIndex((l) => !completedIds.has(l.id));

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
              <Star className="h-4 w-4 fill-current" /> {done * 10} XP
            </div>
          </div>
          <Progress value={pct} className="h-3 rounded-full" />
        </div>

        <ol className="relative mt-10 space-y-10">
          {lessons.map((lesson, i) => {
            const isDone = completedIds.has(lesson.id);
            const isCurrent = i === currentIdx;
            const isLocked = !isDone && !isCurrent;
            const alignRight = i % 2 === 1;

            return (
              <li key={lesson.id} className={`flex items-center ${alignRight ? "justify-end" : "justify-start"}`}>
                <div className={`flex w-full max-w-md items-center gap-4 ${alignRight ? "flex-row-reverse" : ""}`}>
                  <PathNode emoji={lesson.emoji} state={isDone ? "done" : isCurrent ? "current" : "locked"} />
                  <div className={`flex-1 ${alignRight ? "text-right" : ""}`}>
                    <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Fase {i + 1}</div>
                    <div className="text-lg font-bold">{lesson.title}</div>
                    <div className="text-sm text-muted-foreground">{lesson.description}</div>
                    {!isLocked ? (
                      <Link
                        to="/student/lesson/$lessonId"
                        params={{ lessonId: lesson.id }}
                        className="mt-2 inline-block rounded-xl bg-primary px-3 py-1.5 text-xs font-bold text-primary-foreground btn-pop"
                      >
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
