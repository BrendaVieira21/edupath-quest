
-- Roles enum + table
CREATE TYPE public.app_role AS ENUM ('teacher', 'student');

CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role
  )
$$;

-- Profiles policies
CREATE POLICY "Users read own profile" ON public.profiles
  FOR SELECT TO authenticated USING (auth.uid() = id);
CREATE POLICY "Teachers read all profiles" ON public.profiles
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'teacher'));
CREATE POLICY "Users insert own profile" ON public.profiles
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);
CREATE POLICY "Users update own profile" ON public.profiles
  FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

-- user_roles policies
CREATE POLICY "Users read own role" ON public.user_roles
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Teachers read all roles" ON public.user_roles
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'teacher'));

-- updated_at trigger
CREATE OR REPLACE FUNCTION public.tg_set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE TRIGGER profiles_set_updated_at BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- Auto-create profile + default student role on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', ''));
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'student');
  RETURN NEW;
END; $$;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Lessons
CREATE TABLE public.lessons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  emoji text NOT NULL DEFAULT '📘',
  description text NOT NULL DEFAULT '',
  content text NOT NULL DEFAULT '',
  order_index int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.lessons TO authenticated;
GRANT ALL ON public.lessons TO service_role;
ALTER TABLE public.lessons ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Any authenticated can read lessons" ON public.lessons
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Teachers manage lessons" ON public.lessons
  FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'teacher'))
  WITH CHECK (public.has_role(auth.uid(), 'teacher'));
CREATE TRIGGER lessons_set_updated_at BEFORE UPDATE ON public.lessons
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- Quiz questions
CREATE TABLE public.quiz_questions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lesson_id uuid NOT NULL REFERENCES public.lessons(id) ON DELETE CASCADE,
  question text NOT NULL,
  options jsonb NOT NULL DEFAULT '[]'::jsonb,
  correct_index int NOT NULL DEFAULT 0,
  position int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX quiz_questions_lesson_idx ON public.quiz_questions(lesson_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.quiz_questions TO authenticated;
GRANT ALL ON public.quiz_questions TO service_role;
ALTER TABLE public.quiz_questions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Any authenticated can read questions" ON public.quiz_questions
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Teachers manage questions" ON public.quiz_questions
  FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'teacher'))
  WITH CHECK (public.has_role(auth.uid(), 'teacher'));

-- Attachments
CREATE TABLE public.lesson_attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lesson_id uuid NOT NULL REFERENCES public.lessons(id) ON DELETE CASCADE,
  name text NOT NULL,
  url text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX lesson_attachments_lesson_idx ON public.lesson_attachments(lesson_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.lesson_attachments TO authenticated;
GRANT ALL ON public.lesson_attachments TO service_role;
ALTER TABLE public.lesson_attachments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Any authenticated can read attachments" ON public.lesson_attachments
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Teachers manage attachments" ON public.lesson_attachments
  FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'teacher'))
  WITH CHECK (public.has_role(auth.uid(), 'teacher'));

-- Progress
CREATE TABLE public.lesson_progress (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  lesson_id uuid NOT NULL REFERENCES public.lessons(id) ON DELETE CASCADE,
  correct int NOT NULL DEFAULT 0,
  total int NOT NULL DEFAULT 0,
  attempts int NOT NULL DEFAULT 0,
  completed_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, lesson_id)
);
CREATE INDEX lesson_progress_user_idx ON public.lesson_progress(user_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.lesson_progress TO authenticated;
GRANT ALL ON public.lesson_progress TO service_role;
ALTER TABLE public.lesson_progress ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Students read own progress" ON public.lesson_progress
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Teachers read all progress" ON public.lesson_progress
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'teacher'));
CREATE POLICY "Students upsert own progress" ON public.lesson_progress
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Students update own progress" ON public.lesson_progress
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER progress_set_updated_at BEFORE UPDATE ON public.lesson_progress
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- Seed lessons
WITH ins AS (
  INSERT INTO public.lessons (title, emoji, description, content, order_index) VALUES
  ('Greetings & Introductions','👋','Say hi and tell people about yourself.',
   '## Welcome!

In this lesson you''ll learn how to greet people and introduce yourself in English.

**Key phrases:**
- Hello! / Hi there!
- My name is...
- Nice to meet you.
- How are you? — I''m fine, thanks.', 1),
  ('Numbers & Time','🔢','Count, tell time and talk about your day.',
   '## Numbers 1–20

one, two, three, four, five, six, seven, eight, nine, ten...

## Telling time
- It''s three o''clock.
- It''s half past four.
- It''s quarter to six.', 2),
  ('Everyday Verbs','🏃','Talk about daily routines using common verbs.',
   '## Common verbs
- to eat, to drink, to go, to come
- to work, to study, to play, to sleep

**Example:** I go to school every day.', 3),
  ('Travel & Directions','✈️','Ask for directions and survive at the airport.',
   '## Useful phrases
- Excuse me, where is the bathroom?
- Turn left / right.
- Go straight ahead.
- How much is a ticket to London?', 4),
  ('Conversation Practice','💬','Put it all together with real dialogues.',
   '## Final challenge

Mix everything you''ve learned into a short conversation.', 5)
  RETURNING id, order_index
)
INSERT INTO public.quiz_questions (lesson_id, question, options, correct_index, position)
SELECT ins.id, q.question, q.options::jsonb, q.correct_index, q.position
FROM ins
JOIN (VALUES
  (1,'Which is a polite greeting?', '["Bye!","Hello!","Go away","Nope"]', 1, 1),
  (1,'Complete: ''My ___ is Anna.''', '["name","color","pen","dog"]', 0, 2),
  (1,'Reply to ''How are you?''', '["Yes please","I''m fine, thanks","Goodbye","Sorry"]', 1, 3),
  (2,'How do we say 12?', '["twelf","twelve","twelth","twoteen"]', 1, 1),
  (2,'''Half past 4'' means:', '["4:15","4:30","4:45","3:30"]', 1, 2),
  (3,'Choose: ''I ___ coffee every morning.''', '["drink","drinks","drinking","drank"]', 0, 1),
  (3,'Past tense of ''go''?', '["goed","went","gone","going"]', 1, 2),
  (4,'You want directions. You say:', '["I love you","Excuse me, where is...?","Goodbye!","I''m hungry"]', 1, 1),
  (5,'Which is the most polite?', '["Gimme that","Could I have that, please?","Now!","Take it"]', 1, 1)
) AS q(order_index, question, options, correct_index, position)
ON ins.order_index = q.order_index;
