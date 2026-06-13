import { useCallback, useEffect, useState } from 'react';
import { Clock, Loader2, UserRound } from 'lucide-react';
import {
  fetchOpinionRequestAuditEvents,
  formatOpinionRequestAuditActorLabel,
  type OpinionRequestAuditEvent
} from '../../lib/opinionRequestAudit';

function formatAuditTimestamp(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
}

type OpinionRequestActivityTimelineProps = {
  requestId: string;
  refreshKey?: number;
};

export default function OpinionRequestActivityTimeline({
  requestId,
  refreshKey = 0
}: OpinionRequestActivityTimelineProps) {
  const [events, setEvents] = useState<OpinionRequestAuditEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadEvents = useCallback(async () => {
    setLoading(true);
    setError(null);
    const result = await fetchOpinionRequestAuditEvents(requestId);
    setLoading(false);
    if (result.error) {
      setEvents([]);
      setError(result.error.message);
      return;
    }
    setEvents(result.data ?? []);
  }, [requestId]);

  useEffect(() => {
    void loadEvents();
  }, [loadEvents, refreshKey]);

  if (loading) {
    return (
      <p className='pmr-audit-page__status' aria-live='polite'>
        <Loader2 size={18} className='spin' aria-hidden /> Loading activity…
      </p>
    );
  }

  if (error) {
    return (
      <p className='pmr-audit-page__error' role='alert'>
        {error}
      </p>
    );
  }

  if (!events.length) {
    return <p className='pmr-audit-page__empty'>No activity recorded yet for this request.</p>;
  }

  return (
    <ol className='pmr-audit-timeline' aria-label='Request activity timeline'>
      {events.map((event) => (
        <li key={event.id} className='pmr-audit-timeline__item'>
          <span className='pmr-audit-timeline__dot' aria-hidden />
          <div className='pmr-audit-timeline__card'>
            <p className='pmr-audit-timeline__summary'>{event.summary}</p>
            <div className='pmr-audit-timeline__meta'>
              <span className='pmr-audit-timeline__actor'>
                <UserRound size={13} aria-hidden />
                {formatOpinionRequestAuditActorLabel(event)}
              </span>
              <span className='pmr-audit-timeline__time'>
                <Clock size={13} aria-hidden />
                {formatAuditTimestamp(event.created_at)}
              </span>
            </div>
          </div>
        </li>
      ))}
    </ol>
  );
}
