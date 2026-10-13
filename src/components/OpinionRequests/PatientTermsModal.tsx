import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import './patient-case-details-form.css';

type PatientTermsModalProps = {
  open: boolean;
  onClose: () => void;
  onAgree?: () => void;
};

export default function PatientTermsModal({ open, onClose, onAgree }: PatientTermsModalProps) {
  useEffect(() => {
    if (!open) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open, onClose]);

  if (!open || typeof document === 'undefined') return null;

  return createPortal(
    <div className='patient-terms-modal-root' role='presentation'>
      <button type='button' className='patient-terms-modal-backdrop' onClick={onClose} aria-label='Close terms and conditions' />
      <div
        className='patient-terms-modal'
        role='dialog'
        aria-modal='true'
        aria-labelledby='patient-terms-modal-title'
      >
        <div className='patient-terms-modal__head'>
          <div>
            <p className='patient-terms-modal__brand'>ELIXCLINIX</p>
            <p className='patient-terms-modal__unit'>(A unit of Datalifehealth Services Pvt. Ltd.)</p>
            <h2 id='patient-terms-modal-title'>Terms &amp; Conditions and Disclaimers</h2>
          </div>
          <button type='button' className='icon-btn' onClick={onClose} aria-label='Close'>
            <X size={20} aria-hidden />
          </button>
        </div>

        <div className='patient-terms-modal__body'>
          <h3>Patient Terms &amp; Conditions</h3>
          <p className='patient-terms-modal__kicker'>For Patient/Customer Login</p>
          <p>
            These Terms &amp; Conditions (“Patient Terms”) govern your access to and use of the ElixClinix
            application, website, online consultation facility and healthcare coordination services. By
            registering, logging in, requesting a service, booking a consultation, uploading records, making a
            payment, or otherwise using the platform, you acknowledge that you have read and accepted these
            Terms and the applicable Privacy/Data Notice.
          </p>

          <h4>1. Services Available</h4>
          <p>
            Subject to availability, location, eligibility and applicable charges, ElixClinix may facilitate or
            provide access to services including:
          </p>
          <ul>
            <li>Doctor video consultation / online consultation with available doctors or specialists.</li>
            <li>Second-opinion services.</li>
            <li>Physiotherapy and rehabilitation services, including home-based services where offered.</li>
            <li>Online upload, storage and access to present and previous medical records through the app.</li>
            <li>Home sample collection and coordination of diagnostic services.</li>
            <li>Parent Care services, including proactive/regular checkups and support for geriatric and diabetic care.</li>
            <li>Surgery referral and assistance in identifying suitable surgeons/hospitals.</li>
            <li>Post-surgery care, follow-up support and medication assistance where offered.</li>
            <li>
              Home nursing services, including skilled nursing care, IV-related services, wound care and minor
              procedures, subject to clinical assessment and service availability.
            </li>
          </ul>

          <h4>2. Patient Eligibility, Registration and Account</h4>
          <ul>
            <li>
              You must provide accurate, complete and current information, including your name, age, contact
              details and relevant medical information.
            </li>
            <li>
              You must not create an account using another person’s identity or allow another person to use your
              login credentials.
            </li>
            <li>
              You are responsible for keeping your password and account access secure and for notifying
              ElixClinix promptly of suspected unauthorised access.
            </li>
            <li>
              For a minor, consultation and relevant services must be undertaken with the consent and involvement
              of a parent, adult sibling or legally appointed guardian, as applicable.
            </li>
            <li>
              ElixClinix may request additional identity or clinical information where reasonably required for
              safe service delivery.
            </li>
          </ul>

          <h4>3. Online Consultation and Patient Consent</h4>
          <ul>
            <li>
              An online consultation is a professional medical consultation delivered through an electronic
              communication method and is subject to the inherent limitations of telemedicine.
            </li>
            <li>
              Where the patient initiates the consultation, the act of requesting the consultation may constitute
              consent to the consultation; where required, ElixClinix Patient Service Executive (PSE) or the
              doctor may obtain explicit consent through the app or another appropriate method.
            </li>
            <li>
              The patient must provide truthful and sufficient information about symptoms, medical history,
              medications, allergies, investigations and other relevant matters.
            </li>
            <li>
              The patient understands that the doctor may determine that an online consultation is unsuitable or
              insufficient and may recommend video consultation, physical examination, another healthcare
              professional, diagnostic testing, emergency care or an in-person consultation.
            </li>
            <li>
              The patient should remain in a private and appropriate environment and should not make unauthorised
              recordings or permit unauthorised persons to participate in the consultation.
            </li>
          </ul>

          <h4>4. Medical Records and Uploaded Information</h4>
          <ul>
            <li>
              Patients may upload medical reports, prescriptions, images, diagnostic results and other health
              information for consultation or service coordination.
            </li>
            <li>
              The patient is responsible for ensuring that uploaded information is accurate and belongs to the
              patient or that the patient has lawful authority to provide it.
            </li>
            <li>
              ElixClinix may process and share relevant information with the doctor, healthcare professional,
              diagnostic provider, hospital or other service provider to the extent necessary to provide the
              requested service and as permitted by applicable law and the applicable privacy notice.
            </li>
            <li>
              Patients should review the Privacy/Data Notice for details on collection, use, sharing, retention,
              security, rights and grievance mechanisms.
            </li>
          </ul>

          <h4>5. Prescription, Diagnosis and Treatment</h4>
          <ul>
            <li>
              A doctor’s diagnosis, advice, treatment recommendation or prescription is based on the information
              available during the consultation and the doctor’s independent professional judgment.
            </li>
            <li>
              A doctor may decline to prescribe medicines, may request additional information/tests, or may advise
              an in-person examination.
            </li>
            <li>
              Not every condition can be safely assessed or treated remotely. Telemedicine does not eliminate the
              need for physical examination, diagnostic testing or emergency evaluation where clinically indicated.
            </li>
            <li>
              A prescription issued through the platform remains the responsibility of the prescribing Registered
              Medical Practitioner (RMP), subject to applicable law and professional standards.
            </li>
          </ul>

          <h4>6. Emergencies – Important</h4>
          <p>
            ElixClinix online consultation is not intended to replace emergency medical services. If you have
            severe chest pain, difficulty breathing, loss of consciousness, severe bleeding, suspected stroke,
            seizures, severe allergic reaction, suicidal/self-harm risk, or any other potentially life-threatening
            condition, seek immediate emergency medical care or contact the appropriate local emergency service.
            Do not wait for an online consultation or app response.
          </p>

          <h4>7. Appointment, Cancellation, Rescheduling and Refunds</h4>
          <ul>
            <li>Appointments are subject to doctor/service availability and successful booking/payment where applicable.</li>
            <li>
              A consultation may be delayed, rescheduled or cancelled because of doctor availability, technical
              issues, connectivity problems, clinical suitability or other operational reasons.
            </li>
            <li>
              Any refund, cancellation or rescheduling entitlement will be governed by the specific
              cancellation/refund policy displayed in the app at the time of booking.
            </li>
            <li>Where a service is partially or fully delivered, eligibility for refund may depend on the applicable service terms.</li>
          </ul>

          <h4>8. Fees and Additional Charges</h4>
          <ul>
            <li>
              Applicable consultation/service fees will be displayed or communicated before booking or payment,
              where practicable.
            </li>
            <li>
              Hospital, diagnostic, medicine, procedure, travel, home-visit or third-party charges, where
              applicable, may be separate from the ElixClinix platform/service fee.
            </li>
          </ul>

          <h4>9. Third-Party Providers and Hospitals</h4>
          <p>
            ElixClinix may coordinate with or facilitate access to doctors, hospitals, laboratories,
            physiotherapists, nurses, surgeons and other healthcare/service providers. Unless expressly stated
            otherwise, each healthcare professional remains responsible for their professional clinical decisions
            and services.
          </p>

          <h4>10. Technology and Connectivity Disclaimer</h4>
          <ul>
            <li>
              The quality and continuity of a consultation may depend on internet connectivity, device
              performance, audio/video quality and other technical factors.
            </li>
            <li>ElixClinix does not guarantee uninterrupted, error-free or continuously available access to the platform.</li>
            <li>
              Technical interruptions may require a consultation to be resumed, rescheduled or converted to
              another mode of communication.
            </li>
          </ul>

          <h4>11. Prohibited Use</h4>
          <ul>
            <li>Providing false, misleading or fraudulent information.</li>
            <li>Impersonating another patient or person.</li>
            <li>Harassing, threatening or abusing doctors, nurses, support personnel or other users.</li>
            <li>Using the platform to obtain medicines, prescriptions, reports or services for an unlawful purpose.</li>
            <li>Attempting to gain unauthorised access to the app, another person’s account or medical information.</li>
            <li>Copying, scraping, commercially exploiting or interfering with the platform or its content without authorisation.</li>
          </ul>

          <h4>12. Limitation of Platform Responsibility &amp; Liability</h4>
          <p>
            To the extent permitted by applicable law, ElixClinix’s role as a digital platform/service coordinator
            does not replace the independent professional judgment of a doctor or other healthcare professional.
            Nothing in these Terms is intended to exclude liability that cannot lawfully be excluded. However, in
            any event the liability is limited to the fees/charges paid to ElixClinix. ElixClinix is only a
            service enabler.
          </p>

          <h4>13. Complaints and Grievances</h4>
          <p>
            Patients may raise service, technical or billing complaints through the support/grievance channel to{' '}
            <a href='mailto:support@elixclinix.com'>support@elixclinix.com</a> or call on{' '}
            <a href='tel:+919449894498'>94498-94498</a> and we would respond at the earliest possible within 4
            working days Monday through Friday.
          </p>

          <h4>14. Governing Law</h4>
          <p>
            These Terms shall be governed by the laws applicable in India, subject to applicable consumer,
            healthcare, data-protection and other mandatory laws.
          </p>

          <h4>15. Patient Acknowledgement</h4>
          <p>
            I have read and agree to the ElixClinix (Datalifehealth Services Pvt. Ltd.) Patient Terms &amp;
            Conditions and applicable Privacy/Data Notice. I understand that online consultation has clinical
            limitations and that I may be advised to seek in-person or emergency medical care.
          </p>

          <h3>Patient Disclaimer</h3>
          <p>
            ElixClinix (A unit of Datalifehealth Services Pvt. Ltd.) is a healthcare technology and
            service-coordination platform. Online consultation is provided by an appropriately
            qualified/registered healthcare professional, subject to applicable law and professional standards.
            The platform cannot guarantee a particular diagnosis, treatment outcome or recovery.
          </p>
          <ul>
            <li>
              Teleconsultation may not be suitable for every condition and cannot always substitute for physical
              examination or emergency care.
            </li>
            <li>
              Medical advice is based on the information available to the healthcare professional at the time of
              consultation. Patients must provide complete and accurate information.
            </li>
            <li>
              Where clinically necessary, the doctor may recommend diagnostic tests, physical examination,
              hospitalisation, emergency care or an in-person consultation.
            </li>
            <li>Do not use the online consultation service for medical emergencies.</li>
            <li>ElixClinix does not guarantee uninterrupted availability of the app or communication network.</li>
            <li>
              Any third-party healthcare provider remains professionally responsible for the clinical service
              delivered by that provider and not by ElixClinix.
            </li>
          </ul>
        </div>

        <div className='patient-terms-modal__footer'>
          {onAgree ? (
            <button type='button' className='primary-btn' onClick={onAgree}>
              I agree
            </button>
          ) : (
            <button type='button' className='secondary-btn' onClick={onClose}>
              Close
            </button>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}
