import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useSession } from "@/hooks/useSession";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/")({
  ssr: false,
  component: IndexPage,
});

function IndexPage() {
  const { session, loading } = useSession();
  const navigate = useNavigate();

  useEffect(() => {
    if (loading) return;
    if (!session) {
      navigate({ to: "/auth" });
      return;
    }
    (async () => {
      const { data: roles } = await supabase.from("user_roles").select("role").eq("user_id", session.user.id);
      const isTeacher = (roles ?? []).some((r) => r.role === "teacher");
      navigate({ to: isTeacher ? "/teacher" : "/student" });
    })();
  }, [session, loading, navigate]);

  return (
    <div className="grid min-h-screen place-items-center">
      <div className="text-sm text-muted-foreground">Loading…</div>
    </div>
  );
}
