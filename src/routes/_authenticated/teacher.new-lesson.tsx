import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AppHeader } from "@/components/AppHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeft, Plus, Trash2, Upload, Check } from "lucide-react";
import { toast } from "sonner";
import { lessonQuery, lessonsQuery, myRoleQuery } from "@/lib/queries";

type Search = { id?: string };

export const Route = createFileRoute("/_authenticated/teacher/new-lesson")({
  validateSearch: (s: Record<string, unknown>): Search => ({
    id: typeof s.id === "string" ? s.id : undefined,
  }),
  component: NewLessonPage,
});

type QDraft = { id: string; question: string; options: string[]; correctIndex: number };

function NewLessonPage() {
  const { id: editId } = Route.useSearch();
  const navigate = useNavigate();
  const { data: role, isLoading: roleLoading } = useQuery(myRoleQuery());

  useEffect(() => {
    if (!roleLoading && role !== "teacher") navigate({ to: "/" });
  }, [role, roleLoading, navigate]);

  if (editId) {
    return <EditWrapper editId={editId} key={editId} />;
  }
  return <LessonForm key="new" />;
}

function EditWrapper({ editId }: { editId: string }) {
  const { data, isLoading } = useQuery(lessonQuery(editId));
  if (isLoading) return null;
  if (!data?.lesson) {
    return (
      <div className="min-h-screen">
        <AppHeader title="Edit lesson" mode="teacher" />
        <div className="mx-auto max-w-2xl px-4 py-10 text-center text-muted-foreground">
          Lesson not found. <Link to="/teacher" className="text-primary underline">Back to dashboard</Link>
        </div>
      </div>
    );
  }
  return <LessonForm editId={editId} initial={data} />;
}

type LessonData = {
  lesson: import("@/lib/queries").Lesson | null;
  questions: import("@/lib/queries").QuizQuestion[];
  attachments: import("@/lib/queries").Attachment[];
};

