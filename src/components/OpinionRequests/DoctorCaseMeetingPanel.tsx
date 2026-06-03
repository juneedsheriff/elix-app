import { Calendar, Video } from 'lucide-react';
import type { OpinionRequest } from '../../types/opinionRequest';

type DoctorCaseMeetingPanelProps = {
  request: OpinionRequest;
};

function isGoogleMeetLink(url: string): boolean {
  return /meet\.google\.com/i.test(url);
}

export default function DoctorCaseMeetingPanel({ request }: DoctorCaseMeetingPanelProps) {
  const meetingLink = request.meeting_link?.trim();
  if (!meetingLink) return null;

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

      <a
        href={meetingLink}
        target='_blank'
        rel='noreferrer'
        className='primary-btn case-review-meeting-panel__join'
      >
        <Video size={16} aria-hidden />
        {joinLabel}
      </a>

      <a
        href={meetingLink}
        target='_blank'
        rel='noreferrer'
        className='case-review-meeting-panel__url'
      >
        {meetingLink}
      </a>
    </div>
  );
}
