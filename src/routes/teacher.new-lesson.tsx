import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useApp, type QuizQuestion } from "@/lib/app-store";
import { AppHeader } from "@/components/AppHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeft, Plus, Trash2, Upload, Check } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/teacher/new-lesson")({ component: NewLessonPage });

function NewLessonPage() {
  const app = useApp();
  const navigate = useNavigate();

  useEffect(() => {
    if (app.session?.kind !== "teacher") navigate({ to: "/" });
  }, [app.session, navigate]);

  const [title, setTitle] = useState("");
  const [emoji, setEmoji] = useState("📘");
  const [description, setDescription] = useState("");
  const [content, setContent] = useState("## Welcome!\n\nWrite your lesson here. Use **bold** and bullet points.\n\n- First point\n- Second point");
  const [attachments, setAttachments] = useState<{ name: string; url: string }[]>([]);
  const [questions, setQuestions] = useState<QuizQuestion[]>([
    { id: crypto.randomUUID(), question: "", options: ["", "", "", ""], correctIndex: 0 },
  ]);

  function updateQ(id: string, patch: Partial<QuizQuestion>) {
    setQuestions((qs) => qs.map((q) => (q.id === id ? { ...q, ...patch } : q)));
  }

  function onFiles(files: FileList | null) {
    if (!files) return;
    const arr = Array.from(files).map((f) => ({ name: f.name, url: URL.createObjectURL(f) }));
    setAttachments((a) => [...a, ...arr]);
  }

  function save() {
    if (!title.trim()) return toast.error("Add a title.");
    if (questions.some((q) => !q.question.trim() || q.options.some((o) => !o.trim()))) {
      return toast.error("Fill in every question and option.");
    }
    app.addLesson({ title: title.trim(), emoji, description: description.trim(), content, attachments, quiz: questions });
    toast.success("Lesson published!");
    navigate({ to: "/teacher" });
  }

  return (
    <div className="min-h-screen pb-16">
      <AppHeader title="New lesson" subtitle="Build a new phase" />
      <div className="mx-auto max-w-3xl px-4 pt-6">
        <Link to="/teacher" className="mb-4 inline-flex items-center gap-1 text-sm font-semibold text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Back
        </Link>

        <Card className="rounded-3xl border-2 p-6">
          <h1 className="mb-4 text-2xl">Create a new phase</h1>

          <div className="grid gap-4 md:grid-cols-[1fr_auto]">
            <div className="space-y-1.5">
              <Label>Title</Label>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Past tense basics" className="rounded-xl" />
            </div>
            <div className="space-y-1.5">
              <Label>Emoji</Label>
              <Input value={emoji} onChange={(e) => setEmoji(e.target.value)} className="w-20 rounded-xl text-center text-xl" maxLength={2} />
            </div>
          </div>

          <div className="mt-4 space-y-1.5">
            <Label>Short description</Label>
            <Input value={description} onChange={(e) => setDescription(e.target.value)} className="rounded-xl" placeholder="One sentence shown on the path" />
          </div>

          <div className="mt-4 space-y-1.5">
            <Label>Lesson content (Markdown-ish: ## headings, **bold**, bullets)</Label>
            <Textarea value={content} onChange={(e) => setContent(e.target.value)} className="min-h-[180px] rounded-xl font-mono text-sm" />
          </div>

          <div className="mt-4">
            <Label className="mb-1.5 block">Materials</Label>
            <label className="flex cursor-pointer items-center justify-center gap-2 rounded-2xl border-2 border-dashed py-6 text-sm font-semibold text-muted-foreground hover:bg-accent">
              <Upload className="h-4 w-4" /> Upload files
              <input type="file" multiple className="hidden" onChange={(e) => onFiles(e.target.files)} />
            </label>
            {attachments.length > 0 && (
              <div className="mt-2 space-y-1">
                {attachments.map((a, i) => (
                  <div key={i} className="flex items-center justify-between rounded-xl bg-muted px-3 py-2 text-sm">
                    <span>{a.name}</span>
                    <button onClick={() => setAttachments((p) => p.filter((_, j) => j !== i))} className="text-destructive">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="mt-8">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-lg">Quiz</h2>
              <Button
                variant="outline"
                size="sm"
                className="rounded-xl"
                onClick={() => setQuestions((qs) => [...qs, { id: crypto.randomUUID(), question: "", options: ["", "", "", ""], correctIndex: 0 }])}
              >
                <Plus className="mr-1 h-4 w-4" /> Add question
              </Button>
            </div>

            <div className="space-y-4">
              {questions.map((q, qi) => (
                <div key={q.id} className="rounded-2xl border-2 p-4">
                  <div className="mb-2 flex items-center justify-between">
                    <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Question {qi + 1}</div>
                    {questions.length > 1 && (
                      <button onClick={() => setQuestions((qs) => qs.filter((x) => x.id !== q.id))} className="text-destructive">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                  <Input
                    value={q.question}
                    onChange={(e) => updateQ(q.id, { question: e.target.value })}
                    placeholder="Type your question"
                    className="mb-3 rounded-xl"
                  />
                  <div className="grid gap-2">
                    {q.options.map((opt, oi) => {
                      const isCorrect = q.correctIndex === oi;
                      return (
                        <div key={oi} className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => updateQ(q.id, { correctIndex: oi })}
                            className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl border-2 ${isCorrect ? "border-success bg-success text-success-foreground" : "bg-muted"}`}
                            title="Mark as correct"
                          >
                            {isCorrect ? <Check className="h-4 w-4" strokeWidth={3} /> : <span className="text-xs font-bold">{String.fromCharCode(65 + oi)}</span>}
                          </button>
                          <Input
                            value={opt}
                            onChange={(e) => {
                              const next = [...q.options];
                              next[oi] = e.target.value;
                              updateQ(q.id, { options: next });
                            }}
                            placeholder={`Option ${oi + 1}`}
                            className="rounded-xl"
                          />
                        </div>
                      );
                    })}
                  </div>
                  <p className="mt-2 text-xs text-muted-foreground">Tap the letter to mark the correct answer.</p>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-8 flex justify-end gap-3">
            <Button variant="outline" className="rounded-2xl" onClick={() => navigate({ to: "/teacher" })}>Cancel</Button>
            <Button onClick={save} className="rounded-2xl px-6 py-6 font-bold btn-pop">Publish lesson</Button>
          </div>
        </Card>
      </div>
    </div>
  );
}
