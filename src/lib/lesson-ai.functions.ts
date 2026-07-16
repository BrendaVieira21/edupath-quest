import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const Input = z.object({
  textContent: z.string().optional(),
  pdfBase64: z.string().optional(),
  pdfMime: z.string().optional(),
  pdfName: z.string().optional(),
  hint: z.string().optional(),
  numQuestions: z.number().int().min(3).max(10).optional(),
});

const SYSTEM = `Você é um assistente que cria fases de um curso de inglês para brasileiros.
A partir do material fornecido (PDF ou texto), gere UMA fase completa em português (explicações) com exemplos em inglês.

Responda APENAS com JSON válido, no formato:
{
  "title": "string curta",
  "emoji": "1 emoji",
  "description": "1 frase curta que descreve a fase",
  "content": "markdown bilíngue. Use blocos :::pt ... :::en ... para separar português e inglês. Inclua explicação clara, exemplos, e observações. Não use JSON aqui, apenas markdown.",
  "questions": [
    {
      "type": "multiple_choice" | "writing" | "audio_choice" | "audio_writing",
      "question": "enunciado em português (para audio_*, a pergunta pode ser 'Ouça e escreva o que foi dito' etc)",
      "options": ["opção A", "opção B", "opção C", "opção D"],   // apenas para *_choice; use [] nos outros
      "correctIndex": 0,                                           // índice em options (0-based); para writing use 0
      "textAnswer": "resposta esperada",                            // apenas para *_writing; "" nos outros
      "spokenText": "texto em inglês que será lido em voz alta"    // apenas para audio_*; "" nos outros
    }
  ]
}

Regras:
- 3 a 8 questões variando os 4 tipos. Pelo menos 1 de áudio se o tema permitir.
- Múltipla escolha tem sempre 4 opções plausíveis.
- Nunca inclua texto fora do JSON.`;

export const generateLessonFromMaterial = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => Input.parse(data))
  .handler(async ({ data }) => {
    const key = process.env.LOVABLE_API_KEY;
    if (!key) throw new Error("LOVABLE_API_KEY não configurada");

    if (!data.textContent && !data.pdfBase64) {
      throw new Error("Envie um arquivo .txt ou .pdf");
    }

    const userContent: any[] = [
      {
        type: "text",
        text:
          (data.hint ? `Preferências do professor: ${data.hint}\n\n` : "") +
          `Quero ${data.numQuestions ?? 5} questões. Gere a fase agora com base no material a seguir.`,
      },
    ];
    if (data.pdfBase64) {
      userContent.push({
        type: "file",
        file: {
          filename: data.pdfName ?? "material.pdf",
          file_data: `data:${data.pdfMime ?? "application/pdf"};base64,${data.pdfBase64}`,
        },
      });
    }
    if (data.textContent) {
      userContent.push({ type: "text", text: `Material:\n${data.textContent.slice(0, 60000)}` });
    }

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: SYSTEM },
          { role: "user", content: userContent },
        ],
        response_format: { type: "json_object" },
      }),
    });

    if (!res.ok) {
      const txt = await res.text().catch(() => "");
      if (res.status === 402) throw new Error("Créditos de IA esgotados. Adicione créditos ao workspace.");
      if (res.status === 429) throw new Error("Muitas requisições de IA. Tente novamente em instantes.");
      throw new Error(`IA falhou: ${res.status} ${txt}`);
    }

    const json = await res.json();
    const raw = json?.choices?.[0]?.message?.content ?? "";
    let parsed: any;
    try {
      parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
    } catch {
      const m = String(raw).match(/\{[\s\S]*\}/);
      if (!m) throw new Error("IA retornou formato inválido.");
      parsed = JSON.parse(m[0]);
    }

    // Normalize
    const questions = Array.isArray(parsed.questions) ? parsed.questions : [];
    return {
      title: String(parsed.title ?? "Nova fase"),
      emoji: String(parsed.emoji ?? "📘").slice(0, 4),
      description: String(parsed.description ?? ""),
      content: String(parsed.content ?? ""),
      questions: questions.map((q: any) => ({
        type: ["multiple_choice", "writing", "audio_choice", "audio_writing"].includes(q.type)
          ? q.type
          : "multiple_choice",
        question: String(q.question ?? ""),
        options: Array.isArray(q.options) ? q.options.map(String).slice(0, 4) : [],
        correctIndex: Number.isInteger(q.correctIndex) ? q.correctIndex : 0,
        textAnswer: String(q.textAnswer ?? ""),
        spokenText: String(q.spokenText ?? ""),
      })),
    };
  });
