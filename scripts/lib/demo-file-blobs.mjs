/** Minimal valid file bytes for seeding Storage (no external deps). */

function escapePdfText(text) {
  return text.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
}

export function demoPdfBuffer(title) {
  const label = escapePdfText(`Elix demo — ${title}`);
  const stream = `BT /F1 14 Tf 72 720 Td (${label}) Tj ET`;
  const len = Buffer.byteLength(stream, 'utf8');
  const body = [
    '%PDF-1.4',
    '1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj',
    '2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj',
    '3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 612 792]/Contents 4 0 R/Resources<</Font<</F1 5 0 R>>>>>>endobj',
    `4 0 obj<</Length ${len}>>stream`,
    stream,
    'endstream endobj',
    '5 0 obj<</Type/Font/Subtype/Type1/BaseFont/Helvetica>>endobj',
    'xref',
    '0 6',
    'trailer<</Size 6/Root 1 0 R>>',
    'startxref',
    '0',
    '%%EOF'
  ].join('\n');
  return Buffer.from(body, 'utf8');
}

/** 1×1 JPEG (valid, tiny). */
export function demoJpegBuffer() {
  return Buffer.from(
    '/9j/4AAQSkZJRgABAQAAAQABAAD/2wCEAAkGBxAQEBAQEBAVFhUVFhUWFxYWFhUXFxgVFRUYHSggGBolGxUVITEhJSkrLi4uFx8zODMsNygtLisBCgoKDg0OGxAQGy0lHyUtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLf/AABEIAAEAAQMBIgACEQEDEQH/xAAXAAEBAQEAAAAAAAAAAAAAAAAAAQID/8QAFhABAQEAAAAAAAAAAAAAAAAAAAAB/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwDZwAA//9k=',
    'base64'
  );
}

export function blobForRecord(record) {
  const mime = record.mime_type ?? '';
  const name = record.file_name ?? 'document';
  if (mime.includes('jpeg') || mime.includes('jpg') || name.toLowerCase().endsWith('.jpg') || name.toLowerCase().endsWith('.jpeg')) {
    return { buffer: demoJpegBuffer(), contentType: 'image/jpeg' };
  }
  return { buffer: demoPdfBuffer(name), contentType: 'application/pdf' };
}
