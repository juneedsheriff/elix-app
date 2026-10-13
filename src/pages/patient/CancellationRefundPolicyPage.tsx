import './cancellation-refund-policy.css';

const CANCELLATION_COLUMNS = [
  'Service',
  'Cancelled early',
  'Cancelled late',
  'After service has started (Less than 24 hrs)'
] as const;

const CANCELLATION_ROWS = [
  [
    'Doctor video / online consultation',
    '100% refund if cancelled [48 hours] or more before the slot',
    '[50%] refund if cancelled within [24 hours]',
    'No refund'
  ],
  [
    'Second-opinion service',
    '100% refund before the doctor has reviewed the records',
    'No refund once review has started',
    'No refund'
  ],
  [
    'Physiotherapy and rehabilitation (clinic or home)',
    '100% refund if cancelled [48 hours] or more before the session',
    '[50%] refund within [24 hours]',
    'Unused sessions in a pack refunded as per Section 7'
  ],
  [
    'Home sample collection',
    '100% refund if cancelled before a phlebotomist is assigned',
    'Collection fee not refundable once the phlebotomist is on the way',
    'No refund once the sample is collected'
  ],
  [
    'Parent Care checkups and plans',
    '100% refund if cancelled [48 hours] or more before the first scheduled visit',
    '[50%] refund within [24 hours]',
    'Unused portion refunded as per Section 7'
  ],
  [
    'Home nursing (skilled nursing, IV, wound care, minor procedures)',
    '100% refund if cancelled [48 hours] or more before the visit',
    '[50%] refund within [24 hours]',
    'No refund for the visit; unused days in a multi-day booking as per Section 7'
  ],
  [
    'Surgery referral, post-surgery care and medication assistance',
    '100% refund before a coordinator has been assigned',
    'Fee not refundable once coordination has begun',
    'As per Section 7'
  ]
] as const;

const REFUND_TIMELINE_ROWS = [
  ['Acknowledgement of the request', 'Within [2 working days]'],
  ['Decision on eligibility', 'Within [5 working days] of the request'],
  ['Refund initiated after approval', 'Within [7 working days]'],
  [
    "Credit to the patient's account",
    'Typically [5 to 10 working days] after initiation, depending on the bank or payment provider'
  ]
] as const;

