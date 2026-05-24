import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useApp } from "@/lib/app-store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { GraduationCap, Sparkles, Trophy, BookOpen } from "lucide-react";

export const Route = createFileRoute("/")({ component: Landing });

function Landing() {
  const app = useApp();
  const navigate = useNavigate();

  useEffect(() => {
    if (app.session?.kind === "student") navigate({ to: "/student" });
    if (app.session?.kind === "teacher") navigate({ to: "/teacher" });
  }, [app.session, navigate]);

  return (
    <main className="min-h-screen px-4 py-10 md:py-16">
      <div className="mx-auto max-w-6xl">
        <header className="mb-10 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="grid h-10 w-10 place-items-center rounded-2xl bg-primary text-2xl">🦉</div>
            <span className="text-2xl font-extrabold tracking-tight">Lingua<span className="text-primary">Path</span></span>
          </div>
        </header>

        <div className="grid items-center gap-10 md:grid-cols-2">
          <section>
            <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-accent px-3 py-1 text-xs font-bold text-accent-foreground">
              <Sparkles className="h-3.5 w-3.5" /> Gamified English learning
            </div>
            <h1 className="text-4xl md:text-6xl leading-tight">
              Learn English,<br />
              <span className="text-primary">one playful</span><br />
              <span className="text-secondary">step at a time.</span>
            </h1>
            <p className="mt-5 max-w-md text-base text-muted-foreground">
              Bite-sized lessons, fun quizzes and a learning path that keeps you coming back. Designed with your teacher, made for you.
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
                <LoginForm />
              </TabsContent>
              <TabsContent value="signup" className="mt-5">
                <SignupForm />
              </TabsContent>
            </Tabs>

            <div className="my-6 flex items-center gap-3">
              <div className="h-px flex-1 bg-border" />
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">or</span>
              <div className="h-px flex-1 bg-border" />
            </div>

            <Button
              onClick={() => { app.loginTeacher(); toast.success("Welcome back, teacher!"); navigate({ to: "/teacher" }); }}
              variant="outline"
              className="w-full rounded-2xl border-2 py-6 text-base font-bold"
            >
              <GraduationCap className="mr-2 h-5 w-5" /> Teacher Login
            </Button>
            <p className="mt-2 text-center text-xs text-muted-foreground">Demo student: demo@student.com / demo</p>
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

function LoginForm() {
  const app = useApp();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        const err = app.loginStudent(email, password);
        if (err) toast.error(err);
        else { toast.success("Welcome back!"); navigate({ to: "/student" }); }
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
      <Button type="submit" className="w-full rounded-2xl py-6 text-base font-bold btn-pop">Log in</Button>
    </form>
  );
}

function SignupForm() {
  const app = useApp();
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        const err = app.signupStudent(name, email, password);
        if (err) toast.error(err);
        else { toast.success("Account created! Let's learn."); navigate({ to: "/student" }); }
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
        <Label htmlFor="su-password">Password</Label>
        <Input id="su-password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required className="rounded-xl" />
      </div>
      <Button type="submit" className="w-full rounded-2xl bg-secondary py-6 text-base font-bold text-secondary-foreground btn-pop btn-pop-lavender hover:bg-secondary/90">
        Create account
      </Button>
    </form>
  );
}
