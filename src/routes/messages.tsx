import { createFileRoute, Link } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { useState, useRef, useEffect } from "react";
import { ArrowLeft, Send, Search, Plus } from "lucide-react";

export const Route = createFileRoute("/messages")({
  head: () => ({
    meta: [
      { title: "Messages — SMYD" },
      { name: "description", content: "Chat with other SMYD players in real time." },
    ],
  }),
  component: Messages,
});

type Conversation = {
  id: string;
  name: string;
  initials: string;
  lastMessage: string;
  time: string;
  unread: number;
  online: boolean;
};

type Message = {
  id: string;
  from: "me" | "them";
  text: string;
  time: string;
};

const conversations: Conversation[] = [
  { id: "c1", name: "Ghost_99", initials: "G9", lastMessage: "GG, rematch?", time: "2m", unread: 2, online: true },
  { id: "c2", name: "TripleKing", initials: "TK", lastMessage: "Bo5 for $200?", time: "18m", unread: 0, online: true },
  { id: "c3", name: "Bullseye_Betty", initials: "BB", lastMessage: "Nice 180!", time: "1h", unread: 0, online: false },
  { id: "c4", name: "DartsDestroyer", initials: "DD", lastMessage: "You up later?", time: "3h", unread: 1, online: false },
  { id: "c5", name: "Newbie22", initials: "N2", lastMessage: "Thanks for the tips!", time: "1d", unread: 0, online: false },
];

const seedThread: Record<string, Message[]> = {
  c1: [
    { id: "1", from: "them", text: "gg wp 🎯", time: "10:14" },
    { id: "2", from: "me", text: "good game, that 121 finish was clean", time: "10:14" },
    { id: "3", from: "them", text: "GG, rematch?", time: "10:15" },
  ],
  c2: [
    { id: "1", from: "them", text: "Bo5 for $200?", time: "09:58" },
  ],
  c3: [
    { id: "1", from: "them", text: "Nice 180!", time: "Yesterday" },
  ],
  c4: [
    { id: "1", from: "them", text: "You up later?", time: "Yesterday" },
  ],
  c5: [
    { id: "1", from: "them", text: "Thanks for the tips!", time: "Mon" },
  ],
};

function Messages() {
  const [activeId, setActiveId] = useState<string | null>(null);
  const [threads, setThreads] = useState(seedThread);
  const [query, setQuery] = useState("");

  const active = conversations.find((c) => c.id === activeId) ?? null;
  const filtered = conversations.filter((c) =>
    c.name.toLowerCase().includes(query.toLowerCase())
  );

  return (
    <AppShell>
      <div className="animate-fade-in-up">
        {!active ? (
          <Inbox
            conversations={filtered}
            query={query}
            setQuery={setQuery}
            onOpen={setActiveId}
          />
        ) : (
          <Thread
            conversation={active}
            messages={threads[active.id] ?? []}
            onBack={() => setActiveId(null)}
            onSend={(text) =>
              setThreads((t) => ({
                ...t,
                [active.id]: [
                  ...(t[active.id] ?? []),
                  { id: crypto.randomUUID(), from: "me", text, time: "now" },
                ],
              }))
            }
          />
        )}
      </div>
    </AppShell>
  );
}

