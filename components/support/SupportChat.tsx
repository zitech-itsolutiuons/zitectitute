"use client";

import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";

export type SupportMessageView = {
  id: string;
  authorRole: "user" | "admin";
  body: string;
  createdAt: string;
};

function messageTime(value: string) {
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

export default function SupportChat({
  initialMessages,
  userName,
  avatarData,
}: {
  initialMessages: SupportMessageView[];
  userName: string;
  avatarData: string;
}) {
  const [messages, setMessages] = useState(initialMessages);
  const [body, setBody] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const logRef = useRef<HTMLOListElement>(null);
  const initials = userName.trim().split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase() || "?";

  const refresh = useCallback(async () => {
    const response = await fetch("/api/support", { cache: "no-store" });
    if (!response.ok) throw new Error("Messages could not be refreshed. Try again.");
    const data: { messages: SupportMessageView[] } = await response.json();
    setMessages(data.messages);
    setError("");
  }, []);

  useEffect(() => {
    let active = true;
    const poll = async () => {
      try {
        if (active) await refresh();
      } catch (cause) {
        if (active) setError(cause instanceof Error ? cause.message : "Messages could not be refreshed.");
      }
    };
    const timer = window.setInterval(poll, 10_000);
    window.addEventListener("focus", poll);
    return () => {
      active = false;
      window.clearInterval(timer);
      window.removeEventListener("focus", poll);
    };
  }, [refresh]);

  useEffect(() => {
    logRef.current?.scrollTo({ top: logRef.current.scrollHeight });
  }, [messages]);

  async function sendMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = body.trim();
    if (!trimmed || pending) return;
    setPending(true);
    setError("");
    try {
      const response = await fetch("/api/support", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: trimmed }),
      });
      const data: { message?: SupportMessageView; error?: string } = await response.json();
      if (!response.ok || !data.message) throw new Error(data.error ?? "Your message could not be sent.");
      setMessages((current) => [...current, data.message!]);
      setBody("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Your message could not be sent.");
    } finally {
      setPending(false);
    }
  }

  return (
    <section className="border border-[#d9d5ca] bg-[#fffdf8] dark:border-[#394941] dark:bg-[#111b16]" aria-label="Support conversation">
      <div className="border-b border-[#d9d5ca] bg-[#eeece4] px-4 py-3 dark:border-[#394941] dark:bg-[#1e2b25]">
        <h2 className="font-semibold text-[#26312d] dark:text-[#f2eee4]">Message the support team</h2>
        <p className="mt-1 text-xs leading-5 text-[#59685e] dark:text-[#c0c8bf]">Your messages are private to you and the administrators supporting you.</p>
      </div>
      <ol ref={logRef} aria-live="polite" aria-relevant="additions text" className="max-h-[55vh] min-h-64 space-y-4 overflow-y-auto px-4 py-5 sm:px-6">
        {messages.length ? messages.map((message) => {
          const fromSupport = message.authorRole === "admin";
          return (
            <li key={message.id} className={`flex items-end gap-2 ${fromSupport ? "justify-start" : "justify-end"}`}>
              <article className={`max-w-[min(85%,42rem)] border px-4 py-3 ${fromSupport ? "rounded-2xl rounded-tl-sm border-[#d9d5ca] bg-[#f5f2e9] dark:border-[#394941] dark:bg-[#1e2b25]" : "max-w-[min(78%,42rem)] rounded-2xl rounded-tr-sm border-[#355f4c] bg-[#355f4c] text-white dark:border-[#9abd9f] dark:bg-[#263b30]"}`}>
                <header className="flex flex-wrap items-baseline justify-between gap-x-5 gap-y-1">
                  <p className={`text-xs font-semibold ${fromSupport ? "text-[#355f4c] dark:text-[#b5c9b5]" : "text-[#e2d6b8] dark:text-[#d7bd7a]"}`}>
                    {fromSupport ? "Support team" : "You"}
                  </p>
                  <time dateTime={message.createdAt} className={`text-[11px] tabular-nums ${fromSupport ? "text-[#59685e] dark:text-[#c0c8bf]" : "text-[#e9eee8]"}`}>
                    {messageTime(message.createdAt)}
                  </time>
                </header>
                <p className={`mt-2 whitespace-pre-wrap break-words text-sm leading-6 ${fromSupport ? "text-[#26312d] dark:text-[#f2eee4]" : "text-white"}`}>{message.body}</p>
              </article>
              {!fromSupport && (
                avatarData ? (
                  <img src={avatarData} alt={`${userName}'s profile`} className="h-8 w-8 shrink-0 rounded-full border border-[#d9d5ca] object-cover dark:border-[#59695e]" />
                ) : (
                  <span aria-hidden="true" className="grid h-8 w-8 shrink-0 place-items-center rounded-full border border-[#d9d5ca] bg-[#eeece4] text-xs font-semibold text-[#355f4c] dark:border-[#59695e] dark:bg-[#1e2b25] dark:text-[#b5c9b5]">{initials}</span>
                )
              )}
            </li>
          );
        }) : (
          <li className="max-w-[60ch] py-8 text-sm leading-6 text-[#59685e] dark:text-[#c0c8bf]">
            No messages yet. Tell us what you need help with, and an administrator will reply here.
          </li>
        )}
      </ol>
      <form onSubmit={sendMessage} className="space-y-3 border-t border-[#d9d5ca] p-4 sm:p-5 dark:border-[#394941]">
        <label htmlFor="support-message" className="block text-sm font-medium text-[#35463c] dark:text-[#d0d8d0]">Your message</label>
        <textarea
          id="support-message"
          value={body}
          onChange={(event) => setBody(event.target.value)}
          required
          maxLength={4000}
          rows={3}
          placeholder="Describe how we can help..."
          className="block w-full border border-[#b8b4a9] bg-[#fffdf8] px-3 py-2 text-sm leading-6 text-[#26312d] placeholder:text-[#6a756b] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#355f4c] dark:border-[#59695e] dark:bg-[#17211d] dark:text-[#f2eee4] dark:placeholder:text-[#a8b2a8] dark:focus-visible:outline-[#9abd9f]"
        />
        {error && <p role="alert" className="text-sm font-medium text-[#9d3026] dark:text-[#ffaaa0]">{error}</p>}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs tabular-nums text-[#59685e] dark:text-[#c0c8bf]">{body.length}/4000</p>
          <button
            type="submit"
            disabled={pending || !body.trim()}
            className="inline-flex min-h-11 items-center justify-center border border-[#355f4c] bg-[#355f4c] px-5 text-sm font-semibold text-white transition-colors hover:bg-[#263b30] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#355f4c] disabled:cursor-not-allowed disabled:opacity-50 dark:border-[#9abd9f] dark:bg-[#9abd9f] dark:text-[#17211d] dark:hover:bg-[#b5c9b5] dark:focus-visible:outline-[#d7bd7a]"
          >
            {pending ? "Sending…" : "Send message"}
          </button>
        </div>
      </form>
    </section>
  );
}
