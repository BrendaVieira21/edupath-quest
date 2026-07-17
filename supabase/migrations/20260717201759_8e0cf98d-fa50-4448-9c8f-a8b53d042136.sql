
-- 1) Pagamento por aluno por aula
CREATE TABLE public.lesson_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  lesson_id uuid NOT NULL REFERENCES public.lessons(id) ON DELETE CASCADE,
  paid boolean NOT NULL DEFAULT true,
  amount numeric(10,2),
  note text,
  paid_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(student_id, lesson_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.lesson_payments TO authenticated;
GRANT ALL ON public.lesson_payments TO service_role;
ALTER TABLE public.lesson_payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Teachers manage payments" ON public.lesson_payments
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'teacher'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'teacher'::app_role));
CREATE POLICY "Students read own payments" ON public.lesson_payments
  FOR SELECT TO authenticated USING (auth.uid() = student_id);
CREATE TRIGGER lesson_payments_set_updated_at BEFORE UPDATE ON public.lesson_payments
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- 2) XP gasto (para dicas). XP total é derivado do progresso; guardamos só o gasto.
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS xp_spent integer NOT NULL DEFAULT 0;

-- 3) Progresso de checkpoints (teste a cada 4 aulas)
CREATE TABLE public.checkpoint_progress (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  checkpoint_index integer NOT NULL,
  correct integer NOT NULL DEFAULT 0,
  total integer NOT NULL DEFAULT 0,
  attempts integer NOT NULL DEFAULT 0,
  completed_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, checkpoint_index)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.checkpoint_progress TO authenticated;
GRANT ALL ON public.checkpoint_progress TO service_role;
ALTER TABLE public.checkpoint_progress ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Students manage own checkpoints" ON public.checkpoint_progress
  FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Teachers read all checkpoints" ON public.checkpoint_progress
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'teacher'::app_role));
CREATE TRIGGER checkpoint_progress_set_updated_at BEFORE UPDATE ON public.checkpoint_progress
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();