function LessonForm({
  editId,
  initial,
}: {
  editId?: string;
  initial?: LessonData;
}) {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const editing = initial?.lesson;

  const [title, setTitle] = useState(editing?.title ?? "");
  const [emoji, setEmoji] = useState(editing?.emoji ?? "📘");
  const [description, setDescription] = useState(editing?.description ?? "");
  const [content, setContent] = useState(
    editing?.content ??
      "## Welcome!\n\nWrite your lesson here. Use **bold** and bullet points.\n\n- First point\n- Second point",
  );
  const [attachments, setAttachments] = useState<{ id?: string; name: string; url: string }[]>(
    initial?.attachments?.map((a) => ({ id: a.id, name: a.name, url: a.url })) ?? [],
  );
  const [questions, setQuestions] = useState<QDraft[]>(
    initial?.questions.map((q) => ({
      id: q.id,
      question: q.question,
      options: q.options,
      correctIndex: q.correct_index,
    })) ?? [{ id: crypto.randomUUID(), question: "", options: ["", "", "", ""], correctIndex: 0 }],
  );
  const [saving, setSaving] = useState(false);

  function updateQ(id: string, patch: Partial<QDraft>) {
    setQuestions((qs) => qs.map((q) => (q.id === id ? { ...q, ...patch } : q)));
  }

  function onFiles(files: FileList | null) {
    if (!files) return;
    const arr = Array.from(files).map((f) => ({ name: f.name, url: URL.createObjectURL(f) }));
    setAttachments((a) => [...a, ...arr]);
  }

  async function save() {
    if (!title.trim()) return toast.error("Add a title.");
    if (questions.length === 0) return toast.error("Add at least one question.");
    if (questions.some((q) => !q.question.trim() || q.options.some((o) => !o.trim()))) {
      return toast.error("Fill in every question and option.");
    }
    setSaving(true);
    try {
      let lessonId = editing?.id;
      if (editing) {
        const { error } = await supabase
          .from("lessons")
          .update({ title: title.trim(), emoji, description: description.trim(), content })
          .eq("id", editing.id);
        if (error) throw error;
      } else {
        // Get max order_index
        const { data: maxRow } = await supabase.from("lessons").select("order_index").order("order_index", { ascending: false }).limit(1).maybeSingle();
        const nextOrder = (maxRow?.order_index ?? 0) + 1;
        const { data: inserted, error } = await supabase
          .from("lessons")
          .insert({ title: title.trim(), emoji, description: description.trim(), content, order_index: nextOrder })
          .select()
          .single();
        if (error || !inserted) throw error;
        lessonId = inserted.id;
      }

      // Replace questions (simple approach)
      await supabase.from("quiz_questions").delete().eq("lesson_id", lessonId!);
      await supabase.from("quiz_questions").insert(
        questions.map((q, i) => ({
          lesson_id: lessonId!,
          question: q.question,
          options: q.options,
          correct_index: q.correctIndex,
          position: i + 1,
        })),
      );

      // Replace attachments
      await supabase.from("lesson_attachments").delete().eq("lesson_id", lessonId!);
      if (attachments.length) {
        await supabase.from("lesson_attachments").insert(
          attachments.map((a) => ({ lesson_id: lessonId!, name: a.name, url: a.url })),
        );
      }

      qc.invalidateQueries({ queryKey: lessonsQuery().queryKey });
      qc.invalidateQueries({ queryKey: ["lesson", lessonId!] });
      toast.success(editing ? "Lesson updated!" : "Lesson published!");
      navigate({ to: "/teacher" });
    } catch (e) {
      const err = e as Error;
      toast.error(err.message ?? "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    if (!editing) return;
    if (!confirm(`Delete "${editing.title}"? Students' progress for this lesson will be removed.`)) return;
    const { error } = await supabase.from("lessons").delete().eq("id", editing.id);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: lessonsQuery().queryKey });
    toast.success("Lesson deleted.");
    navigate({ to: "/teacher" });
  }

  return (
    <div className="min-h-screen pb-16">
      <AppHeader title={editing ? "Edit lesson" : "New lesson"} subtitle={editing ? "Update a phase" : "Build a new phase"} mode="teacher" />
      <div className="mx-auto max-w-3xl px-4 pt-6">
        <Link to="/teacher" className="mb-4 inline-flex items-center gap-1 text-sm font-semibold text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Back
        </Link>

        <Card className="rounded-3xl border-2 p-6">
          <div className="mb-4 flex items-center justify-between gap-3">
            <h1 className="text-2xl">{editing ? "Edit phase" : "Create a new phase"}</h1>
            {editing && (
              <Button variant="outline" size="sm" onClick={remove} className="rounded-xl border-destructive/40 text-destructive hover:bg-destructive/10">
                <Trash2 className="mr-1 h-4 w-4" /> Delete
              </Button>
            )}
          </div>

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
            <Label>Lesson content (Markdown: ## headings, **bold**, bullets)</Label>
            <Textarea value={content} onChange={(e) => setContent(e.target.value)} className="min-h-[180px] rounded-xl font-mono text-sm" />
          </div>

          <div className="mt-4">
            <Label className="mb-1.5 block">Materials</Label>
            <label className="flex cursor-pointer items-center justify-center gap-2 rounded-2xl border-2 border-dashed py-6 text-sm font-semibold text-muted-foreground hover:bg-accent">
              <Upload className="h-4 w-4" /> Upload files (local preview only)
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
              <Button variant="outline" size="sm" className="rounded-xl"
                onClick={() => setQuestions((qs) => [...qs, { id: crypto.randomUUID(), question: "", options: ["", "", "", ""], correctIndex: 0 }])}>
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
                  <Input value={q.question} onChange={(e) => updateQ(q.id, { question: e.target.value })} placeholder="Type your question" className="mb-3 rounded-xl" />
                  <div className="grid gap-2">
                    {q.options.map((opt, oi) => {
                      const isCorrect = q.correctIndex === oi;
                      return (
                        <div key={oi} className="flex items-center gap-2">
                          <button type="button" onClick={() => updateQ(q.id, { correctIndex: oi })}
                            className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl border-2 ${isCorrect ? "border-success bg-success text-success-foreground" : "bg-muted"}`}
                            title="Mark as correct">
                            {isCorrect ? <Check className="h-4 w-4" strokeWidth={3} /> : <span className="text-xs font-bold">{String.fromCharCode(65 + oi)}</span>}
                          </button>
                          <Input value={opt}
                            onChange={(e) => {
                              const next = [...q.options];
                              next[oi] = e.target.value;
                              updateQ(q.id, { options: next });
                            }}
                            placeholder={`Option ${oi + 1}`} className="rounded-xl" />
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
            <Button onClick={save} disabled={saving} className="rounded-2xl px-6 py-6 font-bold btn-pop">
              {saving ? "Saving..." : editing ? "Save changes" : "Publish lesson"}
            </Button>
          </div>
        </Card>
      </div>
    </div>
  );
}
