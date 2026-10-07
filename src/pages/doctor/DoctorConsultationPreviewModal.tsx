import { useEffect, useState } from 'react';
import { Eye, Loader2, X } from 'lucide-react';
import ReactPdfDocumentViewer from '../../components/common/ReactPdfDocumentViewer';
import {
  consultationSummaryPdfMetaFromRequest,
  generateConsultationSummaryPdfBlob
} from '../../lib/consultationSummaryPdf';
import {
  generateLabOrderPdfBlob,
  generateLabOrderPdfFromUploadBlob,
  generatePrescriptionOrderPdfBlob,
  generatePrescriptionOrderPdfFromUploadBlob
} from '../../lib/consultationOrdersPdf';
import type { ConsultationSummaryFormValues } from '../../lib/consultationSummaryFields';
import { isImageFileName } from '../../lib/imageFiles';
import { getMedicalRecordDownloadUrl } from '../../lib/records';
import type { Doctor } from '../../types/doctor';
import type { ConsultationSummary, OpinionRequest } from '../../types/opinionRequest';
import './doctor-consultation-preview-modal.css';

type OrderEntryMode = 'type' | 'upload';
type PreviewMode = 'fill' | 'upload';

type PreviewDoc = {
  id: string;
  label: string;
  url: string;
  kind: 'pdf' | 'image' | 'file';
  fileName?: string;
};

type DoctorConsultationPreviewModalProps = {
  open: boolean;
  onClose: () => void;
  mode: PreviewMode;
  request: OpinionRequest;
  doctor: Doctor | null;
  values: ConsultationSummaryFormValues;
  prescriptionEntryMode: OrderEntryMode;
  labOrderEntryMode: OrderEntryMode;
  prescriptionFile: File | null;
  labOrderFile: File | null;
  existingPrescriptionPath?: string | null;
  existingPrescriptionName?: string | null;
  existingLabOrderPath?: string | null;
  existingLabOrderName?: string | null;
  uploadFile: File | null;
  uploadNote: string;
};

function uploadedPlaceholder(fileName: string | null | undefined): string | null {
  const name = fileName?.trim();
  return name ? `[Uploaded file: ${name}]` : null;
}

function draftSummary(
  request: OpinionRequest,
  doctorId: string,
  values: ConsultationSummaryFormValues,
  prescription: string | null,
  labs: string | null,
  prescriptionFileName: string | null,
  labOrderFileName: string | null
): ConsultationSummary {
  const now = new Date().toISOString();
  return {
    id: 'preview',
    request_id: request.id,
    doctor_id: doctorId,
    patient_auth_user_id: request.patient_id ?? null,
    chief_complaint: values.chief_complaint.trim() || null,
    history_present_illness: values.history_present_illness.trim() || null,
    vital_signs: values.vital_signs.trim() || null,
    current_medications: null,
    past_medical_history: values.past_medical_history.trim() || null,
    review_of_systems: values.review_of_systems.trim() || null,
    physical_examination: values.physical_examination.trim() || null,
    labs_diagnostics: labs,
    assessment_plan: values.assessment_plan.trim() || null,
    advise_food_lifestyle: values.advise_food_lifestyle.trim() || null,
    refer_to: values.refer_to.trim() || null,
    followup_date: values.followup_date.trim() || null,
    prescription,
    prescription_file_name: prescriptionFileName,
    lab_order_file_name: labOrderFileName,
    pdf_storage_path: null,
    created_at: now,
    updated_at: now
  };
}

async function storageBlob(path: string | null | undefined, requestId: string): Promise<Blob | null> {
  const trimmed = path?.trim();
  if (!trimmed) return null;
  const { data } = await getMedicalRecordDownloadUrl(trimmed, { requestId });
  if (!data?.signedUrl) return null;
  try {
    const response = await fetch(data.signedUrl);
    if (!response.ok) return null;
    return await response.blob();
  } finally {
    URL.revokeObjectURL(data.signedUrl);
  }
}

function fileKind(fileName: string, blob: Blob): PreviewDoc['kind'] {
  if (blob.type === 'application/pdf' || fileName.toLowerCase().endsWith('.pdf')) return 'pdf';
  if (blob.type.startsWith('image/') || isImageFileName(fileName)) return 'image';
  return 'file';
}

