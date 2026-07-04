import { supabase } from './supabase';
import type { RequestMessage, RequestMessageSenderRole } from '../types/requestMessage';

type RequestMessageRow = {
  id: string;
  request_id: string;
  sender_role: RequestMessageSenderRole;
  sender_auth_user_id: string;
  sender_staff_id: string | null;
  body: string;
  created_at: string;
};

function normalizeRequestMessagesError(error: { message?: string } | null | undefined): string {
  const raw = error?.message ?? 'Could not load request messages.';
  const lower = raw.toLowerCase();
  const missingTable =
    lower.includes('request_messages') &&
    (lower.includes('schema cache') ||
      lower.includes('does not exist') ||
      lower.includes('relation') ||
      lower.includes('pgrst'));

  if (!missingTable) return raw;

  return 'Request chat is not enabled in the database yet. Run `npm run db:apply-request-messages` or apply `supabase/migrations/069_request_messages.sql` in Supabase SQL Editor.';
}

function normalizeMessageRow(row: RequestMessageRow): RequestMessage {
  return {
    id: row.id,
    request_id: row.request_id,
    sender_role: row.sender_role,
    sender_auth_user_id: row.sender_auth_user_id,
    sender_staff_id: row.sender_staff_id,
    body: row.body,
    created_at: row.created_at
  };
}

export async function fetchRequestMessages(requestId: string) {
  const { data, error } = await supabase
    .from('request_messages')
    .select('id, request_id, sender_role, sender_auth_user_id, sender_staff_id, body, created_at')
    .eq('request_id', requestId)
    .order('created_at', { ascending: true });

  if (error) return { data: null, error: { message: normalizeRequestMessagesError(error) } };
  return {
    data: (data ?? []).map((row) => normalizeMessageRow(row as RequestMessageRow)),
    error: null
  };
}

export async function sendRequestMessage(
  requestId: string,
  input: {
    senderRole: RequestMessageSenderRole;
    body: string;
    senderStaffId?: string | null;
  }
) {
  const body = input.body.trim();
  if (!body) {
    return { data: null, error: { message: 'Write a message before sending.' } };
  }

  const payload = {
    request_id: requestId,
    sender_role: input.senderRole,
    sender_staff_id: input.senderStaffId ?? null,
    body
  };

  const { data, error } = await supabase
    .from('request_messages')
    .insert(payload)
    .select('id, request_id, sender_role, sender_auth_user_id, sender_staff_id, body, created_at')
    .single();

  if (error) return { data: null, error: { message: normalizeRequestMessagesError(error) } };
  return { data: normalizeMessageRow(data as RequestMessageRow), error: null };
}

export function subscribeRequestMessages(
  requestId: string,
  onInsert: (message: RequestMessage) => void
): () => void {
  const channel = supabase
    .channel(`request-messages:${requestId}`)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'request_messages',
        filter: `request_id=eq.${requestId}`
      },
      (payload) => {
        const row = payload.new as RequestMessageRow | undefined;
        if (!row?.id) return;
        onInsert(normalizeMessageRow(row));
      }
    )
    .subscribe();

  return () => {
    void supabase.removeChannel(channel);
  };
}
