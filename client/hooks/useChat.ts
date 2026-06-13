import { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";

type Message = { id: string; sender: string; message: string; created_at: string };

export function useChat(sessionId: string | null, name: string, chatOpen: boolean) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [sending, setSending] = useState(false);
  const [unread, setUnread] = useState(0);
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (!chatOpen && messages.length > 0) setUnread(v => v + 1);
  }, [messages.length]);

  useEffect(() => {
    if (chatOpen) setUnread(0);
  }, [chatOpen]);

  function subscribeToMessages(id: string) {
    supabase.channel(`messages-${id}`)
      .on("postgres_changes", {
        event: "INSERT", schema: "public",
        table: "messages", filter: `session_id=eq.${id}`,
      }, (payload) => {
        setMessages(prev =>
          prev.find(m => m.id === payload.new.id) ? prev : [...prev, payload.new as Message]
        );
      }).subscribe();
  }

  async function loadMessages(id: string) {
    const { data } = await supabase
      .from("messages").select("*")
      .eq("session_id", id)
      .order("created_at", { ascending: true });
    setMessages(data || []);
  }

  async function sendMessage() {
    if (!chatInput.trim() || !sessionId || sending) return;
    setSending(true);
    const msg = chatInput.trim();
    setChatInput("");
    await supabase.from("messages").insert({ session_id: sessionId, sender: name, message: msg });
    setSending(false);
  }

  return {
    messages, chatInput, setChatInput, sending, unread,
    chatEndRef, sendMessage, loadMessages, subscribeToMessages,
  };
}