export default function DoctorConsultationPreviewModal({
  open,
  onClose,
  mode,
  request,
  doctor,
  values,
  prescriptionEntryMode,
  labOrderEntryMode,
  prescriptionFile,
  labOrderFile,
  existingPrescriptionPath,
  existingPrescriptionName,
  existingLabOrderPath,
  existingLabOrderName,
  uploadFile,
  uploadNote
}: DoctorConsultationPreviewModalProps) {
  const [docs, setDocs] = useState<PreviewDoc[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  useEffect(() => {
    if (!open) {
      setDocs([]);
      setActiveId(null);
      setError(null);
      return;
    }

    let cancelled = false;
    const createdUrls: string[] = [];

    const remember = (url: string) => {
      createdUrls.push(url);
      return url;
    };

    const load = async () => {
      setLoading(true);
      setError(null);
      setDocs([]);

      try {
        if (mode === 'upload') {
          if (!uploadFile) {
            if (!cancelled) setError('Choose a file to preview the consultation notes.');
            return;
          }
          const kind = fileKind(uploadFile.name, uploadFile);
          const next: PreviewDoc[] = [
            {
              id: 'upload',
              label: 'Uploaded notes',
              url: remember(URL.createObjectURL(uploadFile)),
              kind,
              fileName: uploadFile.name
            }
          ];
          if (cancelled) {
            next.forEach((doc) => URL.revokeObjectURL(doc.url));
            return;
          }
          setDocs(next);
          setActiveId(next[0]?.id ?? null);
          return;
        }

        const doctorId =
          doctor?.id?.trim() || request.doctor_id?.trim() || request.selected_doctor_id?.trim() || 'preview';
        const prescriptionName =
          prescriptionEntryMode === 'upload'
            ? prescriptionFile?.name || existingPrescriptionName?.trim() || null
            : null;
        const labName =
          labOrderEntryMode === 'upload'
            ? labOrderFile?.name || existingLabOrderName?.trim() || null
            : null;
        const prescriptionText =
          prescriptionEntryMode === 'type' ? values.prescription.trim() || null : uploadedPlaceholder(prescriptionName);
        const labText =
          labOrderEntryMode === 'type' ? values.labs_diagnostics.trim() || null : uploadedPlaceholder(labName);

        const [prescriptionBlob, labBlob] = await Promise.all([
          prescriptionEntryMode === 'upload'
            ? prescriptionFile ?? storageBlob(existingPrescriptionPath, request.id)
            : Promise.resolve(null),
          labOrderEntryMode === 'upload'
            ? labOrderFile ?? storageBlob(existingLabOrderPath, request.id)
            : Promise.resolve(null)
        ]);

        const summary = draftSummary(
          request,
          doctorId,
          values,
          prescriptionText,
          labText,
          prescriptionName,
          labName
        );
        const meta = consultationSummaryPdfMetaFromRequest(request, doctor);
        const notesBlob = await generateConsultationSummaryPdfBlob(summary, meta, {
          prescriptionFile: prescriptionBlob,
          prescriptionFileName: prescriptionName,
          labOrderFile: labBlob,
          labOrderFileName: labName
        });

        const orderMeta = {
          patientName: request.patient_name,
          patientGender: request.patient_gender,
          patientEmail: request.patient_email,
          patientId: request.patient_id,
          doctorName: doctor?.full_name ?? request.doctor_name,
          doctorSpecialty: doctor?.specialty ?? request.doctor_specialty,
          doctorQualification: doctor?.qualification ?? null,
          doctorMedicalLicenseNo: doctor?.medical_license_no ?? null,
          doctor,
          scheduledAt: request.scheduled_at,
          requestId: request.id,
          clinicId: request.clinic_id,
          clinicName: request.clinic_name,
          issuedAt: new Date()
        };

        const next: PreviewDoc[] = [
          {
            id: 'notes',
            label: 'Consultation notes',
            url: remember(URL.createObjectURL(notesBlob)),
            kind: 'pdf'
          }
        ];

        if (prescriptionEntryMode === 'type' && values.prescription.trim()) {
          const blob = await generatePrescriptionOrderPdfBlob(values.prescription.trim(), orderMeta);
          next.push({
            id: 'prescription',
            label: 'Prescription',
            url: remember(URL.createObjectURL(blob)),
            kind: 'pdf'
          });
        } else if (prescriptionBlob && prescriptionName) {
          const blob = await generatePrescriptionOrderPdfFromUploadBlob(
            prescriptionBlob,
            prescriptionName,
            orderMeta
          );
          next.push({
            id: 'prescription',
            label: 'Prescription',
            url: remember(URL.createObjectURL(blob)),
            kind: 'pdf'
          });
        }

        if (labOrderEntryMode === 'type' && values.labs_diagnostics.trim()) {
          const blob = await generateLabOrderPdfBlob(values.labs_diagnostics.trim(), orderMeta);
          next.push({
            id: 'lab',
            label: 'Lab order',
            url: remember(URL.createObjectURL(blob)),
            kind: 'pdf'
          });
        } else if (labBlob && labName) {
          const blob = await generateLabOrderPdfFromUploadBlob(labBlob, labName, orderMeta);
          next.push({
            id: 'lab',
            label: 'Lab order',
            url: remember(URL.createObjectURL(blob)),
            kind: 'pdf'
          });
        }

        if (cancelled) {
          next.forEach((doc) => URL.revokeObjectURL(doc.url));
          return;
        }
        setDocs(next);
        setActiveId(next[0]?.id ?? null);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Could not build the consultation preview.');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void load();

    return () => {
      cancelled = true;
      createdUrls.forEach((url) => URL.revokeObjectURL(url));
    };
  }, [
    open,
    mode,
    request,
    doctor,
    values,
    prescriptionEntryMode,
    labOrderEntryMode,
    prescriptionFile,
    labOrderFile,
    existingPrescriptionPath,
    existingPrescriptionName,
    existingLabOrderPath,
    existingLabOrderName,
    uploadFile
  ]);

  if (!open) return null;

  const active = docs.find((doc) => doc.id === activeId) ?? docs[0] ?? null;

  return (
    <div className='elixhealth-modal-root doctor-consultation-preview-modal-root' role='presentation'>
      <button type='button' className='elixhealth-modal-backdrop' aria-label='Close preview' onClick={onClose} />
      <div
        className='elixhealth-modal doctor-consultation-preview-modal'
        role='dialog'
        aria-modal='true'
        aria-labelledby='doctor-consultation-preview-title'
      >
        <div className='elixhealth-modal-head'>
          <div>
            <h2 id='doctor-consultation-preview-title'>
              <Eye size={18} aria-hidden /> Consultation preview
            </h2>
            <p className='muted'>Review the documents before you submit. Nothing is saved yet.</p>
          </div>
          <button type='button' className='icon-btn elixhealth-modal-close' onClick={onClose} aria-label='Close preview'>
            <X size={18} aria-hidden />
          </button>
        </div>

        <div className='elixhealth-modal-body doctor-consultation-preview-modal__body'>
          {loading ? (
            <p className='doctor-status' role='status'>
              <Loader2 size={18} className='spin' aria-hidden /> Building preview…
            </p>
          ) : null}
          {error ? (
            <p className='auth-error' role='alert'>
              {error}
            </p>
          ) : null}

          {docs.length > 1 ? (
            <div className='doctor-consultation-preview-modal__tabs' role='tablist' aria-label='Preview documents'>
              {docs.map((doc) => (
                <button
                  key={doc.id}
                  type='button'
                  role='tab'
                  aria-selected={doc.id === active?.id}
                  className={`doctor-consultation-preview-modal__tab${
                    doc.id === active?.id ? ' doctor-consultation-preview-modal__tab--active' : ''
                  }`}
                  onClick={() => setActiveId(doc.id)}
                >
                  {doc.label}
                </button>
              ))}
            </div>
          ) : null}

          {active?.kind === 'pdf' ? <ReactPdfDocumentViewer src={active.url} title={active.label} /> : null}
          {active?.kind === 'image' ? (
            <img className='doctor-consultation-preview-modal__image' src={active.url} alt={active.fileName ?? active.label} />
          ) : null}
          {active?.kind === 'file' ? (
            <p className='muted'>
              {active.fileName ?? 'This file'} cannot be shown here. It will be attached when you submit.
            </p>
          ) : null}

          {mode === 'upload' && uploadNote.trim() ? (
            <div className='doctor-consultation-preview-modal__note'>
              <p className='doctor-consultation-preview-modal__note-label'>Optional note</p>
              <p>{uploadNote.trim()}</p>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
