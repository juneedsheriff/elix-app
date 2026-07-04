export type RequestMessageSenderRole = 'patient' | 'pse' | 'system';

export type RequestMessage = {
  id: string;
  request_id: string;
  sender_role: RequestMessageSenderRole;
  sender_auth_user_id: string;
  sender_staff_id: string | null;
  body: string;
  created_at: string;
};