export default function CancellationRefundPolicyPage() {
  return (
    <article className='policy-page'>
      <header className='policy-page__intro'>
        <p className='policy-page__brand'>ElixClinix</p>
        <p className='policy-page__unit'>A unit of Datalifehealth Services Pvt. Ltd.</p>
        <h2 className='policy-page__title'>Cancellation &amp; Refund Policy</h2>
        <p>
          This policy explains when a patient can cancel or reschedule an ElixClinix booking, and when
          ElixClinix will refund the amount paid. It is the specific policy that Section 7 of the Patient
          Terms &amp; Conditions refers to, and it applies to every paid service listed in Section 1 of those
          Terms. Bracketed items [●] are business decisions to be confirmed before publication.
        </p>
      </header>

      <section>
        <h3>1. Scope and Priority</h3>
        <p>
          This policy applies to bookings made through the ElixClinix (Datalifehealth Services Pvt. Ltd.)
          app, website or Patient Service Executive (PSE).
        </p>
        <p>
          It supplements the Patient Terms &amp; Conditions. If a booking screen shows a different window or
          fee for a specific service or package, the booking screen applies for that booking.
        </p>
        <p>
          Refunds cover ElixClinix platform and service fees only. Charges collected by hospitals,
          laboratories, pharmacies or other third parties are covered in Section 9.
        </p>
      </section>

      <section>
        <h3>2. Cancellation by the Patient</h3>
        <p>
          A patient may cancel from the app or by contacting support. The cancellation time is the time the
          request is received, not the time of the appointment. Refunds follow the windows below.
        </p>
        <div className='policy-page__table-wrap policy-page__table-wrap--cancellation'>
          <table className='policy-page__table policy-page__table--cancellation'>
            <thead>
              <tr>
                {CANCELLATION_COLUMNS.map((column) => (
                  <th key={column} scope='col'>
                    {column}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {CANCELLATION_ROWS.map((row) => (
                <tr key={row[0]}>
                  {row.map((cell, index) => (
                    <td key={CANCELLATION_COLUMNS[index]} data-label={CANCELLATION_COLUMNS[index]}>
                      {cell}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <h3>3. Rescheduling</h3>
        <p>
          A patient can reschedule a booking free of charge, subject to doctor and service availability, if
          the request is made within the early-cancellation window in Section 2. A booking can be rescheduled
          [once] without a fee; further changes are treated as a cancellation and a new booking. Rescheduling
          is not guaranteed if the chosen doctor, therapist or nurse has no suitable slot, in which case the
          patient may choose another slot, another provider or a refund.
        </p>
      </section>

      <section>
        <h3>4. Cancellation or Change by ElixClinix or the Provider</h3>
        <p>
          If ElixClinix, the doctor or another service provider cancels or cannot deliver a booking, the
          patient may choose a free reschedule or a 100% refund of the fee paid for that booking. This applies
          where the cause is:
        </p>
        <ul>
          <li>doctor, therapist, nurse or phlebotomist unavailability;</li>
          <li>an operational or scheduling reason on our side;</li>
          <li>a service not being available at the patient&apos;s location; or</li>
          <li>the provider determining the booking cannot be safely delivered as requested.</li>
        </ul>
        <p>We will tell the patient as early as practicable by app notification, SMS, call or email.</p>
      </section>

      <section>
        <h3>5. Technical Issues and Clinical Suitability</h3>
        <p>
          <strong>Technical failure.</strong> If a consultation cannot start or cannot be completed because of
          an ElixClinix platform failure, the patient may resume it, reschedule it, convert it to another mode
          of communication, or receive a refund for the part not delivered.
        </p>
        <p>
          <strong>Patient-side connectivity.</strong> If the interruption is caused by the patient&apos;s own
          internet, device or audio/video settings and the doctor has made reasonable attempts to continue, the
          consultation is treated as delivered. We will still offer one reconnection attempt within the same
          slot where practicable.
        </p>
        <p>
          <strong>Clinical unsuitability.</strong> If the doctor decides that an online consultation is
          unsuitable or insufficient and advises an in-person visit, diagnostic test or emergency care, the
          patient will receive [a full refund if no meaningful advice was given / a refund of the unused
          portion], as decided by ElixClinix after reviewing the consultation. A consultation in which the
          doctor gave an assessment and advice is treated as delivered.
        </p>
      </section>

      <section>
        <h3>6. Missed Appointments (No-Shows)</h3>
        <p>
          If the patient does not join a consultation within [10 minutes] of the scheduled start, or is not
          available at the address for a home service within [20 minutes] of the arrival window, the booking
          is treated as a no-show and is not refundable.
        </p>
        <p>
          If the doctor or provider does not join within [15 minutes] of the scheduled start, the patient may
          reschedule free of charge or receive a 100% refund however in case the doctor is engaged on
          emergency treatment it may extend to 1 hour.
        </p>
        <p>
          A patient who could not attend because of a documented emergency may write to support within [48
          hours] and ElixClinix will consider a reschedule or credit at its discretion.
        </p>
      </section>

      <section>
        <h3>7. Partially Delivered Services and Packages</h3>
        <p>
          For packs, plans and multi-visit bookings (physiotherapy packs, Parent Care plans, multi-day
          nursing, post-surgery follow-up), the refund is calculated as follows:
        </p>
        <ol>
          <li>Take the total amount paid for the pack or plan.</li>
          <li>
            Deduct the value of services already delivered, at the standard single-visit price (not the
            discounted pack price).
          </li>
          <li>Deduct any scheduled visit that falls inside the late-cancellation window in Section 2.</li>
          <li>Deduct any discount, offer or free service that was conditional on completing the full pack.</li>
          <li>Refund the balance, if any.</li>
        </ol>
        <p>A pack or plan that has passed its validity period [90 days] is not refundable.</p>
      </section>

      <section>
        <h3>8. Non-Refundable Items</h3>
        <ul>
          <li>
            Consultations, sessions or visits that were delivered, including where the patient did not follow
            the advice or disagrees with the diagnosis or outcome.
          </li>
          <li>No-shows and late cancellations beyond the refund percentages in Section 2.</li>
          <li>
            Platform convenience fees and payment-gateway charges, unless the cancellation is by ElixClinix
            or caused by a platform failure.
          </li>
          <li>
            Bookings cancelled because the patient gave false, incomplete or misleading information, or
            breached the Prohibited Use clause of the Patient Terms.
          </li>
          <li>Promotional credits, wallet cashback and coupon value, which are not redeemable for cash.</li>
        </ul>
        <p>
          The platform does not guarantee any diagnosis, treatment outcome or recovery, so dissatisfaction
          with an outcome is not by itself a ground for refund.
        </p>
      </section>

      <section>
        <h3>9. Third-Party Charges</h3>
        <p>
          Hospital, diagnostic, laboratory, medicine, procedure, travel and other third-party charges are
          separate from the ElixClinix fee. ElixClinix does not control the refund terms of third parties;
          those are governed by the third party&apos;s own policy. Where ElixClinix collected the amount on
          the provider&apos;s behalf and the service was not delivered, we will pursue the refund with the
          provider and pass it to the patient once received. A booking made directly with a hospital or
          laboratory is refunded by that provider.
        </p>
      </section>

      <section>
        <h3>10. How to Request a Cancellation or Refund</h3>
        <ol>
          <li>Open the booking in the app and select Cancel or Reschedule; or</li>
          <li>
            email <a href='mailto:support@elixclinix.com'>support@elixclinix.com</a> or call{' '}
            <a href='tel:+919449894498'>94498-94498</a>, giving the booking ID, registered mobile number and
            reason.
          </li>
        </ol>
        <p>
          A refund request for a delivered or partly delivered service must be raised within [7 days] of the
          service date, with any supporting details.
        </p>
      </section>

      <section>
        <h3>11. Refund Timelines and Mode</h3>
        <div className='policy-page__table-wrap'>
          <table className='policy-page__table'>
            <thead>
              <tr>
                <th scope='col'>Step</th>
                <th scope='col'>Timeline</th>
              </tr>
            </thead>
            <tbody>
              {REFUND_TIMELINE_ROWS.map((row) => (
                <tr key={row[0]}>
                  <th scope='row'>{row[0]}</th>
                  <td>{row[1]}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p>
          Refunds are made to the original payment method. A refund to a wallet or account credit is made
          only if the patient asks for it or the original method is unavailable.
        </p>
        <p>
          Cash payments are refunded by bank transfer to an account in the patient&apos;s own name, after
          verification.
        </p>
        <p>Where a refund is partial, ElixClinix will state the amount and the deductions made.</p>
      </section>

      <section>
        <h3>12. Misuse and Disputes</h3>
        <p>
          ElixClinix may decline or reverse a refund where there is evidence of fraud, repeated cancellation
          after service delivery, impersonation or misuse of promotions. A patient who raises a chargeback
          with their bank for a delivered service should first contact support, so the matter can be resolved
          quickly. Where a chargeback is raised for a service that was delivered, ElixClinix may share the
          booking and delivery record with the bank or payment provider as needed to contest it.
        </p>
        <p>
          In case the administrator finds the information uploaded is irrelevant ElixClinix will inform the
          patient to delete the document and again if not deleted ElixClinix will automatically delete the
        </p>
      </section>

      <section>
        <h3>13. Complaints and Escalation</h3>
        <p>
          A patient who disagrees with a refund decision may write to{' '}
          <a href='mailto:support@elixclinix.com'>support@elixclinix.com</a> or call{' '}
          <a href='tel:+919449894498'>94498-94498</a>, quoting the booking ID. We will respond at the earliest
          possible and aim to resolve the complaint within [15 days]. The patient&apos;s statutory rights
          under applicable consumer-protection law are not affected by this policy.
        </p>
      </section>

      <section>
        <h3>14. Changes and Governing Law</h3>
        <p>
          ElixClinix may update this policy from time to time. The version displayed in the app at the time of
          booking applies to that booking, and changes do not affect bookings already made. This policy is
          governed by the laws applicable in India, subject to applicable consumer, healthcare,
          data-protection and other mandatory laws, consistent with the Patient Terms &amp; Conditions.
        </p>
      </section>
    </article>
  );
}
