-- association-documents bucket rejected WebP/HEIC — iPhone photos of policy
-- documents and plans failed at upload. Applied via MCP 2026-07-14.
update storage.buckets
set allowed_mime_types = array[
  'application/pdf','application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'image/png','image/jpeg','image/webp','image/heic','image/heif','text/plain'
]
where id = 'association-documents';
