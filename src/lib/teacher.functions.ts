import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// Hardcoded for demo — change here to update the invite code
const TEACHER_INVITE_CODE = "professor2026";

/** Called right after signup by a user who provided the correct invite code. Elevates them to teacher. */
export const claimTeacherRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ code: z.string() }).parse(input))
  .handler(async ({ data, context }) => {
    if (data.code !== TEACHER_INVITE_CODE) {
      throw new Error("Invalid invite code");
    }
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    // Add teacher role, remove student role
    await supabaseAdmin.from("user_roles").delete().eq("user_id", context.userId);
    const { error } = await supabaseAdmin
      .from("user_roles")
      .insert({ user_id: context.userId, role: "teacher" });
    if (error) throw error;
    return { ok: true };
  });

/** Teacher creates a student account manually. */
export const createStudent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({
      email: z.string().email(),
      password: z.string().min(6),
      fullName: z.string().min(1),
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { data: isTeacher } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "teacher",
    });
    if (!isTeacher) throw new Error("Forbidden");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
      email: data.email,
      password: data.password,
      email_confirm: true,
      user_metadata: { full_name: data.fullName },
    });
    if (error) throw error;
    return { userId: created.user?.id };
  });

/** Teacher resets a student's password. */
export const resetStudentPassword = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({ userId: z.string().uuid(), newPassword: z.string().min(6) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { data: isTeacher } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "teacher",
    });
    if (!isTeacher) throw new Error("Forbidden");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.auth.admin.updateUserById(data.userId, {
      password: data.newPassword,
    });
    if (error) throw error;
    return { ok: true };
  });

/** Teacher lists all students with aggregated progress. */
export const listStudents = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: isTeacher } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "teacher",
    });
    if (!isTeacher) throw new Error("Forbidden");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const [{ data: roles }, { data: profiles }, { data: progress }, adminRes] = await Promise.all([
      supabaseAdmin.from("user_roles").select("user_id, role").eq("role", "student"),
      supabaseAdmin.from("profiles").select("id, full_name"),
      supabaseAdmin.from("lesson_progress").select("user_id, lesson_id, correct, total, completed_at, updated_at"),
      supabaseAdmin.auth.admin.listUsers({ perPage: 200 }),
    ]);

    const studentIds = new Set((roles ?? []).map((r) => r.user_id));
    const profileById = new Map((profiles ?? []).map((p) => [p.id, p.full_name]));
    const emailById = new Map((adminRes.data.users ?? []).map((u) => [u.id, u.email ?? ""]));
    const progressByUser = new Map<string, typeof progress>();
    for (const p of progress ?? []) {
      const arr = progressByUser.get(p.user_id) ?? [];
      arr.push(p);
      progressByUser.set(p.user_id, arr);
    }

    return Array.from(studentIds).map((uid) => {
      const rows = progressByUser.get(uid) ?? [];
      const completed = rows.filter((r) => r.completed_at).length;
      const lastActivity = rows.reduce<string | null>(
        (acc, r) => (r.updated_at > (acc ?? "") ? r.updated_at : acc),
        null,
      );
      return {
        id: uid,
        fullName: profileById.get(uid) ?? "",
        email: emailById.get(uid) ?? "",
        completedCount: completed,
        lastActivity,
      };
    });
  });

/** Teacher gets detailed progress for one student. */
export const getStudentDetail = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ studentId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { data: isTeacher } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "teacher",
    });
    if (!isTeacher) throw new Error("Forbidden");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const [{ data: profile }, { data: progress }, adminRes] = await Promise.all([
      supabaseAdmin.from("profiles").select("id, full_name").eq("id", data.studentId).maybeSingle(),
      supabaseAdmin.from("lesson_progress").select("*").eq("user_id", data.studentId),
      supabaseAdmin.auth.admin.getUserById(data.studentId),
    ]);
    return {
      id: data.studentId,
      fullName: profile?.full_name ?? "",
      email: adminRes.data.user?.email ?? "",
      progress: progress ?? [],
    };
  });
