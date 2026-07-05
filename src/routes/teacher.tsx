import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect } from "react";
import { useApp } from "@/lib/app-store";
import { AppHeader } from "@/components/AppHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, Users, BookOpen, Pencil, ArrowUp, ArrowDown } from "lucide-react";

export const Route = createFileRoute("/teacher")({ component: TeacherPage });

function TeacherPage() {
  const app = useApp();
  const navigate = useNavigate();

  useEffect(() => {
    if (app.hydrated && app.session?.kind !== "teacher") navigate({ to: "/" });
  }, [app.hydrated, app.session, navigate]);

  if (!app.hydrated) return null;

  const total = app.lessons.length;

  return (
    <div className="min-h-screen pb-16">
      <AppHeader title="Teacher" subtitle="Manage lessons & students" />
      <div className="mx-auto max-w-5xl px-4 pt-6">
        <div className="mb-6 flex items-end justify-between gap-4">
          <div>
            <h1 className="text-3xl">Teacher dashboard</h1>
            <p className="text-sm text-muted-foreground">Create lessons and track student progress.</p>
          </div>
          <Link to="/teacher/new-lesson">
            <Button className="rounded-2xl py-6 px-5 text-sm font-bold btn-pop">
              <Plus className="mr-1 h-4 w-4" /> New lesson
            </Button>
          </Link>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          <Card className="rounded-3xl border-2 p-5">
            <div className="mb-4 flex items-center gap-2">
              <div className="grid h-9 w-9 place-items-center rounded-xl bg-primary/20 text-primary"><BookOpen className="h-5 w-5" /></div>
              <h2 className="text-lg">Lessons ({total})</h2>
            </div>
            <div className="space-y-2">
              {app.lessons.length === 0 && (
                <p className="rounded-2xl border-2 border-dashed p-6 text-center text-sm text-muted-foreground">
                  No lessons yet. Click <b>New lesson</b> to create your first phase.
                </p>
              )}
              {app.lessons.map((l, i) => (
                <div key={l.id} className="flex items-center gap-3 rounded-2xl border-2 p-3">
                  <div className="grid h-10 w-10 place-items-center rounded-xl bg-accent text-xl">{l.emoji}</div>
                  <div className="flex-1 min-w-0">
                    <div className="truncate text-sm font-bold">Phase {i + 1}: {l.title}</div>
                    <div className="text-xs text-muted-foreground">{l.quiz.length} question{l.quiz.length === 1 ? "" : "s"}</div>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg" disabled={i === 0} onClick={() => app.moveLesson(l.id, -1)} title="Move up">
                      <ArrowUp className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg" disabled={i === app.lessons.length - 1} onClick={() => app.moveLesson(l.id, 1)} title="Move down">
                      <ArrowDown className="h-4 w-4" />
                    </Button>
                    <Link to="/teacher/new-lesson" search={{ id: l.id }}>
                      <Button variant="outline" size="sm" className="rounded-xl">
                        <Pencil className="mr-1 h-3.5 w-3.5" /> Edit
                      </Button>
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          </Card>

          <Card className="rounded-3xl border-2 p-5">
            <div className="mb-4 flex items-center gap-2">
              <div className="grid h-9 w-9 place-items-center rounded-xl bg-secondary/30 text-secondary-foreground"><Users className="h-5 w-5" /></div>
              <h2 className="text-lg">Students ({app.students.length})</h2>
            </div>
            <div className="overflow-hidden rounded-2xl border-2">
              <table className="w-full text-sm">
                <thead className="bg-muted text-left text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2">Student</th>
                    <th className="px-3 py-2">Progress</th>
                    <th className="px-3 py-2 text-right">Done</th>
                  </tr>
                </thead>
                <tbody>
                  {app.students.map((s) => {
                    const pct = total ? Math.round((s.completedLessons.length / total) * 100) : 0;
                    return (
                      <tr key={s.id} className="border-t">
                        <td className="px-3 py-3">
                          <div className="font-bold">{s.name}</div>
                          <div className="text-xs text-muted-foreground">{s.email}</div>
                        </td>
                        <td className="px-3 py-3">
                          <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                            <div className="h-full rounded-full bg-primary" style={{ width: `${pct}%` }} />
                          </div>
                          <div className="mt-1 text-xs text-muted-foreground">{pct}%</div>
                        </td>
                        <td className="px-3 py-3 text-right font-bold">{s.completedLessons.length}/{total}</td>
                      </tr>
                    );
                  })}
                  {app.students.length === 0 && (
                    <tr><td colSpan={3} className="px-3 py-6 text-center text-muted-foreground">No students yet.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
