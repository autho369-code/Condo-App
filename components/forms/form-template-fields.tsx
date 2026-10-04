import { Field, Input, Select, Textarea } from '@/components/ui/input';
import { FORM_AUDIENCES } from '@/lib/forms/files';
import { FormFileInput } from '@/components/forms/form-file-input';

export type FormTemplateValues = {
  id?: string;
  name?: string | null;
  description?: string | null;
  form_type?: string | null;
  audience?: string | null;
  file_url?: string | null;
  file_name?: string | null;
  file_path?: string | null;
  active?: boolean | null;
};

/** Fields shared by the new and edit form-template pages (the file uploads separately). */
export function FormTemplateFields({ form, fileHref }: { form?: FormTemplateValues; fileHref?: string | null }) {
  const editing = !!form?.id;
  return (
    <div className="space-y-5">
      {editing && <input type="hidden" name="id" value={form!.id} />}
      <Field label="Form name" htmlFor="name" required>
        <Input id="name" name="name" required maxLength={200} defaultValue={form?.name ?? ''} placeholder="e.g. Move-in checklist" />
      </Field>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Who it's for" htmlFor="audience" hint="Homeowner forms are listed in the owner portal under Documents.">
          <Select id="audience" name="audience" defaultValue={form?.audience ?? 'homeowner'}>
            {FORM_AUDIENCES.map((a) => <option key={a.value} value={a.value}>{a.label}</option>)}
          </Select>
        </Field>
        <Field label="Category" htmlFor="form_type">
          <Input id="form_type" name="form_type" defaultValue={form?.form_type ?? ''} placeholder="e.g. move-in, parking, pet registration" />
        </Field>
      </div>
      <Field label="Description" htmlFor="description">
        <Textarea id="description" name="description" rows={3} defaultValue={form?.description ?? ''} placeholder="What the form is for and how to return it" />
      </Field>
      <Field
        label={form?.file_path ? 'Replace file' : 'Upload file'}
        htmlFor="file"
        hint="PDF, Word, PNG or JPEG, up to 25 MB."
      >
        <FormFileInput formId={form?.id} />
      </Field>
      {form?.file_path && (
        <div className="flex flex-col gap-2 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm sm:flex-row sm:items-center">
          <span className="text-gray-700">
            Current file:{' '}
            {fileHref ? <a href={fileHref} target="_blank" rel="noopener noreferrer" className="font-medium text-gray-950 hover:underline">{form.file_name ?? 'Download'}</a> : (form.file_name ?? 'Uploaded file')}
          </span>
          <label className="flex min-h-10 items-center gap-2 text-gray-600 sm:ml-auto">
            <input type="checkbox" name="remove_file" value="1" className="h-4 w-4 rounded border-gray-300" /> Remove file
          </label>
        </div>
      )}
      <Field label="Or link to a form" htmlFor="file_url" hint="Optional. Must start with https://">
        <Input id="file_url" name="file_url" type="url" pattern="https://.*" defaultValue={form?.file_url ?? ''} placeholder="https://" />
      </Field>
      {editing && (
        <label className="flex min-h-10 items-center gap-2 text-sm text-gray-700">
          <input type="checkbox" name="active" value="1" defaultChecked={form?.active !== false} className="h-4 w-4 rounded border-gray-300" />
          Active (inactive forms are hidden from the owner portal)
        </label>
      )}
    </div>
  );
}
