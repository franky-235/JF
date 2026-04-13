"use client";

import { useState, useEffect, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import { Send } from "lucide-react";
import type { Message, Profile } from "@/types";
import { format } from "date-fns";
import { de } from "date-fns/locale";

interface MessageWithProfile extends Omit<Message, "profile"> {
  profile: Pick<Profile, "id" | "full_name" | "avatar_url"> | null;
}

interface Props {
  projectId: string;
  initialMessages: MessageWithProfile[];
  currentUserId: string;
}

export default function ChatWindow({ projectId, initialMessages, currentUserId }: Props) {
  const [messages, setMessages] = useState(initialMessages);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Realtime subscription
  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`chat-${projectId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages", filter: `project_id=eq.${projectId}` },
        async (payload) => {
          const newMsg = payload.new as Message;
          // Fetch profile for new message
          const { data: profile } = await supabase
            .from("profiles")
            .select("id, full_name, avatar_url")
            .eq("id", newMsg.user_id)
            .single();
          setMessages((prev) => [...prev, { ...newMsg, profile: profile ?? null }]);
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [projectId]);

  async function handleSend() {
    const content = input.trim();
    if (!content || sending) return;
    setSending(true);
    setInput("");

    const supabase = createClient();
    await supabase.from("messages").insert({ project_id: projectId, user_id: currentUserId, content });
    setSending(false);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  function groupMessages() {
    const groups: { date: string; messages: MessageWithProfile[] }[] = [];
    for (const msg of messages) {
      const dateKey = format(new Date(msg.created_at), "dd. MMMM yyyy", { locale: de });
      const last = groups[groups.length - 1];
      if (last?.date === dateKey) last.messages.push(msg);
      else groups.push({ date: dateKey, messages: [msg] });
    }
    return groups;
  }

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-6 py-4 space-y-1">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
            <p className="text-lg font-medium mb-1">Noch keine Nachrichten</p>
            <p className="text-sm">Starte die Unterhaltung für dieses Projekt.</p>
          </div>
        )}

        {groupMessages().map(({ date, messages: group }) => (
          <div key={date}>
            <div className="flex items-center gap-3 my-4">
              <div className="flex-1 border-t" />
              <span className="text-xs text-muted-foreground font-medium">{date}</span>
              <div className="flex-1 border-t" />
            </div>
            {group.map((msg, i) => {
              const isOwn = msg.user_id === currentUserId;
              const prevMsg = group[i - 1];
              const isContinuation = prevMsg?.user_id === msg.user_id;

              return (
                <div key={msg.id} className={`flex gap-3 ${isOwn ? "flex-row-reverse" : ""} ${isContinuation ? "mt-0.5" : "mt-3"}`}>
                  {/* Avatar */}
                  {!isContinuation ? (
                    <div className={`w-8 h-8 rounded-full shrink-0 flex items-center justify-center text-sm font-semibold ${isOwn ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>
                      {msg.profile?.full_name?.[0]?.toUpperCase() ?? "?"}
                    </div>
                  ) : (
                    <div className="w-8 shrink-0" />
                  )}

                  <div className={`max-w-[70%] ${isOwn ? "items-end" : "items-start"} flex flex-col`}>
                    {!isContinuation && (
                      <div className={`flex items-center gap-2 mb-1 ${isOwn ? "flex-row-reverse" : ""}`}>
                        <span className="text-xs font-medium">{isOwn ? "Du" : msg.profile?.full_name ?? "Unbekannt"}</span>
                        <span className="text-xs text-muted-foreground">{format(new Date(msg.created_at), "HH:mm")}</span>
                      </div>
                    )}
                    <div className={`px-3.5 py-2.5 rounded-2xl text-sm leading-relaxed ${
                      isOwn
                        ? "bg-primary text-primary-foreground rounded-tr-sm"
                        : "bg-muted rounded-tl-sm"
                    }`}>
                      {msg.content}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="border-t px-6 py-4">
        <div className="flex gap-3 items-end">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Nachricht schreiben... (Enter zum Senden)"
            rows={1}
            className="flex-1 px-4 py-2.5 border rounded-xl bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring resize-none max-h-32"
            style={{ height: "auto" }}
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || sending}
            className="p-2.5 bg-primary text-primary-foreground rounded-xl hover:opacity-90 transition disabled:opacity-40"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
