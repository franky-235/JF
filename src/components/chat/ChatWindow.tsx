"use client";

import { useState, useEffect, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import { Send, Loader2, MessageSquare } from "lucide-react";
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
  projectName?: string;
}

export default function ChatWindow({ projectId, initialMessages, currentUserId, projectName }: Props) {
  const [messages, setMessages] = useState(initialMessages);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom
  useEffect(() => {
    setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
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
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); }
  }

  // Group messages by date
  const groupedMessages: { date: string; messages: MessageWithProfile[] }[] = [];
  for (const msg of messages) {
    const dateKey = format(new Date(msg.created_at), "EEEE, d. MMMM", { locale: de });
    const last = groupedMessages[groupedMessages.length - 1];
    if (last?.date === dateKey) last.messages.push(msg);
    else groupedMessages.push({ date: dateKey, messages: [msg] });
  }

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-6">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-slate-400 gap-3">
            <MessageSquare className="w-10 h-10 text-slate-200" />
            <p className="text-sm">Noch keine Nachrichten in diesem Kanal</p>
            <p className="text-xs">Starte die Unterhaltung!</p>
          </div>
        ) : (
          groupedMessages.map(({ date, messages: group }) => (
            <div key={date}>
              <div className="flex items-center gap-3 mb-4">
                <div className="flex-1 h-px bg-slate-100" />
                <span className="text-xs text-slate-400 bg-white px-2">{date}</span>
                <div className="flex-1 h-px bg-slate-100" />
              </div>
              <div className="space-y-4">
                {group.map((msg, i) => {
                  const isOwn = msg.user_id === currentUserId;
                  const prevMsg = group[i - 1];
                  const sameUser = prevMsg?.user_id === msg.user_id &&
                    new Date(msg.created_at).getTime() - new Date(prevMsg.created_at).getTime() < 300000;

                  return (
                    <div key={msg.id} className={`flex items-end gap-3 ${isOwn ? "flex-row-reverse" : ""}`}>
                      {/* Avatar */}
                      {!sameUser ? (
                        <div
                          className="w-8 h-8 rounded-full shrink-0 flex items-center justify-center text-white text-sm font-semibold mb-0.5"
                          style={{ background: isOwn ? "#00ffff" : "#94a3b8" }}
                        >
                          {msg.profile?.full_name?.[0]?.toUpperCase() ?? "?"}
                        </div>
                      ) : (
                        <div className="w-8 shrink-0" />
                      )}

                      <div className={`max-w-xs lg:max-w-md flex flex-col ${isOwn ? "items-end" : "items-start"}`}>
                        {!sameUser && (
                          <div className={`flex items-baseline gap-2 mb-1 ${isOwn ? "flex-row-reverse" : ""}`}>
                            <span className="text-xs font-semibold text-slate-700">
                              {isOwn ? "Du" : (msg.profile?.full_name ?? "Unbekannt")}
                            </span>
                            <span className="text-xs text-slate-400">{format(new Date(msg.created_at), "HH:mm")}</span>
                          </div>
                        )}
                        <div
                          className={`px-4 py-2.5 rounded-2xl text-sm leading-relaxed ${
                            isOwn
                              ? "text-black rounded-br-md"
                              : "bg-slate-100 text-slate-800 rounded-bl-md"
                          }`}
                          style={isOwn ? { backgroundColor: "#00ffff" } : {}}
                        >
                          {msg.content}
                        </div>
                        {sameUser && (
                          <span className="text-xs text-slate-300 mt-0.5">
                            {format(new Date(msg.created_at), "HH:mm")}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="border-t border-slate-200 px-4 py-3 bg-white">
        <div className="flex items-end gap-3 bg-slate-50 rounded-xl border border-slate-200 px-4 py-2.5">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={`Nachricht in ${projectName ?? "Kanal"}...`}
            rows={1}
            className="flex-1 bg-transparent text-sm text-slate-800 placeholder-slate-400 resize-none focus:outline-none min-h-[20px] max-h-[100px]"
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || sending}
            className="p-1.5 text-black rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
            style={{ backgroundColor: "#00ffff" }}
          >
            {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          </button>
        </div>
        <p className="text-xs text-slate-400 mt-1.5 text-center">
          Enter zum Senden · Shift+Enter für neue Zeile
        </p>
      </div>
    </div>
  );
}
