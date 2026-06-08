SELECT tgname FROM pg_trigger WHERE tgrelid = 'document_templates'::regclass;
