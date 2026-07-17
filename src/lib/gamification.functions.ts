import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const HINT_COST = 5;

async function computeBalance(supabase: any, userId: string) {
  const [{ data: lp }, { data: cp }, { data: prof }] = await Promise.all([
    supabase.from("lesson_progress").select("correct, completed_at").eq("user_id", userId),
    supabase.from("checkpoint_progress").select("correct").eq("user_id", userId),
    supabase.from("profiles").select("xp_spent").eq("id", userId).maybeSingle(),
  ]);
  const earnedLessons = (lp ?? []).filter((r: any) => r.completed_at).length * 10;
  const earnedCheckpoints = (cp ?? []).reduce((a: number, r: any) => a + (r.correct ?? 0) * 5, 0);
  const spent = prof?.xp_spent ?? 0;
  return { earned: earnedLessons + earnedCheckpoints, spent, balance: earnedLessons + earnedCheckpoints - spent };
}

export const getMyXp = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => computeBalance(context.supabase, context.userId));

export const buyHint = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({
      question: z.string(),
      options: z.array(z.string()).optional(),
      lessonTitle: z.string().optional(),
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { balance } = await computeBalance(context.supabase, context.userId);
    if (balance < HINT_COST) throw new Error(`Você precisa de ${HINT_COST} XP para uma dica (tem ${balance}).`);

    const key = process.env.LOVABLE_API_KEY;
    if (!key) throw new Error("LOVABLE_API_KEY não configurada");

    const prompt = `Você é um professor de inglês ajudando um(a) aluno(a) brasileiro(a). Dê uma DICA CURTA em português (máx 2 frases) que ajude a pensar, SEM revelar a resposta.

${data.lessonTitle ? `Aula: ${data.lessonTitle}\n` : ""}Pergunta: ${data.question}
${data.options?.length ? `Opções: ${data.options.map((o, i) => `${i + 1}) ${o}`).join(" | ")}` : ""}

Responda apenas com a dica.`;

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [{ role: "user", content: prompt }],
      }),
    });
    if (!res.ok) throw new Error(`IA falhou: ${res.status}`);
    const json = await res.json();
    const hint = String(json?.choices?.[0]?.message?.content ?? "").trim();

    // Deduct XP
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: prof } = await supabaseAdmin.from("profiles").select("xp_spent").eq("id", context.userId).maybeSingle();
    await supabaseAdmin.from("profiles").update({ xp_spent: (prof?.xp_spent ?? 0) + HINT_COST }).eq("id", context.userId);

    const newBalance = balance - HINT_COST;
    return { hint, balance: newBalance, cost: HINT_COST };
  });

export const generateCheckpointQuiz = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ checkpointIndex: z.number().int().min(0) }).parse(input))
  .handler(async ({ data, context }) => {
    // fetch all lessons ordered, pick the 4 for this checkpoint
    const { data: lessons } = await context.supabase
      .from("lessons")
      .select("id, title, content, order_index")
      .order("order_index", { ascending: true });
    const all = lessons ?? [];
    const start = data.checkpointIndex * 4;
    const group = all.slice(start, start + 4);
    if (group.length < 4) throw new Error("Ainda não há 4 aulas para este checkpoint.");

    const key = process.env.LOVABLE_API_KEY;
    if (!key) throw new Error("LOVABLE_API_KEY não configurada");

    const material = group.map((l, i) => `### Aula ${start + i + 1}: ${l.title}\n${l.content}`).join("\n\n---\n\n");

    const SYSTEM = `Você cria testes de revisão em inglês para brasileiros. A partir das 4 aulas fornecidas, gere um teste consolidado.
Responda APENAS com JSON válido:
{ "questions": [
  { "type": "multiple_choice"|"writing"|"audio_choice"|"audio_writing",
    "question": "enunciado em português",
    "options": ["A","B","C","D"],
    "correctIndex": 0,
    "textAnswer": "resposta",
    "spokenText": "texto em inglês" } ] }

Regras: 6 questões variando tipos, pelo menos 1 de áudio, múltipla escolha com 4 opções.`;

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: SYSTEM },
          { role: "user", content: `Gere o teste com base em:\n\n${material}` },
        ],
        response_format: { type: "json_object" },
      }),
    });
    if (!res.ok) {
      if (res.status === 402) throw new Error("Créditos de IA esgotados.");
      throw new Error(`IA falhou: ${res.status}`);
    }
    const json = await res.json();
    const raw = json?.choices?.[0]?.message?.content ?? "";
    let parsed: any;
    try { parsed = typeof raw === "string" ? JSON.parse(raw) : raw; }
    catch { const m = String(raw).match(/\{[\s\S]*\}/); parsed = m ? JSON.parse(m[0]) : { questions: [] }; }

    const questions = (Array.isArray(parsed.questions) ? parsed.questions : []).map((q: any, i: number) => ({
      id: `cp-${data.checkpointIndex}-${i}`,
      type: ["multiple_choice", "writing", "audio_choice", "audio_writing"].includes(q.type) ? q.type : "multiple_choice",
      question: String(q.question ?? ""),
      options: Array.isArray(q.options) ? q.options.map(String).slice(0, 4) : [],
      correctIndex: Number.isInteger(q.correctIndex) ? q.correctIndex : 0,
      textAnswer: String(q.textAnswer ?? ""),
      spokenText: String(q.spokenText ?? ""),
    }));

    return {
      checkpointIndex: data.checkpointIndex,
      lessons: group.map((l) => ({ id: l.id, title: l.title })),
      questions,
    };
  });

export const saveCheckpointResult = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({
    checkpointIndex: z.number().int().min(0),
    correct: z.number().int().min(0),
    total: z.number().int().min(1),
  }).parse(input))
  .handler(async ({ data, context }) => {
    const { data: existing } = await context.supabase
      .from("checkpoint_progress").select("id, attempts")
      .eq("user_id", context.userId).eq("checkpoint_index", data.checkpointIndex).maybeSingle();
    const payload = {
      user_id: context.userId,
      checkpoint_index: data.checkpointIndex,
      correct: data.correct,
      total: data.total,
      attempts: (existing?.attempts ?? 0) + 1,
      completed_at: new Date().toISOString(),
    };
    const { error } = existing
      ? await context.supabase.from("checkpoint_progress").update(payload).eq("id", existing.id)
      : await context.supabase.from("checkpoint_progress").insert(payload);
    if (error) throw error;
    return { ok: true };
  });
