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
import { ArrowLeft, Plus, Trash2, Upload, Check, Volume2, Loader2, Sparkles, FileText } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { useServerFn } from "@tanstack/react-start";
import { lessonQuery, lessonsQuery, myRoleQuery } from "@/lib/queries";
import { getTTSAudio } from "@/lib/audio.functions";
import { generateLessonFromMaterial } from "@/lib/lesson-ai.functions";

type Search = { id?: string };

export const Route = createFileRoute("/_authenticated/teacher/new-lesson")({
  validateSearch: (s: Record<string, unknown>): Search => ({
    id: typeof s.id === "string" ? s.id : undefined,
  }),
  component: NewLessonPage,
});

type QType = "multiple_choice" | "writing" | "audio_choice" | "audio_writing";
type QDraft = { id: string; question: string; type: QType; options: string[]; correctIndex: number; textAnswer: string; spokenText: string; };

function parseLegacyOrNew(q: any): QDraft {
  const opts = q.options as any;
  if (Array.isArray(opts)) {
    return { id: q.id, question: q.question, type: "multiple_choice", options: opts, correctIndex: q.correct_index ?? 0, textAnswer: "", spokenText: "" };
  } else if (typeof opts === "object" && opts !== null) {
    return {
      id: q.id,
      question: q.question,
      type: opts.type ?? "multiple_choice",
      options: Array.isArray(opts.choices) ? opts.choices : ["", "", "", ""],
      correctIndex: q.correct_index ?? 0,
      textAnswer: opts.text_answer ?? "",
      spokenText: opts.spoken_text ?? "",
    };
  }
  return { id: q.id, question: q.question, type: "multiple_choice", options: ["", "", "", ""], correctIndex: 0, textAnswer: "", spokenText: "" };
}

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
        <AppHeader title="Editar fase" mode="teacher" />
        <div className="mx-auto max-w-2xl px-4 py-10 text-center text-muted-foreground">
          Fase não encontrada. <Link to="/teacher" className="text-primary underline">Voltar para o painel</Link>
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
      "## Bem-vindo(a)!\n\nEscreva sua fase aqui. Use **negrito** e marcadores.\n\n- Primeiro ponto\n- Segundo ponto",
  );
  const [attachments, setAttachments] = useState<{ id?: string; name: string; url: string }[]>(
    initial?.attachments?.map((a) => ({ id: a.id, name: a.name, url: a.url })) ?? [],
  );
  const [questions, setQuestions] = useState<QDraft[]>(
    initial?.questions.map(parseLegacyOrNew) ??
      [{ id: crypto.randomUUID(), question: "", type: "multiple_choice", options: ["", "", "", ""], correctIndex: 0, textAnswer: "", spokenText: "" }],
  );
  const [saving, setSaving] = useState(false);
  const [playingAudio, setPlayingAudio] = useState<string | null>(null);
  const [aiOpen, setAiOpen] = useState(false);
  const [aiFile, setAiFile] = useState<File | null>(null);
  const [aiHint, setAiHint] = useState("");
  const [aiNumQ, setAiNumQ] = useState(5);
  const [aiLoading, setAiLoading] = useState(false);
  const generateFn = useServerFn(generateLessonFromMaterial);

  async function runAI() {
    if (!aiFile) return toast.error("Escolha um arquivo .pdf ou .txt");
    setAiLoading(true);
    try {
      const isPdf = aiFile.type.includes("pdf") || aiFile.name.toLowerCase().endsWith(".pdf");
      const payload: any = { hint: aiHint || undefined, numQuestions: aiNumQ };
      if (isPdf) {
        const buf = new Uint8Array(await aiFile.arrayBuffer());
        let bin = "";
        for (let i = 0; i < buf.length; i++) bin += String.fromCharCode(buf[i]);
        payload.pdfBase64 = btoa(bin);
        payload.pdfMime = aiFile.type || "application/pdf";
        payload.pdfName = aiFile.name;
      } else {
        payload.textContent = await aiFile.text();
      }
      const result = await generateFn({ data: payload });
      setTitle(result.title);
      setEmoji(result.emoji);
      setDescription(result.description);
      setContent(result.content);
      setQuestions(
        result.questions.map((q) => ({
          id: crypto.randomUUID(),
          type: q.type as QType,
          question: q.question,
          options: q.type.includes("choice")
            ? [q.options[0] ?? "", q.options[1] ?? "", q.options[2] ?? "", q.options[3] ?? ""]
            : ["", "", "", ""],
          correctIndex: q.correctIndex,
          textAnswer: q.textAnswer,
          spokenText: q.spokenText,
        })),
      );
      toast.success("Fase gerada! Revise antes de publicar.");
      setAiOpen(false);
      setAiFile(null);
      setAiHint("");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setAiLoading(false);
    }
  }


  function updateQ(id: string, patch: Partial<QDraft>) {
    setQuestions((qs) => qs.map((q) => (q.id === id ? { ...q, ...patch } : q)));
  }

  function onFiles(files: FileList | null) {
    if (!files) return;
    const arr = Array.from(files).map((f) => ({ name: f.name, url: URL.createObjectURL(f) }));
    setAttachments((a) => [...a, ...arr]);
  }

  async function save() {
    if (!title.trim()) return toast.error("Adicione um título.");
    if (questions.length === 0) return toast.error("Adicione pelo menos uma questão.");
    if (questions.some((q) => {
      if (!q.question.trim()) return true;
      if (q.type.includes("choice") && q.options.some((o) => !o.trim())) return true;
      if (q.type.includes("writing") && !q.textAnswer.trim()) return true;
      if (q.type.includes("audio") && !q.spokenText.trim()) return true;
      return false;
    })) {
      return toast.error("Preencha todos os campos das questões (perguntas, opções ou respostas).");
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
          options: {
            type: q.type,
            choices: q.type.includes("choice") ? q.options : [],
            text_answer: q.type.includes("writing") ? q.textAnswer : "",
            spoken_text: q.type.includes("audio") ? q.spokenText : "",
          },
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
      toast.success(editing ? "Fase atualizada!" : "Fase publicada!");
      navigate({ to: "/teacher" });
    } catch (e) {
      const err = e as Error;
      toast.error(err.message ?? "Falha ao salvar");
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    if (!editing) return;
    if (!confirm(`Excluir "${editing.title}"? O progresso dos alunos nesta fase será removido.`)) return;
    const { error } = await supabase.from("lessons").delete().eq("id", editing.id);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: lessonsQuery().queryKey });
    toast.success("Fase excluída.");
    navigate({ to: "/teacher" });
  }

  return (
    <div className="min-h-screen pb-16">
      <AppHeader title={editing ? "Editar fase" : "Nova fase"} subtitle={editing ? "Atualizar uma fase" : "Criar uma nova fase"} mode="teacher" />
      <div className="mx-auto max-w-3xl px-4 pt-6">
        <Link to="/teacher" className="mb-4 inline-flex items-center gap-1 text-sm font-semibold text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Voltar
        </Link>

        <Card className="rounded-3xl border-2 p-6">
          <div className="mb-4 flex items-center justify-between gap-3">
            <h1 className="text-2xl">{editing ? "Editar fase" : "Criar uma nova fase"}</h1>
            <div className="flex items-center gap-2">
              <Dialog open={aiOpen} onOpenChange={setAiOpen}>
                <DialogTrigger asChild>
                  <Button variant="secondary" size="sm" className="rounded-xl btn-pop">
                    <Sparkles className="mr-1 h-4 w-4" /> Criar com IA
                  </Button>
                </DialogTrigger>
                <DialogContent className="rounded-3xl">
                  <DialogHeader>
                    <DialogTitle className="flex items-center gap-2"><Sparkles className="h-5 w-5 text-primary" /> Gerar fase com IA</DialogTitle>
                    <DialogDescription>
                      Envie um PDF ou TXT com o material da aula. A IA vai criar título, conteúdo bilíngue e questões. Você pode editar tudo antes de publicar.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-3">
                    <label className="flex cursor-pointer items-center gap-2 rounded-2xl border-2 border-dashed p-4 text-sm hover:bg-accent">
                      <FileText className="h-5 w-5 text-muted-foreground" />
                      <div className="flex-1">
                        <div className="font-semibold">{aiFile ? aiFile.name : "Selecionar arquivo .pdf ou .txt"}</div>
                        <div className="text-xs text-muted-foreground">{aiFile ? `${Math.round(aiFile.size / 1024)} KB` : "Máx. ~10 MB"}</div>
                      </div>
                      <input type="file" accept=".pdf,.txt,application/pdf,text/plain" className="hidden" onChange={(e) => setAiFile(e.target.files?.[0] ?? null)} />
                    </label>
                    <div className="space-y-1.5">
                      <Label>Instruções extras (opcional)</Label>
                      <Textarea value={aiHint} onChange={(e) => setAiHint(e.target.value)} placeholder="Ex.: foco em verbo to be no presente; tom informal; nível A1" className="min-h-[80px] rounded-xl" />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Número de questões: {aiNumQ}</Label>
                      <input type="range" min={3} max={10} value={aiNumQ} onChange={(e) => setAiNumQ(Number(e.target.value))} className="w-full" />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setAiOpen(false)} className="rounded-xl" disabled={aiLoading}>Cancelar</Button>
                    <Button onClick={runAI} disabled={aiLoading || !aiFile} className="rounded-xl btn-pop">
                      {aiLoading ? <><Loader2 className="mr-1 h-4 w-4 animate-spin" /> Gerando...</> : <><Sparkles className="mr-1 h-4 w-4" /> Gerar fase</>}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
              {editing && (
                <Button variant="outline" size="sm" onClick={remove} className="rounded-xl border-destructive/40 text-destructive hover:bg-destructive/10">
                  <Trash2 className="mr-1 h-4 w-4" /> Excluir
                </Button>
              )}
            </div>
          </div>


          <div className="grid gap-4 md:grid-cols-[1fr_auto]">
            <div className="space-y-1.5">
              <Label>Título</Label>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="ex. Básico do passado" className="rounded-xl" />
            </div>
            <div className="space-y-1.5">
              <Label>Emoji</Label>
              <Input value={emoji} onChange={(e) => setEmoji(e.target.value)} className="w-20 rounded-xl text-center text-xl" maxLength={2} />
            </div>
          </div>

          <div className="mt-4 space-y-1.5">
            <Label>Descrição curta</Label>
            <Input value={description} onChange={(e) => setDescription(e.target.value)} className="rounded-xl" placeholder="Uma frase exibida na trilha" />
          </div>

          <div className="mt-4 space-y-1.5">
            <Label>Conteúdo (Use :::pt e :::en para textos bilíngues, Markdown suportado)</Label>
            <p className="text-xs text-muted-foreground mb-2">Exemplo: <br/>:::pt<br/>Olá mundo!<br/>:::en<br/>Hello world!</p>
            <Textarea value={content} onChange={(e) => setContent(e.target.value)} className="min-h-[180px] rounded-xl font-mono text-sm" />
          </div>

          <div className="mt-4">
            <Label className="mb-1.5 block">Materiais</Label>
            <label className="flex cursor-pointer items-center justify-center gap-2 rounded-2xl border-2 border-dashed py-6 text-sm font-semibold text-muted-foreground hover:bg-accent">
              <Upload className="h-4 w-4" /> Enviar arquivos (apenas pré-visualização local)
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
              <h2 className="text-lg">Teste</h2>
              <Button variant="outline" size="sm" className="rounded-xl"
                onClick={() => setQuestions((qs) => [...qs, { id: crypto.randomUUID(), type: "multiple_choice", question: "", options: ["", "", "", ""], correctIndex: 0, textAnswer: "", spokenText: "" }])}>
                <Plus className="mr-1 h-4 w-4" /> Adicionar questão
              </Button>
            </div>

            <div className="space-y-4">
              {questions.map((q, qi) => (
                <div key={q.id} className="rounded-2xl border-2 p-4">
                  <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                    <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Questão {qi + 1}</div>
                    
                    <div className="flex items-center gap-3">
                      <select 
                        value={q.type} 
                        onChange={(e) => updateQ(q.id, { type: e.target.value as QType })}
                        className="rounded-xl border-2 bg-background px-3 py-1 text-sm font-semibold"
                      >
                        <option value="multiple_choice">Múltipla Escolha</option>
                        <option value="writing">Escrita (Digitação)</option>
                        <option value="audio_choice">Áudio - Escolha</option>
                        <option value="audio_writing">Áudio - Escrita</option>
                      </select>
                      {questions.length > 1 && (
                        <button onClick={() => setQuestions((qs) => qs.filter((x) => x.id !== q.id))} className="text-destructive">
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  </div>

                  {q.type.includes("audio") && (
                    <div className="mb-3 space-y-1.5 rounded-xl bg-muted p-3">
                      <Label className="text-xs">Texto que será lido em voz alta pelo navegador (Inglês)</Label>
                      <div className="flex gap-2">
                        <Input value={q.spokenText} onChange={(e) => updateQ(q.id, { spokenText: e.target.value })} placeholder="Texto para áudio" className="rounded-xl bg-background" />
                        <Button type="button" disabled={playingAudio === q.id} variant="secondary" size="sm" className="rounded-xl" onClick={async () => {
                          if (!q.spokenText) return toast.error("Digite o texto do áudio primeiro");
                          setPlayingAudio(q.id);
                          try {
                            const res = await getTTSAudio({ data: { text: q.spokenText } });
                            const audio = new Audio(res.audioDataUrl);
                            audio.onended = () => setPlayingAudio(null);
                            audio.play().catch(() => setPlayingAudio(null));
                          } catch (err) {
                            setPlayingAudio(null);
                            const u = new SpeechSynthesisUtterance(q.spokenText);
                            u.lang = "en-US";
                            window.speechSynthesis.speak(u);
                          }
                        }}>
                          {playingAudio === q.id ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Volume2 className="mr-1 h-4 w-4" />}
                          {playingAudio === q.id ? "Carregando..." : "Testar Voz"}
                        </Button>
                      </div>
                    </div>
                  )}

                  <Input value={q.question} onChange={(e) => updateQ(q.id, { question: e.target.value })} placeholder="Digite a pergunta/enunciado" className="mb-3 rounded-xl font-bold" />

                  {q.type.includes("choice") && (
                    <>
                      <div className="grid gap-2">
                        {q.options.map((opt, oi) => {
                          const isCorrect = q.correctIndex === oi;
                          return (
                            <div key={oi} className="flex items-center gap-2">
                              <button type="button" onClick={() => updateQ(q.id, { correctIndex: oi })}
                                className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl border-2 ${isCorrect ? "border-success bg-success text-success-foreground" : "bg-muted"}`}
                                title="Marcar como correta">
                                {isCorrect ? <Check className="h-4 w-4" strokeWidth={3} /> : <span className="text-xs font-bold">{String.fromCharCode(65 + oi)}</span>}
                              </button>
                              <Input value={opt}
                                onChange={(e) => {
                                  const next = [...q.options];
                                  next[oi] = e.target.value;
                                  updateQ(q.id, { options: next });
                                }}
                                placeholder={`Opção ${oi + 1}`} className="rounded-xl" />
                            </div>
                          );
                        })}
                      </div>
                      <p className="mt-2 text-xs text-muted-foreground">Toque na letra para marcar a resposta correta.</p>
                    </>
                  )}

                  {q.type.includes("writing") && (
                    <div className="space-y-1.5">
                      <Label className="text-xs">Resposta correta esperada</Label>
                      <Input value={q.textAnswer} onChange={(e) => updateQ(q.id, { textAnswer: e.target.value })} placeholder="Ex: Hello" className="rounded-xl" />
                      <p className="mt-1 text-xs text-muted-foreground">O aluno deve digitar exatamente assim (ignora-se maiúsculas/minúsculas).</p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="mt-8 flex justify-end gap-3">
            <Button variant="outline" className="rounded-2xl" onClick={() => navigate({ to: "/teacher" })}>Cancelar</Button>
            <Button onClick={save} disabled={saving} className="rounded-2xl px-6 py-6 font-bold btn-pop">
              {saving ? "Salvando..." : editing ? "Salvar alterações" : "Publicar fase"}
            </Button>
          </div>
        </Card>
      </div>
    </div>
  );
}
