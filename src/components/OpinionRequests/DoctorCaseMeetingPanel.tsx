import { Calendar, Video } from 'lucide-react';
import {
  canJoinConsultationMeeting,
  formatConsultationJoinCountdown,
  getMillisecondsUntilConsultationJoinOpens,
  hasActiveConsultationMeetingLink,
  isDoctorWorkspaceRequestCompleted
} from '../../lib/opinionRequests';
import type { OpinionRequest } from '../../types/opinionRequest';
import { useEffect, useState } from 'react';

type DoctorCaseMeetingPanelProps = {
  request: OpinionRequest;
};

function isGoogleMeetLink(url: string): boolean {
  return /meet\.google\.com/i.test(url);
}

export default function DoctorCaseMeetingPanel({ request }: DoctorCaseMeetingPanelProps) {
  const meetingLink = request.meeting_link?.trim();
  const [nowTick, setNowTick] = useState(() => Date.now());
  const hasLink = Boolean(meetingLink) && hasActiveConsultationMeetingLink(request);
  const showJoin = canJoinConsultationMeeting(request, nowTick);
  const joinOpensInMs = getMillisecondsUntilConsultationJoinOpens(request.scheduled_at, nowTick);

  useEffect(() => {
    if (!hasLink || showJoin || !request.scheduled_at) return;
    setNowTick(Date.now());
    const intervalId = window.setInterval(() => setNowTick(Date.now()), 1000);
    return () => window.clearInterval(intervalId);
  }, [hasLink, showJoin, request.scheduled_at]);

  if (!meetingLink || isDoctorWorkspaceRequestCompleted(request)) return null;

  const joinLabel = isGoogleMeetLink(meetingLink) ? 'Join Google Meet' : 'Join meeting';

  return (
    <div className='case-review-meeting-panel' role='region' aria-label='Consultation meeting'>
      <div className='case-review-meeting-panel__head'>
        <Video size={18} aria-hidden />
        <strong>Video consultation</strong>
      </div>

      {request.scheduled_at ? (
        <p className='case-review-meeting-panel__when'>
          <Calendar size={15} aria-hidden />
          <span>{new Date(request.scheduled_at).toLocaleString()}</span>
        </p>
      ) : null}

      {showJoin ? (
        <a
          href={meetingLink}
          target='_blank'
          rel='noreferrer'
          className='primary-btn case-review-meeting-panel__join'
        >
          <Video size={16} aria-hidden />
          {joinLabel}
        </a>
      ) : (
        <div className='case-review-meeting-panel__join-wrap'>
          <button type='button' className='primary-btn case-review-meeting-panel__join' disabled>
            <Video size={16} aria-hidden />
            {joinLabel}
          </button>
          <p className='case-review-meeting-panel__countdown' aria-live='polite'>
            {joinOpensInMs !== null && joinOpensInMs > 0
              ? `Join opens in ${formatConsultationJoinCountdown(joinOpensInMs)}`
              : 'Join opens 10 minutes before the appointment'}
          </p>
        </div>
      )}
    </div>
  );
}
