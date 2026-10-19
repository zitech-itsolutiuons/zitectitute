"use client";

import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import type { SupportMessageView } from "@/components/support/SupportChat";

type ConversationSummary = {
  id: string;
  userId: string;
  userName: string;
  userAvatar: string;
  email: string;
  updatedAt: string;
  unread: boolean;
  lastMessage: string;
};

type InboxResponse = {
  conversations: ConversationSummary[];
  selected: { id: string; userId: string; userAvatar: string; messages: SupportMessageView[] } | null;
  error?: string;
};

function formatTime(value: string) {
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

export default function SupportInbox() {
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [messages, setMessages] = useState<SupportMessageView[]>([]);
  const [userAvatar, setUserAvatar] = useState("");
  const [body, setBody] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const logRef = useRef<HTMLOListElement>(null);

  const loadInbox = useCallback(async (conversationId = "") => {
    const params = new URLSearchParams();
    if (conversationId) params.set("conversationId", conversationId);
    const query = params.toString();
    const response = await fetch(`/api/admin/support${query ? `?${query}` : ""}`, { cache: "no-store" });
    const data: InboxResponse = await response.json();
    if (!response.ok) throw new Error(data.error ?? "The support inbox could not be loaded.");
    setConversations(data.conversations);
    if (data.selected) {
      setMessages(data.selected.messages);
      setUserAvatar(data.selected.userAvatar);
      setError("");
    }
  }, []);

  useEffect(() => {
    let active = true;
    const refresh = async () => {
      try {
        if (active) await loadInbox(selectedId);
      } catch (cause) {
        if (active) setError(cause instanceof Error ? cause.message : "The support inbox could not be loaded.");
      }
    };
    void refresh();
    const timer = window.setInterval(refresh, 12_000);
    window.addEventListener("focus", refresh);
    return () => {
      active = false;
      window.clearInterval(timer);
      window.removeEventListener("focus", refresh);
    };
  }, [loadInbox, selectedId]);

  useEffect(() => {
    logRef.current?.scrollTo({ top: logRef.current.scrollHeight });
  }, [messages]);

  async function selectConversation(id: string) {
    setSelectedId(id);
    setError("");
    try {
      await loadInbox(id);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "This conversation could not be opened.");
    }
  }

  async function sendReply(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = body.trim();
    if (!selectedId || !trimmed || pending) return;
    setPending(true);
    setError("");
    try {
      const response = await fetch("/api/admin/support", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conversationId: selectedId, body: trimmed }),
      });
      const data: { message?: SupportMessageView; error?: string } = await response.json();
      if (!response.ok || !data.message) throw new Error(data.error ?? "Your reply could not be sent.");
      setMessages((current) => [...current, data.message!]);
      setBody("");
      await loadInbox(selectedId);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Your reply could not be sent.");
    } finally {
      setPending(false);
    }
  }

  const activeConversation = conversations.find((conversation) => conversation.id === selectedId);

  return (
    <div className="grid min-h-[34rem] overflow-hidden border border-[#d9d5ca] bg-[#fffdf8] lg:grid-cols-[18rem_minmax(0,1fr)] dark:border-[#394941] dark:bg-[#111b16]">
      <aside aria-label="Support conversations" className="border-b border-[#d9d5ca] lg:border-b-0 lg:border-r dark:border-[#394941]">
        <header className="border-b border-[#d9d5ca] bg-[#eeece4] px-4 py-3 dark:border-[#394941] dark:bg-[#1e2b25]">
          <h2 className="font-semibold text-[#26312d] dark:text-[#f2eee4]">Conversations</h2>
        </header>
        {conversations.length ? (
          <ul className="max-h-64 divide-y divide-[#d9d5ca] overflow-y-auto lg:max-h-[38rem] dark:divide-[#394941]">
            {conversations.map((conversation) => (
              <li key={conversation.id}>
                <button
                  type="button"
                  onClick={() => void selectConversation(conversation.id)}
                  aria-current={selectedId === conversation.id ? "true" : undefined}
                  className={`flex min-h-[5.5rem] w-full items-center gap-3 px-4 py-3 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-inset focus-visible:outline-[#355f4c] dark:focus-visible:outline-[#9abd9f] ${selectedId === conversation.id ? "bg-[#e9eee8] dark:bg-[#26352e]" : "hover:bg-[#f5f2e9] dark:hover:bg-[#1e2b25]"}`}
                >
                  {conversation.userAvatar ? (
                    <img src={conversation.userAvatar} alt="" className="h-11 w-11 shrink-0 rounded-full border border-[#d9d5ca] object-cover dark:border-[#59695e]" />
                  ) : (
                    <span aria-hidden="true" className="grid h-11 w-11 shrink-0 place-items-center rounded-full border border-[#b8c8b8] bg-[#e3ebe1] text-sm font-bold text-[#355f4c] dark:border-[#59695e] dark:bg-[#26352e] dark:text-[#b5c9b5]">
                      {conversation.userName.trim().split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase() || "L"}
                    </span>
                  )}
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center justify-between gap-2">
                      <span className="truncate text-[15px] font-bold leading-5 text-[#26312d] dark:text-[#f2eee4]">{conversation.userName}</span>
                      {conversation.unread && <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-[#a13c30]" aria-label="Unread learner message" />}
                    </span>
                    <span className="mt-0.5 block truncate text-xs text-[#59685e] dark:text-[#c0c8bf]">{conversation.email}</span>
                    <span className="mt-1 block truncate text-xs text-[#59685e] dark:text-[#c0c8bf]">{conversation.lastMessage || "No messages"}</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="px-4 py-6 text-sm leading-6 text-[#59685e] dark:text-[#c0c8bf]">No support conversations yet. Learner requests will appear here.</p>
        )}
      </aside>

      <section aria-label="Selected support conversation" className="flex min-h-[34rem] min-w-0 flex-col">
        {activeConversation ? (
          <>
            <header className="flex items-center gap-3 border-b border-[#d9d5ca] bg-[#eeece4] px-4 py-3 dark:border-[#394941] dark:bg-[#1e2b25]">
              {userAvatar ? (
                <img src={userAvatar} alt={`${activeConversation.userName}'s profile`} className="h-10 w-10 shrink-0 rounded-full border border-[#d9d5ca] object-cover dark:border-[#59695e]" />
              ) : (
                <span aria-hidden="true" className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-[#d9d5ca] bg-[#f5f2e9] text-sm font-semibold text-[#355f4c] dark:border-[#59695e] dark:bg-[#26352e] dark:text-[#b5c9b5]">
                  {activeConversation.userName.trim().split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase() || "?"}
                </span>
              )}
              <div className="min-w-0">
                <h2 className="truncate font-semibold text-[#26312d] dark:text-[#f2eee4]">{activeConversation.userName}</h2>
                <p className="mt-0.5 truncate text-xs text-[#59685e] dark:text-[#c0c8bf]">{activeConversation.email}</p>
              </div>
            </header>
            <ol ref={logRef} aria-live="polite" aria-relevant="additions text" className="flex-1 space-y-4 overflow-y-auto px-4 py-5 sm:px-6">
              {messages.map((message) => {
                const fromSupport = message.authorRole === "admin";
                return (
                  <li key={message.id} className={`flex items-end gap-2 ${fromSupport ? "justify-end" : "justify-start"}`}>
                    {!fromSupport && (
                      userAvatar ? (
                        <img src={userAvatar} alt={`${activeConversation.userName}'s profile`} className="h-8 w-8 shrink-0 rounded-full border border-[#d9d5ca] object-cover dark:border-[#59695e]" />
                      ) : (
                        <span aria-hidden="true" className="grid h-8 w-8 shrink-0 place-items-center rounded-full border border-[#d9d5ca] bg-[#eeece4] text-xs font-semibold text-[#355f4c] dark:border-[#59695e] dark:bg-[#1e2b25] dark:text-[#b5c9b5]">
                          {activeConversation.userName.trim().split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase() || "?"}
                        </span>
                      )
                    )}
                    <article className={`max-w-[min(85%,42rem)] border px-4 py-3 ${fromSupport ? "rounded-2xl rounded-tr-sm border-[#355f4c] bg-[#355f4c] text-white dark:border-[#9abd9f] dark:bg-[#263b30]" : "max-w-[min(78%,42rem)] rounded-2xl rounded-tl-sm border-[#d9d5ca] bg-[#f5f2e9] dark:border-[#394941] dark:bg-[#1e2b25]"}`}>
                      <header className="flex flex-wrap items-baseline justify-between gap-x-5 gap-y-1">
                        <p className={`text-xs font-semibold ${fromSupport ? "text-[#e2d6b8] dark:text-[#d7bd7a]" : "text-[#355f4c] dark:text-[#b5c9b5]"}`}>{fromSupport ? "Support team" : activeConversation.userName}</p>
                        <time dateTime={message.createdAt} className={`text-[11px] tabular-nums ${fromSupport ? "text-[#e9eee8]" : "text-[#59685e] dark:text-[#c0c8bf]"}`}>{formatTime(message.createdAt)}</time>
                      </header>
                      <p className={`mt-2 whitespace-pre-wrap break-words text-sm leading-6 ${fromSupport ? "text-white" : "text-[#26312d] dark:text-[#f2eee4]"}`}>{message.body}</p>
                    </article>
                  </li>
                );
              })}
              {!messages.length && <li className="py-6 text-sm text-[#59685e] dark:text-[#c0c8bf]">Loading conversation…</li>}
            </ol>
            <form onSubmit={sendReply} className="space-y-3 border-t border-[#d9d5ca] p-4 sm:p-5 dark:border-[#394941]">
              <label htmlFor="admin-support-reply" className="block text-sm font-medium text-[#35463c] dark:text-[#d0d8d0]">Reply to learner</label>
              <textarea
                id="admin-support-reply"
                value={body}
                onChange={(event) => setBody(event.target.value)}
                required
                maxLength={4000}
                rows={3}
                className="block w-full border border-[#b8b4a9] bg-[#fffdf8] px-3 py-2 text-sm leading-6 text-[#26312d] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#355f4c] dark:border-[#59695e] dark:bg-[#17211d] dark:text-[#f2eee4] dark:focus-visible:outline-[#9abd9f]"
              />
              {error && <p role="alert" className="text-sm font-medium text-[#9d3026] dark:text-[#ffaaa0]">{error}</p>}
              <div className="flex items-center justify-between gap-3">
                <p className="text-xs tabular-nums text-[#59685e] dark:text-[#c0c8bf]">{body.length}/4000</p>
                <button type="submit" disabled={pending || !body.trim()} className="inline-flex min-h-11 items-center justify-center border border-[#355f4c] bg-[#355f4c] px-5 text-sm font-semibold text-white transition-colors hover:bg-[#263b30] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#355f4c] disabled:cursor-not-allowed disabled:opacity-50 dark:border-[#9abd9f] dark:bg-[#9abd9f] dark:text-[#17211d] dark:hover:bg-[#b5c9b5] dark:focus-visible:outline-[#d7bd7a]">
                  {pending ? "Sending…" : "Send reply"}
                </button>
              </div>
            </form>
          </>
        ) : (
          <div className="grid flex-1 place-items-center px-6 py-12 text-center">
            <div>
              <h2 className="font-serif text-xl font-semibold text-[#26312d] dark:text-[#f2eee4]">Select a conversation</h2>
              <p className="mt-2 max-w-[42ch] text-sm leading-6 text-[#59685e] dark:text-[#c0c8bf]">Choose a learner from the list to read their support request and reply.</p>
            </div>
          </div>
        )}
        {error && !activeConversation && <p role="alert" className="border-t border-[#d9d5ca] px-4 py-3 text-sm text-[#9d3026] dark:border-[#394941] dark:text-[#ffaaa0]">{error}</p>}
      </section>
    </div>
  );
}
