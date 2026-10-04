'use client';

// File picker for form templates. The file uploads browser→storage through a
// signed URL as soon as it is chosen (large PDFs never pass through the
// server action); the form then posts only the stored path and file name.
import { useEffect, useRef, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { createFormFileUpload } from '@/lib/rpcs/forms';
import { FORM_FILE_MAX_BYTES, FORM_FILE_TYPES } from '@/lib/forms/file-types';

const BUCKET = 'association-documents';
const MAX_MB = Math.round(FORM_FILE_MAX_BYTES / 1048576);

type State = { status: 'idle' } | { status: 'uploading'; name: string } | { status: 'done'; path: string; name: string } | { status: 'error'; message: string };

export function FormFileInput({ formId }: { formId?: string }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [state, setState] = useState<State>({ status: 'idle' });
  const uploading = state.status === 'uploading';

  // Block submitting while the upload runs (the action also refuses it).
  useEffect(() => {
    const form = inputRef.current?.form;
    if (!form || !uploading) return;
    const block = (e: Event) => e.preventDefault();
    form.addEventListener('submit', block);
    return () => form.removeEventListener('submit', block);
  }, [uploading]);

  async function onChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return setState({ status: 'idle' });
    if (!FORM_FILE_TYPES[file.type]) return setState({ status: 'error', message: 'Upload a PDF, Word document, PNG or JPEG.' });
    if (file.size > FORM_FILE_MAX_BYTES) return setState({ status: 'error', message: `Files can be up to ${MAX_MB} MB.` });
    setState({ status: 'uploading', name: file.name });
    try {
      const signed = await createFormFileUpload({ formId: formId ?? null, fileType: file.type, fileSize: file.size });
      if (signed.error || !signed.path || !signed.token) throw new Error(signed.error ?? 'Could not authorize the upload.');
      const { error } = await createClient().storage.from(BUCKET)
        .uploadToSignedUrl(signed.path, signed.token, file, { contentType: file.type });
      if (error) throw new Error(error.message);
      setState({ status: 'done', path: signed.path, name: file.name });
    } catch (err: any) {
      if (inputRef.current) inputRef.current.value = '';
      setState({ status: 'error', message: err?.message ?? 'The file could not be uploaded.' });
    }
  }

  return (
    <div className="space-y-2">
      <input
        ref={inputRef}
        id="file"
        type="file"
        accept=".pdf,.doc,.docx,.png,.jpg,.jpeg"
        onChange={onChange}
        disabled={uploading}
        className="block w-full text-sm text-gray-700 file:mr-3 file:h-10 file:rounded-lg file:border file:border-gray-300 file:bg-white file:px-3 file:text-sm file:font-medium file:text-gray-700 hover:file:bg-gray-50"
      />
      <input type="hidden" name="file_state" value={state.status} />
      {state.status === 'done' && (
        <>
          <input type="hidden" name="file_path" value={state.path} />
          <input type="hidden" name="file_name" value={state.name} />
        </>
      )}
      <p role="status" aria-live="polite" className={state.status === 'error' ? 'text-sm text-red-700' : 'text-sm text-gray-600'}>
        {state.status === 'uploading' && `Uploading ${state.name}…`}
        {state.status === 'done' && `${state.name} uploaded. Save to attach it.`}
        {state.status === 'error' && state.message}
      </p>
    </div>
  );
}
