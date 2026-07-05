import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect } from "react";
import { useApp } from "@/lib/app-store";
import { AppHeader } from "@/components/AppHeader";
import { Progress } from "@/components/ui/progress";
import { Check, Lock, Star } from "lucide-react";

export const Route = createFileRoute("/student")({ component: StudentPage });

function StudentPage() {
  const app = useApp();
  const navigate = useNavigate();
  const student = app.currentStudent();

  useEffect(() => {
    if (app.hydrated && app.session?.kind !== "student") navigate({ to: "/" });
  }, [app.hydrated, app.session, navigate]);

  if (!app.hydrated) return null;
  if (!student) return null;

  const total = app.lessons.length;
  const done = student.completedLessons.length;
  const pct = total ? Math.round((done / total) * 100) : 0;

  // First non-completed lesson is the "current" unlocked one
  const currentIdx = app.lessons.findIndex((l) => !student.completedLessons.includes(l.id));

  return (
    <div className="min-h-screen pb-16">
      <AppHeader title="Student" subtitle="Your learning path" />

      <div className="mx-auto max-w-3xl px-4 pt-6">
        <div className="rounded-3xl border-2 bg-card p-5 shadow-sm">
          <div className="mb-2 flex items-center justify-between">
            <div>
              <h2 className="text-2xl">Your journey</h2>
              <p className="text-sm text-muted-foreground">{done} of {total} phases completed</p>
            </div>
            <div className="flex items-center gap-1 rounded-full bg-warning/30 px-3 py-1 text-sm font-bold text-warning-foreground">
              <Star className="h-4 w-4 fill-current" /> {done * 10} XP
            </div>
          </div>
          <Progress value={pct} className="h-3 rounded-full" />
        </div>

        <ol className="relative mt-10 space-y-10">
          {app.lessons.map((lesson, i) => {
            const isDone = student.completedLessons.includes(lesson.id);
            const isCurrent = i === currentIdx;
            const isLocked = !isDone && !isCurrent;
            const alignRight = i % 2 === 1;

            return (
              <li key={lesson.id} className={`flex items-center ${alignRight ? "justify-end" : "justify-start"}`}>
                <div className={`flex w-full max-w-md items-center gap-4 ${alignRight ? "flex-row-reverse" : ""}`}>
                  <PathNode lesson={lesson} state={isDone ? "done" : isCurrent ? "current" : "locked"} disabled={isLocked} />
                  <div className={`flex-1 ${alignRight ? "text-right" : ""}`}>
                    <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                      Phase {i + 1}
                    </div>
                    <div className="text-lg font-bold">{lesson.title}</div>
                    <div className="text-sm text-muted-foreground">{lesson.description}</div>
                    {!isLocked ? (
                      <Link
                        to="/student/lesson/$lessonId"
                        params={{ lessonId: lesson.id }}
                        className="mt-2 inline-block rounded-xl bg-primary px-3 py-1.5 text-xs font-bold text-primary-foreground btn-pop"
                      >
                        {isDone ? "Review" : "Start"}
                      </Link>
                    ) : (
                      <div className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-muted-foreground">
                        <Lock className="h-3 w-3" /> Locked
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

function PathNode({ lesson, state, disabled }: { lesson: { emoji: string }; state: "done" | "current" | "locked"; disabled: boolean }) {
  const base = "grid h-20 w-20 shrink-0 place-items-center rounded-full text-3xl select-none";
  if (state === "done") {
    return (
      <div className={`${base} bg-success text-success-foreground node-shadow-done`}>
        <Check className="h-8 w-8" strokeWidth={3} />
      </div>
    );
  }
  if (state === "current") {
    return (
      <div className={`${base} bg-primary text-primary-foreground node-shadow animate-pulse`}>
        {lesson.emoji}
      </div>
    );
  }
  return (
    <div className={`${base} bg-muted text-muted-foreground node-shadow-locked ${disabled ? "opacity-70" : ""}`}>
      <Lock className="h-7 w-7" />
    </div>
  );
}
