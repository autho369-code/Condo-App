-- Report runs can now be produced as Excel (.xlsx). Allow that file type in
-- the private 'reports' bucket alongside PDF, CSV and JSON.
update storage.buckets
   set allowed_mime_types = array_append(
         coalesce(allowed_mime_types, array[]::text[]),
         'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
 where id = 'reports'
   and not ('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' = any(coalesce(allowed_mime_types, array[]::text[])));
