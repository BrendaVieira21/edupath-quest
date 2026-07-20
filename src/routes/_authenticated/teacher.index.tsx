import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { AppHeader } from "@/components/AppHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Plus, Users, BookOpen, Pencil, ArrowUp, ArrowDown, Copy, UserPlus, Trophy, Activity, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { lessonsQuery, myRoleQuery } from "@/lib/queries";
import { deleteStudent, createStudent, listStudents } from "@/lib/teacher.functions";

export const Route = createFileRoute("/_authenticated/teacher/")({ component: TeacherPage });

function TeacherPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { data: role, isLoading: roleLoading } = useQuery(myRoleQuery());
  const { data: lessons = [] } = useQuery(lessonsQuery());
  const listStudentsFn = useServerFn(listStudents);
  const { data: students = [] } = useQuery({
    queryKey: ["students"],
    queryFn: () => listStudentsFn(),
    enabled: role === "teacher",
  });

  useEffect(() => {
    if (!roleLoading && role !== "teacher") navigate({ to: "/student" });
  }, [role, roleLoading, navigate]);

  const total = lessons.length;
  const activeThisWeek = students.filter((s) => {
    if (!s.lastActivity) return false;
    return new Date(s.lastActivity).getTime() > Date.now() - 7 * 86400_000;
  }).length;
  const avgPct =
    students.length && total
      ? Math.round(students.reduce((a, s) => a + s.completedCount / total, 0) / students.length * 100)
      : 0;

  async function moveLesson(id: string, dir: -1 | 1) {
    const idx = lessons.findIndex((l) => l.id === id);
    const target = idx + dir;
    if (idx < 0 || target < 0 || target >= lessons.length) return;
    const a = lessons[idx];
    const b = lessons[target];
    // swap order_index
    await Promise.all([
      supabase.from("lessons").update({ order_index: b.order_index }).eq("id", a.id),
      supabase.from("lessons").update({ order_index: a.order_index }).eq("id", b.id),
    ]);
    qc.invalidateQueries({ queryKey: lessonsQuery().queryKey });
  }

  async function duplicateLesson(lessonId: string) {
    const { data: original } = await supabase.from("lessons").select("*").eq("id", lessonId).maybeSingle();
    if (!original) return;
    const { data: qs } = await supabase.from("quiz_questions").select("*").eq("lesson_id", lessonId);
    const maxOrder = Math.max(0, ...lessons.map((l) => l.order_index));
    const { data: inserted, error } = await supabase
      .from("lessons")
      .insert({
        title: original.title + " (copy)",
        emoji: original.emoji,
        description: original.description,
        content: original.content,
        order_index: maxOrder + 1,
      })
      .select()
      .single();
    if (error || !inserted) return toast.error(error?.message ?? "Failed");
    if (qs && qs.length) {
      await supabase.from("quiz_questions").insert(
        qs.map((q) => ({
          lesson_id: inserted.id,
          question: q.question,
          options: q.options,
          correct_index: q.correct_index,
          position: q.position,
        })),
      );
    }
    qc.invalidateQueries({ queryKey: lessonsQuery().queryKey });
    toast.success("Fase duplicada");
  }

  return (
    <div className="min-h-screen pb-16">
      <AppHeader title="Professor(a)" subtitle="Gerenciar fases e alunos" mode="teacher" />
      <div className="mx-auto max-w-5xl px-4 pt-6">
        <div className="mb-6 flex items-end justify-between gap-4">
          <div>
            <h1 className="text-3xl">Painel do Professor</h1>
            <p className="text-sm text-muted-foreground">Crie fases e acompanhe o progresso dos alunos.</p>
          </div>
          <Link to="/teacher/new-lesson">
            <Button className="rounded-2xl py-6 px-5 text-sm font-bold btn-pop">
              <Plus className="mr-1 h-4 w-4" /> Nova fase
            </Button>
          </Link>
        </div>

        {/* summary */}
        <div className="mb-6 grid gap-3 sm:grid-cols-3">
          <SummaryCard icon={<Users className="h-4 w-4" />} label="Alunos" value={students.length} />
          <SummaryCard icon={<Activity className="h-4 w-4" />} label="Ativos na semana" value={activeThisWeek} />
          <SummaryCard icon={<Trophy className="h-4 w-4" />} label="Progresso médio" value={`${avgPct}%`} />
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          <Card className="rounded-3xl border-2 p-5">
            <div className="mb-4 flex items-center gap-2">
              <div className="grid h-9 w-9 place-items-center rounded-xl bg-primary/20 text-primary"><BookOpen className="h-5 w-5" /></div>
              <h2 className="text-lg">Fases ({total})</h2>
            </div>
            <div className="space-y-2">
              {lessons.length === 0 && (
                <p className="rounded-2xl border-2 border-dashed p-6 text-center text-sm text-muted-foreground">
                  Nenhuma fase ainda. Clique em <b>Nova fase</b> para criar.
                </p>
              )}
              {lessons.map((l, i) => (
                <div key={l.id} className="flex items-center gap-2 rounded-2xl border-2 p-3">
                  <div className="grid h-10 w-10 place-items-center rounded-xl bg-accent text-xl">{l.emoji}</div>
                  <div className="flex-1 min-w-0">
                    <div className="truncate text-sm font-bold">Fase {i + 1}: {l.title}</div>
                    <div className="truncate text-xs text-muted-foreground">{l.description}</div>
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg" disabled={i === 0} onClick={() => moveLesson(l.id, -1)} title="Mover para cima">
                      <ArrowUp className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg" disabled={i === lessons.length - 1} onClick={() => moveLesson(l.id, 1)} title="Mover para baixo">
                      <ArrowDown className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg" onClick={() => duplicateLesson(l.id)} title="Duplicar">
                      <Copy className="h-4 w-4" />
                    </Button>
                    <Link to="/teacher/new-lesson" search={{ id: l.id }}>
                      <Button variant="outline" size="sm" className="rounded-xl">
                        <Pencil className="mr-1 h-3.5 w-3.5" /> Editar
                      </Button>
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          </Card>

          <Card className="rounded-3xl border-2 p-5">
            <div className="mb-4 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <div className="grid h-9 w-9 place-items-center rounded-xl bg-secondary/30 text-secondary-foreground"><Users className="h-5 w-5" /></div>
                <h2 className="text-lg">Alunos ({students.length})</h2>
              </div>
              <CreateStudentDialog />
            </div>
            <div className="overflow-hidden rounded-2xl border-2">
              <table className="w-full text-sm">
                <thead className="bg-muted text-left text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2">Aluno</th>
                    <th className="px-3 py-2">Progresso</th>
                    <th className="px-3 py-2 text-right">Concluído</th>
                    <th className="px-3 py-2 text-center w-12"></th>
                  </tr>
                </thead>
                <tbody>
                  {students.map((s) => {
                    const pct = total ? Math.round((s.completedCount / total) * 100) : 0;
                    return (
                      <tr key={s.id} className="border-t hover:bg-accent/40">
                        <td className="px-3 py-3">
                          <Link to="/teacher/students/$studentId" params={{ studentId: s.id }} className="block">
                            <div className="font-bold">{s.fullName || "(sem nome)"}</div>
                            <div className="text-xs text-muted-foreground">{s.email}</div>
                          </Link>
                        </td>
                        <td className="px-3 py-3">
                          <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                            <div className="h-full rounded-full bg-primary" style={{ width: `${pct}%` }} />
                          </div>
                          <div className="mt-1 text-xs text-muted-foreground">{pct}%</div>
                        </td>
                        <td className="px-3 py-3 text-right font-bold">{s.completedCount}/{total}</td>
                        <td className="px-3 py-3 text-center">
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:bg-destructive/15" onClick={async () => {
                            if (window.confirm(`Tem certeza que deseja remover o aluno ${s.fullName || s.email}? Isso apagará todo o progresso dele.`)) {
                              try {
                                await deleteStudent({ data: { userId: s.id } });
                                toast.success("Aluno removido");
                                qc.invalidateQueries({ queryKey: ["students"] });
                              } catch (e: any) {
                                toast.error(e.message);
                              }
                            }
                          }} title="Remover aluno">
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                  {students.length === 0 && (
                    <tr><td colSpan={3} className="px-3 py-6 text-center text-muted-foreground">Nenhum aluno ainda.</td></tr>
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

function SummaryCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: string | number }) {
  return (
    <Card className="rounded-2xl border-2 p-4">
      <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">
        {icon} {label}
      </div>
      <div className="mt-1 text-2xl font-extrabold">{value}</div>
    </Card>
  );
}

function slugify(s: string) {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s]/g, "")
    .replace(/\s+/g, ".")
    .replace(/^\.+|\.+$/g, "");
}

function CreateStudentDialog() {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [emailTouched, setEmailTouched] = useState(false);
  const [password, setPassword] = useState("aluno.english");
  const qc = useQueryClient();
  const createFn = useServerFn(createStudent);
  const mut = useMutation({
    mutationFn: () => createFn({ data: { fullName: name, email, password } }),
    onSuccess: () => {
      toast.success(`Aluno criado! 🐾 Login: ${email} / ${password}`);
      qc.invalidateQueries({ queryKey: ["students"] });
      setOpen(false);
      setName(""); setEmail(""); setEmailTouched(false); setPassword("aluno.english");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  function onNameChange(v: string) {
    setName(v);
    if (!emailTouched) {
      const slug = slugify(v);
      setEmail(slug ? `${slug}@english.com` : "");
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) { setName(""); setEmail(""); setEmailTouched(false); setPassword("aluno.english"); } }}>
      <DialogTrigger asChild>
        <Button size="sm" className="rounded-xl btn-pop"><UserPlus className="mr-1 h-4 w-4" /> Adicionar aluno</Button>
      </DialogTrigger>
      <DialogContent className="rounded-3xl">
        <DialogHeader><DialogTitle>Adicionar novo aluno 🐱</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>Nome completo</Label>
            <Input value={name} onChange={(e) => onNameChange(e.target.value)} placeholder="Ex: Maria Silva" className="rounded-xl" />
          </div>
          <div className="space-y-1.5">
            <Label>E-mail (gerado automaticamente)</Label>
            <Input type="email" value={email} onChange={(e) => { setEmail(e.target.value); setEmailTouched(true); }} placeholder="maria.silva@english.com" className="rounded-xl" />
            <p className="text-xs text-muted-foreground">Editável se quiser mudar.</p>
          </div>
          <div className="space-y-1.5">
            <Label>Senha temporária</Label>
            <Input value={password} onChange={(e) => setPassword(e.target.value)} className="rounded-xl" />
            <p className="text-xs text-muted-foreground">Padrão: <code className="rounded bg-muted px-1">aluno.english</code></p>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} className="rounded-xl">Cancelar</Button>
          <Button onClick={() => mut.mutate()} disabled={mut.isPending || !name || !email || password.length < 6} className="rounded-xl btn-pop">
            {mut.isPending ? "Criando..." : "Criar aluno 🐾"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
