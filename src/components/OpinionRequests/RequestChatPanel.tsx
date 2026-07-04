import { useEffect, useMemo, useRef, useState } from 'react';
import { Loader2, SendHorizontal } from 'lucide-react';
import {
  fetchRequestMessages,
  sendRequestMessage,
  subscribeRequestMessages
} from '../../lib/requestMessages';
import type { OpinionRequest } from '../../types/opinionRequest';
import type { RequestMessage } from '../../types/requestMessage';
import './request-chat-panel.css';

type RequestChatPanelProps = {
  request: OpinionRequest;
  viewerRole: 'patient' | 'pse';
  senderStaffId?: string | null;
  disabled?: boolean;
  disabledReason?: string | null;
  onError?: (message: string) => void;
};

function formatMessageTime(iso: string) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

export default function RequestChatPanel({
  request,
  viewerRole,
  senderStaffId = null,
  disabled = false,
  disabledReason = null,
  onError
}: RequestChatPanelProps) {
  const [messages, setMessages] = useState<RequestMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [composer, setComposer] = useState('');
  const [error, setError] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    setMessages([]);

    void fetchRequestMessages(request.id).then((result) => {
      if (cancelled) return;
      setLoading(false);
      if (result.error) {
        setError(result.error.message);
        return;
      }
      setMessages(result.data ?? []);
    });

    return () => {
      cancelled = true;
    };
  }, [request.id]);

  useEffect(() => {
    return subscribeRequestMessages(request.id, (message) => {
      setMessages((current) => {
        if (current.some((item) => item.id === message.id)) return current;
        return [...current, message];
      });
    });
  }, [request.id]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages, loading, sending]);

  const senderLabel = useMemo(() => {
    return {
      patient: request.patient_name?.trim() || 'Patient',
      pse: request.assigned_to_name?.trim() || 'PSE coordinator',
      system: 'System'
    } as const;
  }, [request.assigned_to_name, request.patient_name]);

  const submit = async () => {
    const text = composer.trim();
    if (!text || disabled || sending) return;

    setSending(true);
    const { data, error: sendError } = await sendRequestMessage(request.id, {
      senderRole: viewerRole,
      senderStaffId,
      body: text
    });
    setSending(false);

    if (sendError) {
      setError(sendError.message);
      onError?.(sendError.message);
      return;
    }

    setComposer('');
    setError(null);
    if (data) {
      setMessages((current) => (current.some((msg) => msg.id === data.id) ? current : [...current, data]));
    }
  };

  return (
    <section className='request-chat-panel' aria-label='Request chat'>
      <header className='request-chat-panel__head'>
        <div>
          <h4 className='request-chat-panel__title'>Request chat</h4>
          <p className='request-chat-panel__subtitle'>Messages between patient and assigned coordinator.</p>
        </div>
      </header>

      {error ? (
        <p className='request-chat-panel__alert request-chat-panel__alert--error' role='alert'>
          {error}
        </p>
      ) : null}

      {disabled && disabledReason ? (
        <p className='request-chat-panel__alert request-chat-panel__alert--muted'>{disabledReason}</p>
      ) : null}

      <div className='request-chat-panel__messages' aria-live='polite'>
        {loading ? (
          <p className='request-chat-panel__status'>
            <Loader2 size={15} className='spin' aria-hidden /> Loading chat…
          </p>
        ) : messages.length ? (
          messages.map((message) => {
            const mine = message.sender_role === viewerRole;
            const role = mine ? 'mine' : 'theirs';
            const showSender = !mine && message.sender_role !== 'system';
            return (
              <article
                key={message.id}
                className={`request-chat-panel__bubble request-chat-panel__bubble--${role}`}
              >
                {showSender ? (
                  <p className='request-chat-panel__sender'>{senderLabel[message.sender_role]}</p>
                ) : null}
                <p className='request-chat-panel__text'>{message.body}</p>
                <p className='request-chat-panel__meta'>
                  <span>{formatMessageTime(message.created_at)}</span>
                  {mine ? <span className='request-chat-panel__ticks'>✓✓</span> : null}
                </p>
              </article>
            );
          })
        ) : (
          <p className='request-chat-panel__status'>No messages yet. Start the conversation.</p>
        )}
        <div ref={endRef} />
      </div>

      <footer className='request-chat-panel__composer'>
        <textarea
          className='request-chat-panel__input'
          rows={2}
          value={composer}
          disabled={disabled || sending}
          placeholder='Type your message…'
          onChange={(event) => setComposer(event.currentTarget.value)}
        />
        <button
          type='button'
          className='request-chat-panel__send'
          onClick={() => void submit()}
          disabled={disabled || sending || !composer.trim()}
          aria-label={sending ? 'Sending message' : 'Send message'}
          title={sending ? 'Sending…' : 'Send'}
        >
          <SendHorizontal size={15} aria-hidden />
        </button>
      </footer>
    </section>
  );
}
