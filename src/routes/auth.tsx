import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useServerFn } from "@tanstack/react-start";
import { claimTeacherRole } from "@/lib/teacher.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { GraduationCap, Sparkles, Trophy, BookOpen } from "lucide-react";

export const Route = createFileRoute("/auth")({ component: AuthPage });

function AuthPage() {
  const navigate = useNavigate();

  async function afterLogin() {
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) return;
    const { data: roles } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userData.user.id);
    const isTeacher = (roles ?? []).some((r) => r.role === "teacher");
    navigate({ to: isTeacher ? "/teacher" : "/student" });
  }

  return (
    <main className="min-h-screen px-4 py-10 md:py-16">
      <div className="mx-auto max-w-6xl">
        <header className="mb-10 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="grid h-10 w-10 place-items-center rounded-2xl bg-primary text-2xl">🦉</div>
            <span className="text-2xl font-extrabold tracking-tight">
              Lingua<span className="text-primary">Path</span>
            </span>
          </div>
        </header>

        <div className="grid items-center gap-10 md:grid-cols-2">
          <section>
            <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-accent px-3 py-1 text-xs font-bold text-accent-foreground">
              <Sparkles className="h-3.5 w-3.5" /> Gamified English learning
            </div>
            <h1 className="text-4xl md:text-6xl leading-tight">
              Learn English,
              <br />
              <span className="text-primary">one playful</span>
              <br />
              <span className="text-secondary">step at a time.</span>
            </h1>
            <p className="mt-5 max-w-md text-base text-muted-foreground">
              Bite-sized lessons, fun quizzes and a learning path that keeps you coming back.
            </p>
            <div className="mt-8 grid max-w-md grid-cols-3 gap-3">
              <Feature icon={<BookOpen className="h-5 w-5" />} label="Lessons" />
              <Feature icon={<Trophy className="h-5 w-5" />} label="Quizzes" />
              <Feature icon={<GraduationCap className="h-5 w-5" />} label="Progress" />
            </div>
          </section>

          <Card className="rounded-3xl border-2 p-6 shadow-xl">
            <Tabs defaultValue="login" className="w-full">
              <TabsList className="grid w-full grid-cols-2 rounded-2xl bg-muted p-1">
                <TabsTrigger value="login" className="rounded-xl">Log in</TabsTrigger>
                <TabsTrigger value="signup" className="rounded-xl">Sign up</TabsTrigger>
              </TabsList>

              <TabsContent value="login" className="mt-5">
                <LoginForm onDone={afterLogin} />
              </TabsContent>
              <TabsContent value="signup" className="mt-5">
                <SignupForm onDone={afterLogin} />
              </TabsContent>
            </Tabs>
          </Card>
        </div>
      </div>
    </main>
  );
}

function Feature({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-2xl bg-card p-3 text-center shadow-sm">
      <div className="grid h-9 w-9 place-items-center rounded-xl bg-accent text-accent-foreground">{icon}</div>
      <span className="text-xs font-bold">{label}</span>
    </div>
  );
}

function LoginForm({ onDone }: { onDone: () => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  return (
    <form
      className="space-y-4"
      onSubmit={async (e) => {
        e.preventDefault();
        setLoading(true);
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        setLoading(false);
        if (error) return toast.error(error.message);
        toast.success("Welcome back!");
        onDone();
      }}
    >
      <div className="space-y-1.5">
        <Label htmlFor="email">Email</Label>
        <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required className="rounded-xl" />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="password">Password</Label>
        <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required className="rounded-xl" />
      </div>
      <Button type="submit" disabled={loading} className="w-full rounded-2xl py-6 text-base font-bold btn-pop">
        {loading ? "Signing in..." : "Log in"}
      </Button>
    </form>
  );
}

function SignupForm({ onDone }: { onDone: () => void }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [asTeacher, setAsTeacher] = useState(false);
  const [inviteCode, setInviteCode] = useState("");
  const [loading, setLoading] = useState(false);
  const claim = useServerFn(claimTeacherRole);

  return (
    <form
      className="space-y-4"
      onSubmit={async (e) => {
        e.preventDefault();
        setLoading(true);
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: { data: { full_name: name }, emailRedirectTo: window.location.origin },
        });
        if (error) { setLoading(false); return toast.error(error.message); }

        // Sign in immediately (works when email confirmations are disabled, which is default for demo)
        const { error: loginErr } = await supabase.auth.signInWithPassword({ email, password });
        if (loginErr) {
          setLoading(false);
          toast.success("Account created! Please log in.");
          return;
        }

        if (asTeacher) {
          try {
            await claim({ data: { code: inviteCode } });
            toast.success("Welcome, teacher!");
          } catch (err) {
            toast.error("Invalid invite code — created as student instead.");
          }
        } else {
          toast.success("Account created! Let's learn.");
        }
        setLoading(false);
        onDone();
      }}
    >
      <div className="space-y-1.5">
        <Label htmlFor="name">Your name</Label>
        <Input id="name" value={name} onChange={(e) => setName(e.target.value)} required className="rounded-xl" />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="su-email">Email</Label>
        <Input id="su-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required className="rounded-xl" />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="su-password">Password (min 6)</Label>
        <Input id="su-password" type="password" minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} required className="rounded-xl" />
      </div>

      <div className="flex items-center gap-2 rounded-xl bg-muted/50 p-3">
        <Checkbox id="asTeacher" checked={asTeacher} onCheckedChange={(v) => setAsTeacher(!!v)} />
        <Label htmlFor="asTeacher" className="text-sm">I'm a teacher (invite code required)</Label>
      </div>
      {asTeacher && (
        <div className="space-y-1.5">
          <Label htmlFor="invite">Invite code</Label>
          <Input id="invite" value={inviteCode} onChange={(e) => setInviteCode(e.target.value)} className="rounded-xl" />
        </div>
      )}

      <Button type="submit" disabled={loading} className="w-full rounded-2xl bg-secondary py-6 text-base font-bold text-secondary-foreground btn-pop btn-pop-lavender hover:bg-secondary/90">
        {loading ? "Creating..." : "Create account"}
      </Button>
    </form>
  );
}
