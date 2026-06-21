import { supabase } from "@/src/lib/supabase";

export interface ChatSession {
  id:              string;
  user_id:         string;
  order_id:        string | null;
  status:          "open" | "resolved";
  last_message_at: string | null;
  created_at:      string;
  user_name:       string | null;
  user_email:      string | null;
  last_message:    string | null;
  unread_count:    number;
}

export interface ChatMessage {
  id:           string;
  session_id:   string;
  order_id:     string | null;
  user_id:      string | null;
  admin_id:     string | null;
  message_text: string;
  message_type: "user" | "admin" | "system";
  is_read:      boolean;
  created_at:   string;
}

// ─── Customer ─────────────────────────────────────────────────────

export async function getOrCreateSession(
  userId: string,
  orderId?: string,
): Promise<ChatSession | null> {
  const { data: existing } = await supabase
    .from("chat_sessions")
    .select("*")
    .eq("user_id", userId)
    .eq("status", "open")
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  if (existing) {
    return { ...(existing as ChatSession), user_name: null, user_email: null, last_message: null, unread_count: 0 };
  }

  const { data: created } = await supabase
    .from("chat_sessions")
    .insert({ user_id: userId, order_id: orderId ?? null, status: "open", last_message_at: new Date().toISOString() })
    .select()
    .single();

  return created
    ? { ...(created as ChatSession), user_name: null, user_email: null, last_message: null, unread_count: 0 }
    : null;
}

export async function fetchMessages(sessionId: string): Promise<ChatMessage[]> {
  const { data } = await supabase
    .from("chat_messages")
    .select("*")
    .eq("session_id", sessionId)
    .order("created_at", { ascending: true });
  return (data ?? []) as ChatMessage[];
}

export async function sendUserMessage(
  sessionId: string,
  userId:    string,
  text:      string,
): Promise<ChatMessage | null> {
  const [{ data: msg }] = await Promise.all([
    supabase.from("chat_messages").insert({
      session_id: sessionId, user_id: userId,
      message_text: text, message_type: "user", is_read: false,
    }).select().single(),
    supabase.from("chat_sessions")
      .update({ last_message_at: new Date().toISOString() })
      .eq("id", sessionId),
  ]);
  return msg as ChatMessage | null;
}

export async function markAdminMessagesRead(sessionId: string): Promise<void> {
  await supabase.from("chat_messages").update({ is_read: true })
    .eq("session_id", sessionId).eq("message_type", "admin").eq("is_read", false);
}

// ─── Admin ────────────────────────────────────────────────────────

export async function fetchAllSessions(): Promise<ChatSession[]> {
  const { data: rows } = await supabase
    .from("chat_sessions")
    .select("*, user:user_id(name, email)")
    .order("last_message_at", { ascending: false, nullsFirst: false });

  if (!rows?.length) return [];
  const sessionIds = rows.map((r) => r.id as string);

  const [{ data: unreadRows }, { data: msgRows }] = await Promise.all([
    supabase.from("chat_messages").select("session_id")
      .in("session_id", sessionIds).eq("message_type", "user").eq("is_read", false),
    supabase.from("chat_messages").select("session_id, message_text, message_type, created_at")
      .in("session_id", sessionIds).order("created_at", { ascending: false }),
  ]);

  const unreadBySession: Record<string, number> = {};
  unreadRows?.forEach((m) => { unreadBySession[m.session_id] = (unreadBySession[m.session_id] ?? 0) + 1; });

  const lastBySession: Record<string, string> = {};
  msgRows?.forEach((m) => {
    if (!lastBySession[m.session_id]) {
      const prefix = m.message_type === "admin" ? "You: " : "";
      lastBySession[m.session_id] = prefix + m.message_text;
    }
  });

  return rows.map((row) => {
    const user = row.user as { name?: string; email?: string } | null;
    const { user: _u, ...rest } = row;
    return {
      ...(rest as unknown as ChatSession),
      user_name:    user?.name    ?? null,
      user_email:   user?.email   ?? null,
      last_message: lastBySession[rest.id as string] ?? null,
      unread_count: unreadBySession[rest.id as string] ?? 0,
    };
  });
}

export async function sendAdminMessage(sessionId: string, adminId: string, text: string): Promise<void> {
  await Promise.all([
    supabase.from("chat_messages").insert({
      session_id: sessionId, admin_id: adminId,
      message_text: text, message_type: "admin", is_read: false,
    }),
    supabase.from("chat_sessions").update({ last_message_at: new Date().toISOString() }).eq("id", sessionId),
  ]);
}

export async function markUserMessagesRead(sessionId: string): Promise<void> {
  await supabase.from("chat_messages").update({ is_read: true })
    .eq("session_id", sessionId).eq("message_type", "user").eq("is_read", false);
}

export async function resolveSession(sessionId: string): Promise<void> {
  await supabase.from("chat_sessions").update({ status: "resolved" }).eq("id", sessionId);
}

export async function getAdminUnreadTotal(): Promise<number> {
  const { count } = await supabase.from("chat_messages")
    .select("id", { count: "exact", head: true })
    .eq("message_type", "user").eq("is_read", false);
  return count ?? 0;
}
