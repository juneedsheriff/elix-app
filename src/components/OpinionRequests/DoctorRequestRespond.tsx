import { useState, type FormEvent } from 'react';
import { Loader2, MessageSquare } from 'lucide-react';
import { submitDoctorOpinionResponse } from '../../lib/opinionRequests';
import type { OpinionRequest } from '../../types/opinionRequest';

type DoctorRequestRespondProps = {
  request: OpinionRequest;
  onResponded: () => void;
  onError: (message: string) => void;
};

export default function DoctorRequestRespond({ request, onResponded, onError }: DoctorRequestRespondProps) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(request.doctor_response ?? '');
  const [submitting, setSubmitting] = useState(false);

  const hasResponse = Boolean(request.doctor_response?.trim());

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setSubmitting(true);
    const { error } = await submitDoctorOpinionResponse(request.id, draft);
    setSubmitting(false);

    if (error) {
      onError(error.message);
      return;
    }

    setOpen(false);
    onResponded();
  };

  return (
    <div className='doctor-request-respond'>
      {hasResponse ? (
        <div className='doctor-response-block' role='region' aria-label='Your response to patient'>
          <h5>Your response</h5>
          <p>{request.doctor_response}</p>
          {request.responded_at ? (
            <span className='muted'>Sent {new Date(request.responded_at).toLocaleString()}</span>
          ) : null}
        </div>
      ) : null}

      {!open ? (
        <button
          type='button'
          className='primary-btn doctor-respond-cta'
          onClick={() => {
            setDraft(request.doctor_response ?? '');
            setOpen(true);
          }}
        >
          <MessageSquare size={18} aria-hidden />
          {hasResponse ? 'Update response' : 'Respond to patient'}
        </button>
      ) : (
        <form className='doctor-respond-form' onSubmit={(e) => void handleSubmit(e)}>
          <label className='doctor-respond-label'>
            Your second opinion for {request.patient_name ?? 'the patient'}
            <textarea
              className='doctor-respond-textarea'
              rows={6}
              placeholder='Summarize your clinical assessment, recommendations, and next steps for the patient…'
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              required
              aria-required='true'
              disabled={submitting}
            />
          </label>
          <div className='doctor-respond-actions'>
            <button type='submit' className='primary-btn' disabled={submitting || !draft.trim()}>
              {submitting ? (
                <>
                  <Loader2 size={16} className='spin' aria-hidden /> Sending…
                </>
              ) : (
                'Send response to patient'
              )}
            </button>
            <button type='button' className='secondary-btn' disabled={submitting} onClick={() => setOpen(false)}>
              Cancel
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
