import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useApp } from "@/lib/app-store";
import { AppHeader } from "@/components/AppHeader";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ArrowLeft, Check, Download, X, Trophy } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/student/lesson/$lessonId")({ component: LessonPage });

function LessonPage() {
  const { lessonId } = Route.useParams();
  const app = useApp();
  const navigate = useNavigate();
  const lesson = app.lessons.find((l) => l.id === lessonId);
  const [mode, setMode] = useState<"read" | "quiz" | "results">("read");
  const [answers, setAnswers] = useState<Record<string, number | undefined>>({});

  useEffect(() => {
    if (app.session?.kind !== "student") navigate({ to: "/" });
  }, [app.session, navigate]);

  if (!lesson) {
    return (
      <div className="min-h-screen">
        <AppHeader title="Lesson" />
        <div className="mx-auto max-w-2xl px-4 py-10 text-center">
          <p className="text-muted-foreground">Lesson not found.</p>
          <Link to="/student" className="mt-4 inline-block text-primary underline">Back to path</Link>
        </div>
      </div>
    );
  }

  const correctCount = useMemo(() =>
    lesson.quiz.reduce((acc, q) => acc + (answers[q.id] === q.correctIndex ? 1 : 0), 0),
  [answers, lesson.quiz]);

  return (
    <div className="min-h-screen pb-16">
      <AppHeader title={lesson.title} />
      <div className="mx-auto max-w-2xl px-4 pt-6">
        <Link to="/student" className="mb-4 inline-flex items-center gap-1 text-sm font-semibold text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Back to path
        </Link>

        <Card className="rounded-3xl border-2 p-6">
          <div className="mb-4 flex items-center gap-3">
            <div className="grid h-14 w-14 place-items-center rounded-2xl bg-accent text-3xl">{lesson.emoji}</div>
            <div>
              <h1 className="text-2xl">{lesson.title}</h1>
              <p className="text-sm text-muted-foreground">{lesson.description}</p>
            </div>
          </div>

          {mode === "read" && (
            <>
              <article className="prose-content space-y-3 text-[15px] leading-relaxed">
                {renderMarkdownish(lesson.content)}
              </article>

              {lesson.attachments.length > 0 && (
                <div className="mt-6">
                  <div className="mb-2 text-sm font-bold uppercase tracking-wider text-muted-foreground">Materials</div>
                  <div className="space-y-2">
                    {lesson.attachments.map((a, i) => (
                      <a key={i} href={a.url} download={a.name}
                        className="flex items-center justify-between rounded-2xl border-2 px-4 py-3 hover:bg-accent">
                        <span className="text-sm font-semibold">{a.name}</span>
                        <Download className="h-4 w-4" />
                      </a>
                    ))}
                  </div>
                </div>
              )}

              <div className="mt-8 flex justify-end">
                <Button onClick={() => { setMode("quiz"); setAnswers({}); }} className="rounded-2xl px-6 py-6 text-base font-bold btn-pop">
                  Start quiz →
                </Button>
              </div>
            </>
          )}

          {mode === "quiz" && (
            <div className="space-y-6">
              {lesson.quiz.map((q, qi) => (
                <div key={q.id} className="rounded-2xl border-2 bg-background/50 p-4">
                  <div className="mb-3 text-xs font-bold uppercase tracking-wider text-muted-foreground">Question {qi + 1}</div>
                  <div className="mb-3 font-bold">{q.question}</div>
                  <div className="grid gap-2">
                    {q.options.map((opt, oi) => {
                      const active = answers[q.id] === oi;
                      return (
                        <button
                          key={oi}
                          type="button"
                          onClick={() => setAnswers((p) => ({ ...p, [q.id]: oi }))}
                          className={`rounded-2xl border-2 px-4 py-3 text-left text-sm font-semibold transition ${active ? "border-primary bg-primary/15" : "hover:bg-accent"}`}
                        >
                          {opt}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
              <Button
                onClick={() => {
                  const unanswered = lesson.quiz.some((q) => answers[q.id] === undefined);
                  if (unanswered) { toast.error("Answer all questions first."); return; }
                  app.completeLesson(lesson.id, { correct: correctCount, total: lesson.quiz.length });
                  setMode("results");
                }}
                className="w-full rounded-2xl py-6 text-base font-bold btn-pop"
              >
                Submit answers
              </Button>
            </div>
          )}

          {mode === "results" && (
            <div className="space-y-6">
              <div className="rounded-3xl bg-gradient-to-br from-primary/25 to-secondary/25 p-6 text-center">
                <div className="mx-auto mb-2 grid h-16 w-16 place-items-center rounded-full bg-warning text-warning-foreground">
                  <Trophy className="h-8 w-8" />
                </div>
                <div className="text-3xl font-extrabold">{correctCount} / {lesson.quiz.length}</div>
                <div className="text-sm text-muted-foreground">
                  {correctCount === lesson.quiz.length ? "Perfect! 🎉" : "Nice work — review your mistakes below."}
                </div>
              </div>

              {lesson.quiz.map((q, qi) => {
                const picked = answers[q.id];
                const isRight = picked === q.correctIndex;
                return (
                  <div key={q.id} className={`rounded-2xl border-2 p-4 ${isRight ? "border-success bg-success/10" : "border-destructive/40 bg-destructive/5"}`}>
                    <div className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-wider">
                      {isRight ? <Check className="h-4 w-4 text-success" /> : <X className="h-4 w-4 text-destructive" />}
                      Question {qi + 1}
                    </div>
                    <div className="mb-3 font-bold">{q.question}</div>
                    <div className="grid gap-2">
                      {q.options.map((opt, oi) => {
                        const correct = oi === q.correctIndex;
                        const chosen = oi === picked;
                        return (
                          <div key={oi}
                            className={`flex items-center justify-between rounded-xl border-2 px-3 py-2 text-sm font-semibold ${
                              correct ? "border-success bg-success/15"
                                : chosen ? "border-destructive bg-destructive/10"
                                : "border-transparent bg-muted"
                            }`}>
                            <span>{opt}</span>
                            {correct && <Check className="h-4 w-4 text-success" />}
                            {!correct && chosen && <X className="h-4 w-4 text-destructive" />}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}

              <div className="flex gap-3">
                <Button variant="outline" onClick={() => { setMode("quiz"); setAnswers({}); }} className="flex-1 rounded-2xl py-6 font-bold">
                  Retry
                </Button>
                <Button onClick={() => navigate({ to: "/student" })} className="flex-1 rounded-2xl py-6 font-bold btn-pop">
                  Back to path
                </Button>
              </div>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}

// Tiny markdown-ish renderer for ## headings, **bold** and bullet lines
function renderMarkdownish(text: string) {
  const lines = text.split("\n");
  const out: React.ReactNode[] = [];
  let listBuf: string[] = [];
  const flushList = () => {
    if (listBuf.length) {
      out.push(
        <ul key={`ul-${out.length}`} className="list-disc space-y-1 pl-5">
          {listBuf.map((l, i) => <li key={i}>{renderInline(l.replace(/^[-*]\s+/, ""))}</li>)}
        </ul>,
      );
      listBuf = [];
    }
  };
  lines.forEach((line, i) => {
    if (/^\s*[-*]\s+/.test(line)) { listBuf.push(line); return; }
    flushList();
    if (/^##\s+/.test(line)) {
      out.push(<h3 key={i} className="text-xl font-bold">{line.replace(/^##\s+/, "")}</h3>);
    } else if (line.trim() === "") {
      out.push(<div key={i} className="h-1" />);
    } else {
      out.push(<p key={i}>{renderInline(line)}</p>);
    }
  });
  flushList();
  return out;
}
function renderInline(text: string) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((p, i) =>
    p.startsWith("**") && p.endsWith("**")
      ? <strong key={i}>{p.slice(2, -2)}</strong>
      : <span key={i}>{p}</span>,
  );
}
