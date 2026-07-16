import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AppHeader } from "@/components/AppHeader";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ArrowLeft, Check, Download, X, Trophy, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { lessonQuery, myProgressQuery } from "@/lib/queries";
import { getTTSAudio } from "@/lib/audio.functions";

export const Route = createFileRoute("/_authenticated/student/lesson/$lessonId")({
  component: LessonPage,
});

function LessonPage() {
  const { lessonId } = Route.useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { data, isLoading } = useQuery(lessonQuery(lessonId));
  const [mode, setMode] = useState<"read" | "quiz" | "results">("read");
  const [answers, setAnswers] = useState<Record<string, number | string | undefined>>({});
  const [playingAudio, setPlayingAudio] = useState<string | null>(null);

  const correctCount = useMemo(() => {
    if (!data) return 0;
    return data.questions.reduce((acc, q) => {
      const ans = answers[q.id];
      if (ans === undefined) return acc;
      
      const opts = q.options as any;
      const type = opts?.type ?? "multiple_choice";
      
      if (type.includes("choice")) {
        return acc + (ans === q.correct_index ? 1 : 0);
      } else {
        const expected = (opts?.text_answer ?? "").toLowerCase().trim();
        const actual = String(ans).toLowerCase().trim();
        return acc + (expected === actual ? 1 : 0);
      }
    }, 0);
  }, [answers, data]);

  if (isLoading) return <div className="grid min-h-screen place-items-center text-sm text-muted-foreground">Carregando...</div>;
  if (!data?.lesson) {
    return (
      <div className="min-h-screen">
        <AppHeader title="Fase" mode="student" />
        <div className="mx-auto max-w-2xl px-4 py-10 text-center">
          <p className="text-muted-foreground">Fase não encontrada.</p>
          <Link to="/student" className="mt-4 inline-block text-primary underline">Voltar para a trilha</Link>
        </div>
      </div>
    );
  }
  const { lesson, questions, attachments } = data;

  async function submit() {
    const unanswered = questions.some((q) => {
      const ans = answers[q.id];
      return ans === undefined || (typeof ans === "string" && ans.trim() === "");
    });
    if (unanswered) return toast.error("Responda todas as perguntas primeiro.");
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) return;

    const { data: existing } = await supabase
      .from("lesson_progress")
      .select("*")
      .eq("user_id", userData.user.id)
      .eq("lesson_id", lesson!.id)
      .maybeSingle();

    const payload = {
      user_id: userData.user.id,
      lesson_id: lesson!.id,
      correct: correctCount,
      total: questions.length,
      attempts: (existing?.attempts ?? 0) + 1,
      completed_at: new Date().toISOString(),
    };

    const { error } = existing
      ? await supabase.from("lesson_progress").update(payload).eq("id", existing.id)
      : await supabase.from("lesson_progress").insert(payload);
    if (error) return toast.error(error.message);

    qc.invalidateQueries({ queryKey: myProgressQuery().queryKey });
    setMode("results");
  }

  return (
    <div className="min-h-screen pb-16">
      <AppHeader title={lesson.title} mode="student" />
      <div className="mx-auto max-w-2xl px-4 pt-6">
        <Link to="/student" className="mb-4 inline-flex items-center gap-1 text-sm font-semibold text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Voltar para a trilha
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
              <DualLanguageMarkdown content={lesson.content} />
              {attachments.length > 0 && (
                <div className="mt-6">
                  <div className="mb-2 text-sm font-bold uppercase tracking-wider text-muted-foreground">Materiais</div>
                  <div className="space-y-2">
                    {attachments.map((a) => (
                      <a key={a.id} href={a.url} download={a.name} className="flex items-center justify-between rounded-2xl border-2 px-4 py-3 hover:bg-accent">
                        <span className="text-sm font-semibold">{a.name}</span>
                        <Download className="h-4 w-4" />
                      </a>
                    ))}
                  </div>
                </div>
              )}
              <div className="mt-8 flex justify-end">
                <Button onClick={() => { setMode("quiz"); setAnswers({}); }} disabled={questions.length === 0} className="rounded-2xl px-6 py-6 text-base font-bold btn-pop">
                  {questions.length === 0 ? "Sem teste ainda" : "Iniciar teste →"}
                </Button>
              </div>
            </>
          )}

          {mode === "quiz" && (
            <div className="space-y-6">
              {questions.map((q, qi) => {
                const opts = q.options as any;
                const type = opts?.type ?? "multiple_choice";
                
                return (
                  <div key={q.id} className="rounded-2xl border-2 bg-background/50 p-4">
                    <div className="mb-3 text-xs font-bold uppercase tracking-wider text-muted-foreground">Questão {qi + 1}</div>
                    
                    {type.includes("audio") && (
                      <div className="mb-4">
                        <Button type="button" disabled={playingAudio === q.id} onClick={async () => {
                          setPlayingAudio(q.id);
                          try {
                            const res = await getTTSAudio({ data: { text: opts.spoken_text } });
                            const audio = new Audio(res.audioDataUrl);
                            audio.onended = () => setPlayingAudio(null);
                            audio.play().catch(() => setPlayingAudio(null));
                          } catch (err) {
                            setPlayingAudio(null);
                            const u = new SpeechSynthesisUtterance(opts.spoken_text);
                            u.lang = "en-US";
                            window.speechSynthesis.speak(u);
                          }
                        }} variant="outline" className="rounded-xl font-bold w-full max-w-[200px] border-primary text-primary hover:bg-primary/10">
                          {playingAudio === q.id ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Carregando...</> : "🔊 Ouvir áudio"}
                        </Button>
                      </div>
                    )}

                    {q.question && <div className="mb-3 font-bold">{q.question}</div>}
                    
                    {type.includes("choice") ? (
                      <div className="grid gap-2">
                        {(Array.isArray(opts) ? opts : (Array.isArray(opts?.choices) ? opts.choices : [])).map((opt: string, oi: number) => {
                          const active = answers[q.id] === oi;
                          return (
                            <button key={oi} type="button" onClick={() => setAnswers((p) => ({ ...p, [q.id]: oi }))}
                              className={`rounded-2xl border-2 px-4 py-3 text-left text-sm font-semibold transition ${active ? "border-primary bg-primary/15" : "hover:bg-accent"}`}>
                              {opt}
                            </button>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="mt-2">
                        <Input 
                          value={(answers[q.id] as string) || ""} 
                          onChange={(e) => setAnswers(p => ({ ...p, [q.id]: e.target.value }))}
                          placeholder="Digite sua resposta..." 
                          className="rounded-xl border-2 px-4 py-6 font-bold" 
                        />
                      </div>
                    )}
                  </div>
                );
              })}
              <Button onClick={submit} className="w-full rounded-2xl py-6 text-base font-bold btn-pop">Enviar respostas</Button>
            </div>
          )}

          {mode === "results" && (
            <div className="space-y-6">
              <div className="rounded-3xl bg-gradient-to-br from-primary/25 to-secondary/25 p-6 text-center">
                <div className="mx-auto mb-2 grid h-16 w-16 place-items-center rounded-full bg-warning text-warning-foreground">
                  <Trophy className="h-8 w-8" />
                </div>
                <div className="text-3xl font-extrabold">{correctCount} / {questions.length}</div>
                <div className="text-sm text-muted-foreground">
                  {correctCount === questions.length ? "Perfeito! 🎉" : "Bom trabalho — revise seus erros abaixo."}
                </div>
              </div>
              {questions.map((q, qi) => {
                const picked = answers[q.id];
                const opts = q.options as any;
                const type = opts?.type ?? "multiple_choice";
                
                let isRight = false;
                if (type.includes("choice")) isRight = picked === q.correct_index;
                else isRight = String(picked ?? "").toLowerCase().trim() === (opts?.text_answer ?? "").toLowerCase().trim();

                return (
                  <div key={q.id} className={`rounded-2xl border-2 p-4 ${isRight ? "border-success bg-success/10" : "border-destructive/40 bg-destructive/5"}`}>
                    <div className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-wider">
                      {isRight ? <Check className="h-4 w-4 text-success" /> : <X className="h-4 w-4 text-destructive" />}
                      Questão {qi + 1}
                    </div>
                    {q.question && <div className="mb-3 font-bold">{q.question}</div>}
                    
                    {type.includes("choice") ? (
                      <div className="grid gap-2">
                        {(Array.isArray(opts) ? opts : (Array.isArray(opts?.choices) ? opts.choices : [])).map((opt: string, oi: number) => {
                          const correct = oi === q.correct_index;
                          const chosen = oi === picked;
                          return (
                            <div key={oi} className={`flex items-center justify-between rounded-xl border-2 px-3 py-2 text-sm font-semibold ${
                              correct ? "border-success bg-success/15" : chosen ? "border-destructive bg-destructive/10" : "border-transparent bg-muted"
                            }`}>
                              <span>{opt}</span>
                              {correct && <Check className="h-4 w-4 text-success" />}
                              {!correct && chosen && <X className="h-4 w-4 text-destructive" />}
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="mt-2 grid gap-2 text-sm">
                        <div className="flex items-center gap-2 rounded-xl border-2 px-3 py-2 bg-muted">
                          <span className="font-bold text-muted-foreground">Sua resposta:</span>
                          <span className={isRight ? "text-success font-bold" : "text-destructive font-bold"}>{String(picked ?? "(em branco)")}</span>
                        </div>
                        {!isRight && (
                          <div className="flex items-center gap-2 rounded-xl border-2 border-success bg-success/15 px-3 py-2">
                            <span className="font-bold text-success">Resposta correta:</span>
                            <span className="font-bold text-success">{opts?.text_answer}</span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
              <div className="flex gap-3">
                <Button variant="outline" onClick={() => { setMode("quiz"); setAnswers({}); }} className="flex-1 rounded-2xl py-6 font-bold">Tentar novamente</Button>
                <Button onClick={() => navigate({ to: "/student" })} className="flex-1 rounded-2xl py-6 font-bold btn-pop">Voltar para a trilha</Button>
              </div>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}

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
    if (/^##\s+/.test(line)) out.push(<h3 key={i} className="text-xl font-bold">{line.replace(/^##\s+/, "")}</h3>);
    else if (line.trim() === "") out.push(<div key={i} className="h-1" />);
    else out.push(<p key={i}>{renderInline(line)}</p>);
  });
  flushList();
  return out;
}
function renderInline(text: string) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((p, i) => (p.startsWith("**") && p.endsWith("**") ? <strong key={i}>{p.slice(2, -2)}</strong> : <span key={i}>{p}</span>));
}

function DualLanguageMarkdown({ content }: { content: string | null | undefined }) {
  const [lang, setLang] = useState<"pt" | "en">("pt");
  
  const safeContent = content || "";

  if (!safeContent.includes(":::pt") && !safeContent.includes(":::en")) {
    return <article className="prose-content space-y-3 text-[15px] leading-relaxed">{renderMarkdownish(safeContent)}</article>;
  }

  const parts = safeContent.split(/(?=:::[a-z]+)/);
  const ptContent = parts.find(p => p.startsWith(":::pt"))?.replace(/^:::pt\s*/, "") ?? "";
  const enContent = parts.find(p => p.startsWith(":::en"))?.replace(/^:::en\s*/, "") ?? "";

  return (
    <div className="space-y-4">
      <div className="flex justify-start gap-2 border-b-2 pb-3">
        <button onClick={() => setLang("pt")} className={`px-4 py-1.5 rounded-full text-sm font-bold transition ${lang === "pt" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/80"}`}>🇧🇷 Português</button>
        <button onClick={() => setLang("en")} className={`px-4 py-1.5 rounded-full text-sm font-bold transition ${lang === "en" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/80"}`}>🇬🇧 Inglês</button>
      </div>
      <article className="prose-content space-y-3 text-[15px] leading-relaxed">
        {renderMarkdownish(lang === "en" ? (enContent || ptContent) : ptContent)}
      </article>
    </div>
  );
}
