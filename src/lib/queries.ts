import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type Lesson = {
  id: string;
  title: string;
  emoji: string;
  description: string;
  content: string;
  order_index: number;
};

export type QuizQuestion = {
  id: string;
  lesson_id: string;
  question: string;
  options: string[];
  correct_index: number;
  position: number;
};

export type Attachment = { id: string; lesson_id: string; name: string; url: string };

export type Progress = {
  id: string;
  user_id: string;
  lesson_id: string;
  correct: number;
  total: number;
  attempts: number;
  completed_at: string | null;
  updated_at: string;
};

export const lessonsQuery = () =>
  queryOptions({
    queryKey: ["lessons"],
    queryFn: async (): Promise<Lesson[]> => {
      const { data, error } = await supabase
        .from("lessons")
        .select("*")
        .order("order_index", { ascending: true });
      if (error) throw error;
      return (data ?? []) as Lesson[];
    },
  });

export const lessonQuery = (lessonId: string) =>
  queryOptions({
    queryKey: ["lesson", lessonId],
    queryFn: async () => {
      const [{ data: lesson, error: e1 }, { data: qs, error: e2 }, { data: at, error: e3 }] = await Promise.all([
        supabase.from("lessons").select("*").eq("id", lessonId).maybeSingle(),
        supabase.from("quiz_questions").select("*").eq("lesson_id", lessonId).order("position"),
        supabase.from("lesson_attachments").select("*").eq("lesson_id", lessonId).order("created_at"),
      ]);
      if (e1) throw e1;
      if (e2) throw e2;
      if (e3) throw e3;
      return {
        lesson: lesson as Lesson | null,
        questions: (qs ?? []).map((q) => ({ ...q, options: q.options as string[] })) as QuizQuestion[],
        attachments: (at ?? []) as Attachment[],
      };
    },
  });

export const myProgressQuery = () =>
  queryOptions({
    queryKey: ["my-progress"],
    queryFn: async (): Promise<Progress[]> => {
      const { data, error } = await supabase.from("lesson_progress").select("*");
      if (error) throw error;
      return (data ?? []) as Progress[];
    },
  });

export const myRoleQuery = () =>
  queryOptions({
    queryKey: ["my-role"],
    queryFn: async (): Promise<"teacher" | "student" | null> => {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) return null;
      const { data, error } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", userData.user.id);
      if (error) throw error;
      const roles = (data ?? []).map((r) => r.role);
      if (roles.includes("teacher")) return "teacher";
      if (roles.includes("student")) return "student";
      return null;
    },
  });
