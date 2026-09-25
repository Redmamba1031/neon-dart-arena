import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { useState, useRef, useEffect, useMemo } from "react";
import { ArrowLeft, Send, Search, Plus, Loader2 } from "lucide-react";
import {
  useConversations,
  useMarkThreadRead,
  usePlayerSearch,
  useProfilesByIds,
  useSendMessage,
  useThread,
  type ProfileLite,
} from "@/lib/api";

export const Route = createFileRoute("/messages")({
  head: () => ({
    meta: [
      { title: "Messages — SMYD" },
      { name: "description", content: "Message other SMYD darts players in real time to set up and coordinate your 1v1 matches." },
      { property: "og:title", content: "Messages — SMYD" },
      { property: "og:description", content: "Chat with SMYD players in real time to coordinate matches." },
    ],
  }),
  component: Messages,
});

const initialsOf = (p?: ProfileLite | null) =>
  (p?.display_name || p?.username || "?").slice(0, 2).toUpperCase();

const nameOf = (p?: ProfileLite | null) => p?.display_name || p?.username || "Player";

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "now";
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  return `${Math.floor(h / 24)}d`;
}

function clockOf(iso: string) {
  return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function Avatar({ profile, size = "size-12" }: { profile?: ProfileLite | null; size?: string }) {
  return (
    <div
      className={`${size} overflow-hidden rounded-xl bg-background ring-1 ring-primary/40 grid place-items-center font-display text-sm font-bold text-primary`}
    >
      {profile?.avatar_url ? (
        <img src={profile.avatar_url} alt="" className="size-full object-cover" />
      ) : (
        initialsOf(profile)
      )}
    </div>
  );
}

function Messages() {
  const [activeId, setActiveId] = useState<string | null>(null);

  return (
    <AppShell>
      <div className="animate-fade-in-up">
        {!activeId ? (
          <Inbox onOpen={setActiveId} />
        ) : (
          <Thread peerId={activeId} onBack={() => setActiveId(null)} />
        )}
      </div>
    </AppShell>
  );
}

function Inbox({ onOpen }: { onOpen: (id: string) => void }) {
  const [query, setQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const { data, isLoading } = useConversations();
  const conversations = data?.items ?? [];
  const me = data?.me ?? null;

  const peerIds = useMemo(() => conversations.map((c) => c.peerId), [conversations]);
  const { data: profiles } = useProfilesByIds(peerIds);
  const { data: results, isFetching } = usePlayerSearch(searching ? query : "");

  const showSearch = searching && query.trim().length >= 2;

  return (
    <div className="px-5 py-6 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-primary">Inbox</p>
          <h1 className="font-display text-2xl font-bold mt-1">Messages</h1>
        </div>
        <button
          onClick={() => setSearching((s) => !s)}
          className="size-10 rounded-xl bg-gradient-neon grid place-items-center text-primary-foreground shadow-[0_0_20px_rgba(220,38,38,0.4)]"
          aria-label="Find players to message"
        >
          <Plus className={`size-5 transition-transform ${searching ? "rotate-45" : ""}`} />
        </button>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
        <input
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            if (e.target.value.trim()) setSearching(true);
          }}
          placeholder="Search players to message..."
          className="w-full rounded-xl bg-surface ring-1 ring-border pl-9 pr-3 py-2.5 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-primary/50"
        />
      </div>

      {showSearch ? (
        <div className="space-y-2">
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">
            Players
          </p>
          {isFetching && (
            <p className="text-center text-xs text-muted-foreground py-6">Searching…</p>
          )}
          {!isFetching && (results ?? []).length === 0 && (
            <p className="text-center text-xs text-muted-foreground py-6">No players found</p>
          )}
          {(results ?? []).map((p) => (
            <button
              key={p.id}
              onClick={() => {
                setSearching(false);
                setQuery("");
                onOpen(p.id);
              }}
              className="w-full flex items-center gap-3 rounded-xl bg-surface ring-1 ring-border p-3 hover:ring-primary/40 transition-all text-left"
            >
              <Avatar profile={p as ProfileLite} />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold truncate">{nameOf(p as ProfileLite)}</p>
                <p className="text-xs text-muted-foreground truncate mt-0.5">
                  {p.username ? `@${p.username}` : "Tap to start a chat"}
                </p>
              </div>
            </button>
          ))}
        </div>
      ) : (
        <div className="space-y-2">
          {isLoading ? (
            <div className="flex justify-center py-12 text-muted-foreground">
              <Loader2 className="size-5 animate-spin" />
            </div>
          ) : conversations.length === 0 ? (
            <p className="text-center text-xs text-muted-foreground py-12">
              No conversations yet — search for a player above to start one.
            </p>
          ) : (
            conversations.map((c) => {
              const p = profiles?.get(c.peerId);
              const mine = c.lastMessage.sender_id === me;
              return (
                <button
                  key={c.peerId}
                  onClick={() => onOpen(c.peerId)}
                  className="w-full flex items-center gap-3 rounded-xl bg-surface ring-1 ring-border p-3 hover:ring-primary/40 transition-all text-left"
                >
                  <Avatar profile={p} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-semibold truncate">{nameOf(p)}</p>
                      <span className="text-[10px] text-muted-foreground shrink-0">
                        {timeAgo(c.lastMessage.created_at)}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground truncate mt-0.5">
                      {mine ? "You: " : ""}
                      {c.lastMessage.body}
                    </p>
                  </div>
                  {c.unread > 0 && (
                    <span className="ml-1 grid size-5 place-items-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">
                      {c.unread}
                    </span>
                  )}
                </button>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}

function Thread({ peerId, onBack }: { peerId: string; onBack: () => void }) {
  const [draft, setDraft] = useState("");
  const endRef = useRef<HTMLDivElement>(null);
  const { data, isLoading } = useThread(peerId);
  const { data: profiles } = useProfilesByIds([peerId]);
  const peer = profiles?.get(peerId);
  const send = useSendMessage();
  const markRead = useMarkThreadRead();
  const messages = data?.messages ?? [];
  const me = data?.me ?? null;

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  useEffect(() => {
    if (messages.some((m) => m.recipient_id === me && !m.read_at)) {
      markRead.mutate(peerId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages.length, peerId, me]);

  const submit = () => {
    const text = draft.trim();
    if (!text || send.isPending) return;
    send.mutate({ recipientId: peerId, body: text });
    setDraft("");
  };

  return (
    <div className="flex flex-col min-h-[calc(100vh-9rem)]">
      <div className="sticky top-[68px] z-30 flex items-center gap-3 border-b border-border/60 bg-background/90 px-4 py-3 backdrop-blur-xl">
        <button onClick={onBack} className="size-8 rounded-lg grid place-items-center hover:bg-surface">
          <ArrowLeft className="size-4" />
        </button>
        <Avatar profile={peer} size="size-9" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold truncate">{nameOf(peer)}</p>
          {peer?.username && (
            <p className="text-[10px] text-muted-foreground">@{peer.username}</p>
          )}
        </div>
      </div>

      <div className="flex-1 px-4 py-5 space-y-3">
        {isLoading ? (
          <div className="flex justify-center py-12 text-muted-foreground">
            <Loader2 className="size-5 animate-spin" />
          </div>
        ) : messages.length === 0 ? (
          <p className="text-center text-xs text-muted-foreground py-12">
            Say hello — messages are private between the two of you.
          </p>
        ) : (
          messages.map((m) => {
            const mine = m.sender_id === me;
            return (
              <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                <div
                  className={`max-w-[75%] rounded-2xl px-3.5 py-2 text-sm ${
                    mine
                      ? "bg-gradient-neon text-primary-foreground rounded-br-sm"
                      : "bg-surface ring-1 ring-border rounded-bl-sm"
                  }`}
                >
                  <p className="break-words">{m.body}</p>
                  <p
                    className={`mt-1 text-[9px] ${
                      mine ? "text-primary-foreground/70" : "text-muted-foreground"
                    }`}
                  >
                    {clockOf(m.created_at)}
                  </p>
                </div>
              </div>
            );
          })
        )}
        <div ref={endRef} />
      </div>

      <div className="sticky bottom-20 border-t border-border/60 bg-background/90 px-4 py-3 backdrop-blur-xl">
        {send.isError && (
          <p className="pb-2 text-[11px] text-destructive">
            {(send.error as Error)?.message ?? "Message could not be sent."}
          </p>
        )}
        <div className="flex items-center gap-2">
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && submit()}
            placeholder="Type a message..."
            maxLength={2000}
            className="flex-1 rounded-full bg-surface ring-1 ring-border px-4 py-2.5 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-primary/50"
          />
          <button
            onClick={submit}
            disabled={!draft.trim() || send.isPending}
            className="size-10 rounded-full bg-gradient-neon grid place-items-center text-primary-foreground shadow-[0_0_20px_rgba(220,38,38,0.4)] disabled:opacity-40 disabled:shadow-none"
          >
            {send.isPending ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
          </button>
        </div>
      </div>
    </div>
  );
}