function Inbox({
  conversations,
  query,
  setQuery,
  onOpen,
}: {
  conversations: Conversation[];
  query: string;
  setQuery: (v: string) => void;
  onOpen: (id: string) => void;
}) {
  return (
    <div className="px-5 py-6 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-primary">Inbox</p>
          <h1 className="font-display text-2xl font-bold mt-1">Messages</h1>
        </div>
        <button className="size-10 rounded-xl bg-gradient-neon grid place-items-center text-primary-foreground shadow-[0_0_20px_rgba(220,38,38,0.4)]">
          <Plus className="size-5" />
        </button>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search players..."
          className="w-full rounded-xl bg-surface ring-1 ring-border pl-9 pr-3 py-2.5 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-primary/50"
        />
      </div>

      <div className="space-y-2">
        {conversations.length === 0 ? (
          <p className="text-center text-xs text-muted-foreground py-12">No conversations found</p>
        ) : (
          conversations.map((c) => (
            <button
              key={c.id}
              onClick={() => onOpen(c.id)}
              className="w-full flex items-center gap-3 rounded-xl bg-surface ring-1 ring-border p-3 hover:ring-primary/40 transition-all text-left"
            >
              <div className="relative">
                <div className="size-12 rounded-xl bg-background ring-1 ring-primary/40 grid place-items-center font-display text-sm font-bold text-primary">
                  {c.initials}
                </div>
                {c.online && (
                  <span className="absolute -bottom-0.5 -right-0.5 size-3 rounded-full bg-accent ring-2 ring-surface" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-semibold truncate">{c.name}</p>
                  <span className="text-[10px] text-muted-foreground shrink-0">{c.time}</span>
                </div>
                <p className="text-xs text-muted-foreground truncate mt-0.5">{c.lastMessage}</p>
              </div>
              {c.unread > 0 && (
                <span className="ml-1 grid size-5 place-items-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">
                  {c.unread}
                </span>
              )}
            </button>
          ))
        )}
      </div>
    </div>
  );
}

function Thread({
  conversation,
  messages,
  onBack,
  onSend,
}: {
  conversation: Conversation;
  messages: Message[];
  onBack: () => void;
  onSend: (text: string) => void;
}) {
  const [draft, setDraft] = useState("");
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  const submit = () => {
    const text = draft.trim();
    if (!text) return;
    onSend(text);
    setDraft("");
  };

  return (
    <div className="flex flex-col min-h-[calc(100vh-9rem)]">
      <div className="sticky top-[68px] z-30 flex items-center gap-3 border-b border-border/60 bg-background/90 px-4 py-3 backdrop-blur-xl">
        <button onClick={onBack} className="size-8 rounded-lg grid place-items-center hover:bg-surface">
          <ArrowLeft className="size-4" />
        </button>
        <div className="relative">
          <div className="size-9 rounded-lg bg-surface ring-1 ring-primary/40 grid place-items-center font-display text-xs font-bold text-primary">
            {conversation.initials}
          </div>
          {conversation.online && (
            <span className="absolute -bottom-0.5 -right-0.5 size-2.5 rounded-full bg-accent ring-2 ring-background" />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold truncate">{conversation.name}</p>
          <p className="text-[10px] text-muted-foreground">
            {conversation.online ? "Online" : "Offline"}
          </p>
        </div>
        <Link
          to="/tournaments"
          className="rounded-lg bg-primary/15 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-primary ring-1 ring-primary/30"
        >
          Cups
        </Link>
      </div>

      <div className="flex-1 px-4 py-5 space-y-3">
        {messages.map((m) => (
          <div
            key={m.id}
            className={`flex ${m.from === "me" ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`max-w-[75%] rounded-2xl px-3.5 py-2 text-sm ${
                m.from === "me"
                  ? "bg-gradient-neon text-primary-foreground rounded-br-sm"
                  : "bg-surface ring-1 ring-border rounded-bl-sm"
              }`}
            >
              <p className="break-words">{m.text}</p>
              <p
                className={`mt-1 text-[9px] ${
                  m.from === "me" ? "text-primary-foreground/70" : "text-muted-foreground"
                }`}
              >
                {m.time}
              </p>
            </div>
          </div>
        ))}
        <div ref={endRef} />
      </div>

      <div className="sticky bottom-20 border-t border-border/60 bg-background/90 px-4 py-3 backdrop-blur-xl">
        <div className="flex items-center gap-2">
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && submit()}
            placeholder="Type a message..."
            className="flex-1 rounded-full bg-surface ring-1 ring-border px-4 py-2.5 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-primary/50"
          />
          <button
            onClick={submit}
            disabled={!draft.trim()}
            className="size-10 rounded-full bg-gradient-neon grid place-items-center text-primary-foreground shadow-[0_0_20px_rgba(220,38,38,0.4)] disabled:opacity-40 disabled:shadow-none"
          >
            <Send className="size-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
