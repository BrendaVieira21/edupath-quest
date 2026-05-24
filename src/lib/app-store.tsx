import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

export type QuizQuestion = {
  id: string;
  question: string;
  options: string[];
  correctIndex: number;
};

export type Lesson = {
  id: string;
  title: string;
  emoji: string;
  description: string;
  content: string;
  attachments: { name: string; url: string }[];
  quiz: QuizQuestion[];
};

export type Student = {
  id: string;
  name: string;
  email: string;
  password: string;
  completedLessons: string[]; // lesson ids
  quizScores: Record<string, { correct: number; total: number }>;
};

type Session =
  | { kind: "student"; studentId: string }
  | { kind: "teacher" }
  | null;

type AppState = {
  lessons: Lesson[];
  students: Student[];
  session: Session;
  signupStudent: (name: string, email: string, password: string) => string | null;
  loginStudent: (email: string, password: string) => string | null;
  loginTeacher: () => void;
  logout: () => void;
  currentStudent: () => Student | null;
  completeLesson: (lessonId: string, score: { correct: number; total: number }) => void;
  addLesson: (lesson: Omit<Lesson, "id">) => void;
};

const STORAGE_KEY = "linguapath_state_v1";

const seedLessons: Lesson[] = [
  {
    id: "l1",
    title: "Greetings & Introductions",
    emoji: "👋",
    description: "Say hi and tell people about yourself.",
    content:
      "## Welcome!\n\nIn this lesson you'll learn how to greet people and introduce yourself in English.\n\n**Key phrases:**\n- Hello! / Hi there!\n- My name is...\n- Nice to meet you.\n- How are you? — I'm fine, thanks.\n\nPractice saying these out loud before taking the quiz.",
    attachments: [],
    quiz: [
      { id: "q1", question: "Which is a polite greeting?", options: ["Bye!", "Hello!", "Go away", "Nope"], correctIndex: 1 },
      { id: "q2", question: "Complete: 'My ___ is Anna.'", options: ["name", "color", "pen", "dog"], correctIndex: 0 },
      { id: "q3", question: "Reply to 'How are you?'", options: ["Yes please", "I'm fine, thanks", "Goodbye", "Sorry"], correctIndex: 1 },
    ],
  },
  {
    id: "l2",
    title: "Numbers & Time",
    emoji: "🔢",
    description: "Count, tell time and talk about your day.",
    content:
      "## Numbers 1–20\n\none, two, three, four, five, six, seven, eight, nine, ten...\n\n## Telling time\n- It's three o'clock.\n- It's half past four.\n- It's quarter to six.",
    attachments: [],
    quiz: [
      { id: "q1", question: "How do we say 12?", options: ["twelf", "twelve", "twelth", "twoteen"], correctIndex: 1 },
      { id: "q2", question: "'Half past 4' means:", options: ["4:15", "4:30", "4:45", "3:30"], correctIndex: 1 },
    ],
  },
  {
    id: "l3",
    title: "Everyday Verbs",
    emoji: "🏃",
    description: "Talk about daily routines using common verbs.",
    content:
      "## Common verbs\n- to eat, to drink, to go, to come\n- to work, to study, to play, to sleep\n\n**Example:** I go to school every day. She plays the piano.",
    attachments: [],
    quiz: [
      { id: "q1", question: "Choose the correct verb: 'I ___ coffee every morning.'", options: ["drink", "drinks", "drinking", "drank"], correctIndex: 0 },
      { id: "q2", question: "Past tense of 'go'?", options: ["goed", "went", "gone", "going"], correctIndex: 1 },
    ],
  },
  {
    id: "l4",
    title: "Travel & Directions",
    emoji: "✈️",
    description: "Ask for directions and survive at the airport.",
    content:
      "## Useful phrases\n- Excuse me, where is the bathroom?\n- Turn left / right.\n- Go straight ahead.\n- How much is a ticket to London?",
    attachments: [],
    quiz: [
      { id: "q1", question: "You want directions. You say:", options: ["I love you", "Excuse me, where is...?", "Goodbye!", "I'm hungry"], correctIndex: 1 },
    ],
  },
  {
    id: "l5",
    title: "Conversation Practice",
    emoji: "💬",
    description: "Put it all together with real dialogues.",
    content: "## Final challenge\n\nMix everything you've learned into a short conversation. Try writing your own dialogue!",
    attachments: [],
    quiz: [
      { id: "q1", question: "Which is the most polite?", options: ["Gimme that", "Could I have that, please?", "Now!", "Take it"], correctIndex: 1 },
    ],
  },
];

type Persisted = { lessons: Lesson[]; students: Student[]; session: Session };

const defaultState: Persisted = {
  lessons: seedLessons,
  students: [
    {
      id: "demo",
      name: "Demo Student",
      email: "demo@student.com",
      password: "demo",
      completedLessons: ["l1"],
      quizScores: { l1: { correct: 3, total: 3 } },
    },
  ],
  session: null,
};

const Ctx = createContext<AppState | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<Persisted>(defaultState);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setState(JSON.parse(raw));
    } catch {}
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (hydrated) localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [state, hydrated]);

  const value: AppState = {
    lessons: state.lessons,
    students: state.students,
    session: state.session,
    signupStudent(name, email, password) {
      if (state.students.some((s) => s.email.toLowerCase() === email.toLowerCase())) {
        return "An account with that email already exists.";
      }
      const id = "s_" + Math.random().toString(36).slice(2, 9);
      const student: Student = { id, name, email, password, completedLessons: [], quizScores: {} };
      setState((p) => ({ ...p, students: [...p.students, student], session: { kind: "student", studentId: id } }));
      return null;
    },
    loginStudent(email, password) {
      const s = state.students.find(
        (s) => s.email.toLowerCase() === email.toLowerCase() && s.password === password,
      );
      if (!s) return "Invalid email or password.";
      setState((p) => ({ ...p, session: { kind: "student", studentId: s.id } }));
      return null;
    },
    loginTeacher() {
      setState((p) => ({ ...p, session: { kind: "teacher" } }));
    },
    logout() {
      setState((p) => ({ ...p, session: null }));
    },
    currentStudent() {
      if (state.session?.kind !== "student") return null;
      return state.students.find((s) => s.id === state.session!.studentId) ?? null;
    },
    completeLesson(lessonId, score) {
      setState((p) => {
        if (p.session?.kind !== "student") return p;
        const sid = p.session.studentId;
        return {
          ...p,
          students: p.students.map((s) =>
            s.id === sid
              ? {
                  ...s,
                  completedLessons: s.completedLessons.includes(lessonId)
                    ? s.completedLessons
                    : [...s.completedLessons, lessonId],
                  quizScores: { ...s.quizScores, [lessonId]: score },
                }
              : s,
          ),
        };
      });
    },
    addLesson(lesson) {
      const id = "l_" + Math.random().toString(36).slice(2, 9);
      setState((p) => ({ ...p, lessons: [...p.lessons, { ...lesson, id }] }));
    },
  };

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useApp() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useApp must be used within AppProvider");
  return v;
}
