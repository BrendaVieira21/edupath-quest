import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AppHeader } from "@/components/AppHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { ArrowLeft, KeyRound, Trophy } from "lucide-react";
import { toast } from "sonner";
import { getStudentDetail, resetStudentPassword } from "@/lib/teacher.functions";
import { lessonsQuery } from "@/lib/queries";

export const Route = createFileRoute("/_authenticated/teacher/students/$studentId")({
  component: StudentDetail,
});

function StudentDetail() {
  const { studentId } = Route.useParams();
  const navigate = useNavigate();
  const detailFn = useServerFn(getStudentDetail);
  const { data: lessons = [] } = useQuery(lessonsQuery());
  const { data: detail, isLoading } = useQuery({
    queryKey: ["student-detail", studentId],
    queryFn: () => detailFn({ data: { studentId } }),
  });

  if (isLoading) return <div className="grid min-h-screen place-items-center text-sm text-muted-foreground">Loading…</div>;
  if (!detail) return null;

  const progressById = new Map(detail.progress.map((p) => [p.lesson_id, p]));
  const completed = detail.progress.filter((p) => p.completed_at).length;
  const total = lessons.length;

  return (
    <div className="min-h-screen pb-16">
      <AppHeader title={detail.fullName || "Aluno(a)"} subtitle="Detalhes de progresso" mode="teacher" />
      <div className="mx-auto max-w-3xl px-4 pt-6">
        <button onClick={() => navigate({ to: "/teacher" })} className="mb-4 inline-flex items-center gap-1 text-sm font-semibold text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Voltar para o painel
        </button>

        <Card className="rounded-3xl border-2 p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="text-2xl">{detail.fullName || "(sem nome)"}</h1>
              <p className="text-sm text-muted-foreground">{detail.email}</p>
              <div className="mt-3 inline-flex items-center gap-2 rounded-full bg-warning/30 px-3 py-1 text-sm font-bold text-warning-foreground">
                <Trophy className="h-4 w-4" /> {completed}/{total} fases · {completed * 10} XP
              </div>
            </div>
            <ResetPasswordDialog studentId={studentId} />
          </div>

          <div className="mt-6 overflow-hidden rounded-2xl border-2">
            <table className="w-full text-sm">
              <thead className="bg-muted text-left text-xs font-bold uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="px-3 py-2">Fase</th>
                  <th className="px-3 py-2">Pontuação</th>
                  <th className="px-3 py-2">Tentativas</th>
                  <th className="px-3 py-2">Última atividade</th>
                </tr>
              </thead>
              <tbody>
                {lessons.map((l, i) => {
                  const p = progressById.get(l.id);
                  return (
                    <tr key={l.id} className="border-t">
                      <td className="px-3 py-3">
                        <div className="flex items-center gap-2">
                          <span className="text-lg">{l.emoji}</span>
                          <div>
                            <div className="text-xs text-muted-foreground">Fase {i + 1}</div>
                            <div className="font-bold">{l.title}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-3">
                        {p ? (
                          <span className={`font-bold ${p.correct === p.total ? "text-success" : ""}`}>
                            {p.correct}/{p.total}
                          </span>
                        ) : <span className="text-muted-foreground">—</span>}
                      </td>
                      <td className="px-3 py-3">{p?.attempts ?? 0}</td>
                      <td className="px-3 py-3 text-xs text-muted-foreground">
                        {p?.updated_at ? new Date(p.updated_at).toLocaleString() : "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </div>
  );
}

function ResetPasswordDialog({ studentId }: { studentId: string }) {
  const [open, setOpen] = useState(false);
  const [pw, setPw] = useState("");
  const resetFn = useServerFn(resetStudentPassword);
  const mut = useMutation({
    mutationFn: () => resetFn({ data: { userId: studentId, newPassword: pw } }),
    onSuccess: () => { toast.success("Senha redefinida"); setOpen(false); setPw(""); },
    onError: (e: Error) => toast.error(e.message),
  });
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="rounded-xl"><KeyRound className="mr-1 h-4 w-4" /> Redefinir senha</Button>
      </DialogTrigger>
      <DialogContent className="rounded-3xl">
        <DialogHeader><DialogTitle>Redefinir senha do aluno</DialogTitle></DialogHeader>
        <div className="space-y-1.5">
          <Label>Nova senha temporária</Label>
          <Input value={pw} onChange={(e) => setPw(e.target.value)} minLength={6} className="rounded-xl" />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} className="rounded-xl">Cancelar</Button>
          <Button onClick={() => mut.mutate()} disabled={mut.isPending || pw.length < 6} className="rounded-xl btn-pop">
            {mut.isPending ? "Redefinindo..." : "Redefinir"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
