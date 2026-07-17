import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AppHeader } from "@/components/AppHeader";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ArrowLeft, Check, X, Trophy, Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { getTTSAudio } from "@/lib/audio.functions";
import { generateCheckpointQuiz, saveCheckpointResult } from "@/lib/gamification.functions";

export const Route = createFileRoute("/_authenticated/student/checkpoint/$index")({
  component: CheckpointPage,
});

type CPQuestion = {
  id: string;
  type: string;
  question: string;
  options: string[];
  correctIndex: number;
  textAnswer: string;
  spokenText: string;
};


function CheckpointPage() {
  const { index } = Route.useParams();
  const idx = parseInt(index, 10);
  const navigate = useNavigate();
  const genFn = useServerFn(generateCheckpointQuiz);
  const saveFn = useServerFn(saveCheckpointResult);

  const { data, isLoading, error } = useQuery({
    queryKey: ["checkpoint-quiz", idx],
    queryFn: () => genFn({ data: { checkpointIndex: idx } }),
    staleTime: Infinity,
  });

  const [answers, setAnswers] = useState<Record<string, number | string | undefined>>({});
  const [mode, setMode] = useState<"quiz" | "results">("quiz");
  const [playing, setPlaying] = useState<string | null>(null);
  const [speed, setSpeed] = useState<number>(() => {
    if (typeof window === "undefined") return 1;
    return parseFloat(localStorage.getItem("tts-speed") || "1");
  });

  const correctCount = useMemo(() => {
    if (!data) return 0;
    return data.questions.reduce((acc: number, q: CPQuestion) => {
      const ans = answers[q.id];
      if (ans === undefined) return acc;
      if (q.type.includes("choice")) return acc + (ans === q.correctIndex ? 1 : 0);
      return acc + (String(ans).toLowerCase().trim() === q.textAnswer.toLowerCase().trim() ? 1 : 0);
    }, 0);
  }, [answers, data]);

  if (isLoading) return (
    <div className="grid min-h-screen place-items-center">
      <div className="flex flex-col items-center gap-3 text-muted-foreground">
        <Loader2 className="h-8 w-8 animate-spin" />
        <div className="text-sm font-bold">Gerando seu teste com IA...</div>
      </div>
    </div>
  );
  if (error || !data) return (
    <div className="grid min-h-screen place-items-center text-center px-4">
      <div>
        <p className="text-destructive">{(error as Error)?.message ?? "Erro"}</p>
        <Link to="/student" className="mt-4 inline-block text-primary underline">Voltar</Link>
      </div>
    </div>
  );

  async function submit() {
    const unanswered = data!.questions.some((q: CPQuestion) => {
      const a = answers[q.id];
      return a === undefined || (typeof a === "string" && a.trim() === "");
    });
    if (unanswered) return toast.error("Responda todas as perguntas.");
    try {
      await saveFn({ data: { checkpointIndex: idx, correct: correctCount, total: data!.questions.length } });
    } catch (e: any) { toast.error(e.message); return; }
    setMode("results");
  }

  return (
    <div className="min-h-screen pb-16">
      <AppHeader title={`Checkpoint ${idx + 1}`} mode="student" />
      <div className="mx-auto max-w-2xl px-4 pt-6">
        <Link to="/student" className="mb-4 inline-flex items-center gap-1 text-sm font-semibold text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Voltar
        </Link>

        <Card className="rounded-3xl border-2 border-warning/40 p-6">
          <div className="mb-4 flex items-center gap-3">
            <div className="grid h-14 w-14 place-items-center rounded-2xl bg-warning/30 text-3xl">🏆</div>
            <div>
              <h1 className="text-2xl">Teste de revisão</h1>
              <p className="text-sm text-muted-foreground">Revisão das aulas: {data.lessons.map((l) => l.title).join(", ")}</p>
            </div>
          </div>

          {mode === "quiz" && (
            <div className="space-y-6">
              <SpeedControl speed={speed} onChange={(s) => { setSpeed(s); localStorage.setItem("tts-speed", String(s)); }} />
              {data.questions.map((q: CPQuestion, qi: number) => (
                <div key={q.id} className="rounded-2xl border-2 bg-background/50 p-4">
                  <div className="mb-3 text-xs font-bold uppercase tracking-wider text-muted-foreground">Questão {qi + 1}</div>
                  {q.type.includes("audio") && (
                    <Button type="button" disabled={playing === q.id} onClick={async () => {
                      setPlaying(q.id);
                      try {
                        const res = await getTTSAudio({ data: { text: q.spokenText } });
                        const audio = new Audio(res.audioDataUrl);
                        audio.playbackRate = speed;
                        audio.onended = () => setPlaying(null);
                        audio.play().catch(() => setPlaying(null));
                      } catch {
                        setPlaying(null);
                        const u = new SpeechSynthesisUtterance(q.spokenText);
                        u.lang = "en-US"; u.rate = speed;
                        window.speechSynthesis.speak(u);
                      }
                    }} variant="outline" className="mb-3 rounded-xl font-bold border-primary text-primary">
                      {playing === q.id ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Carregando</> : "🔊 Ouvir áudio"}
                    </Button>
                  )}
                  {q.question && <div className="mb-3 font-bold">{q.question}</div>}
                  {q.type.includes("choice") ? (
                    <div className="grid gap-2">
                      {q.options.map((opt: string, oi: number) => {
                        const active = answers[q.id] === oi;
                        return (
                          <button key={oi} type="button" onClick={() => setAnswers((p) => ({ ...p, [q.id]: oi }))}
                            className={`rounded-2xl border-2 px-4 py-3 text-left text-sm font-semibold ${active ? "border-primary bg-primary/15" : "hover:bg-accent"}`}>
                            {opt}
                          </button>
                        );
                      })}
                    </div>
                  ) : (
                    <Input value={(answers[q.id] as string) || ""} onChange={(e) => setAnswers((p) => ({ ...p, [q.id]: e.target.value }))} placeholder="Sua resposta..." className="rounded-xl border-2 py-6 font-bold" />
                  )}
                </div>
              ))}
              <Button onClick={submit} className="w-full rounded-2xl py-6 font-bold btn-pop">Enviar</Button>
            </div>
          )}

          {mode === "results" && (
            <div className="space-y-4">
              <div className="rounded-3xl bg-gradient-to-br from-warning/25 to-primary/20 p-6 text-center">
                <div className="mx-auto mb-2 grid h-16 w-16 place-items-center rounded-full bg-warning text-warning-foreground">
                  <Trophy className="h-8 w-8" />
                </div>
                <div className="text-3xl font-extrabold">{correctCount} / {data.questions.length}</div>
                <div className="text-sm text-muted-foreground">
                  Você ganhou <b>{correctCount * 5} XP</b> neste checkpoint! <Sparkles className="inline h-4 w-4 text-warning" />
                </div>
              </div>
              {data.questions.map((q: CPQuestion, qi: number) => {
                const picked = answers[q.id];
                const isRight = q.type.includes("choice")
                  ? picked === q.correctIndex
                  : String(picked ?? "").toLowerCase().trim() === q.textAnswer.toLowerCase().trim();
                return (
                  <div key={q.id} className={`rounded-2xl border-2 p-4 ${isRight ? "border-success bg-success/10" : "border-destructive/40 bg-destructive/5"}`}>
                    <div className="mb-2 flex items-center gap-2 text-xs font-bold uppercase">
                      {isRight ? <Check className="h-4 w-4 text-success" /> : <X className="h-4 w-4 text-destructive" />}
                      Questão {qi + 1}
                    </div>
                    {q.question && <div className="mb-2 font-bold">{q.question}</div>}
                    <div className="text-sm">Resposta correta: <b>{q.type.includes("choice") ? q.options[q.correctIndex] : q.textAnswer}</b></div>
                  </div>
                );
              })}
              <Button onClick={() => navigate({ to: "/student" })} className="w-full rounded-2xl py-6 font-bold btn-pop">Voltar para a trilha</Button>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}

function SpeedControl({ speed, onChange }: { speed: number; onChange: (s: number) => void }) {
  const opts = [0.75, 1, 1.25];
  return (
    <div className="flex items-center gap-2 rounded-2xl bg-muted/50 p-2">
      <span className="text-xs font-bold uppercase text-muted-foreground pl-2">Áudio</span>
      {opts.map((s) => (
        <button key={s} type="button" onClick={() => onChange(s)}
          className={`rounded-full px-3 py-1 text-xs font-bold ${speed === s ? "bg-primary text-primary-foreground" : "bg-background hover:bg-accent"}`}>
          {s}x
        </button>
      ))}
    </div>
  );
}
