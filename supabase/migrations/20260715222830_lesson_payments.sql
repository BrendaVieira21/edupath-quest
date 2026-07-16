-- Payment Tracking Table
CREATE TABLE public.lesson_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  lesson_id uuid NOT NULL REFERENCES public.lessons(id) ON DELETE CASCADE,
  paid boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, lesson_id)
);

CREATE INDEX lesson_payments_user_idx ON public.lesson_payments(user_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.lesson_payments TO authenticated;
GRANT ALL ON public.lesson_payments TO service_role;

ALTER TABLE public.lesson_payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Students read own payments" ON public.lesson_payments
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Teachers read all payments" ON public.lesson_payments
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'teacher'));

CREATE POLICY "Teachers upsert payments" ON public.lesson_payments
  FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'teacher'));

CREATE POLICY "Teachers update payments" ON public.lesson_payments
  FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'teacher')) WITH CHECK (public.has_role(auth.uid(), 'teacher'));

CREATE TRIGGER payments_set_updated_at BEFORE UPDATE ON public.lesson_payments
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();
