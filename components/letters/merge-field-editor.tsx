'use client';

import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import { useCallback, useState } from 'react';

// Merge field definition
export interface MergeField {
  key: string;
  label: string;
  category: string;
  preview: string; // sample value for preview
}

export const MERGE_FIELDS: MergeField[] = [
  { key: 'association_name', label: 'Association Name', category: 'Association', preview: 'Oakwood Estates HOA' },
  { key: 'association_address', label: 'Association Address', category: 'Association', preview: '123 Main Street, Springfield, IL 62701' },
  { key: 'association_city', label: 'Association City', category: 'Association', preview: 'Springfield' },
  { key: 'association_state', label: 'Association State', category: 'Association', preview: 'IL' },
  { key: 'association_zip', label: 'Association Zip', category: 'Association', preview: '62701' },
  { key: 'association_phone', label: 'Association Phone', category: 'Association', preview: '(555) 123-4567' },
  { key: 'owner_name', label: 'Owner Name', category: 'Owner', preview: 'Jane Smith' },
  { key: 'owner_address', label: 'Owner Address', category: 'Owner', preview: '456 Oak Lane, Springfield, IL 62702' },
  { key: 'owner_email', label: 'Owner Email', category: 'Owner', preview: 'jane@example.com' },
  { key: 'owner_phone', label: 'Owner Phone', category: 'Owner', preview: '(555) 987-6543' },
  { key: 'owner_unit', label: 'Owner Unit', category: 'Owner', preview: 'Unit 4B' },
  { key: 'owner_account_number', label: 'Owner Account #', category: 'Owner', preview: 'OA-0042' },
  { key: 'owner_balance', label: 'Owner Balance', category: 'Owner', preview: '$1,250.00' },
  { key: 'vendor_name', label: 'Vendor Name', category: 'Vendor', preview: 'ABC Landscaping LLC' },
  { key: 'vendor_address', label: 'Vendor Address', category: 'Vendor', preview: '789 Commerce Dr, Springfield, IL 62703' },
  { key: 'vendor_email', label: 'Vendor Email', category: 'Vendor', preview: 'billing@abclandscaping.com' },
  { key: 'vendor_phone', label: 'Vendor Phone', category: 'Vendor', preview: '(555) 456-7890' },
  { key: 'current_date', label: 'Current Date', category: 'Date', preview: 'June 8, 2026' },
  { key: 'current_date_short', label: 'Current Date (Short)', category: 'Date', preview: '6/8/2026' },
  { key: 'due_date', label: 'Due Date', category: 'Date', preview: 'June 22, 2026' },
  { key: 'amount_due', label: 'Amount Due', category: 'Accounting', preview: '$350.00' },
  { key: 'payment_instructions', label: 'Payment Instructions', category: 'Accounting', preview: 'Pay online at portal.portier369.com or mail check to PO Box 1234' },
  { key: 'board_president_name', label: 'Board President', category: 'Association', preview: 'Robert Johnson' },
  { key: 'manager_name', label: 'Property Manager', category: 'Association', preview: 'Sarah Williams, CAM' },
  { key: 'late_fee_amount', label: 'Late Fee Amount', category: 'Accounting', preview: '$25.00' },
  { key: 'violation_description', label: 'Violation Description', category: 'Violations', preview: 'Unauthorized exterior modification — satellite dish on balcony' },
  { key: 'violation_rule', label: 'Violation Rule Reference', category: 'Violations', preview: 'CC&R Section 4.2 — Exterior Modifications' },
  { key: 'hearing_date', label: 'Hearing Date', category: 'Violations', preview: 'July 15, 2026 at 6:30 PM' },
];

const FIELD_CATEGORIES = [...new Set(MERGE_FIELDS.map((f) => f.category))];

interface Props {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  readOnly?: boolean;
}

export default function MergeFieldEditor({ value, onChange, placeholder, readOnly }: Props) {
  const [showFields, setShowFields] = useState(false);
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState<string | null>(null);

  const filtered = MERGE_FIELDS.filter((f) => {
    const matchSearch = !search || f.label.toLowerCase().includes(search.toLowerCase()) || f.key.toLowerCase().includes(search.toLowerCase());
    const matchCat = !activeCategory || f.category === activeCategory;
    return matchSearch && matchCat;
  });

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
      }),
      Placeholder.configure({
        placeholder: placeholder || 'Start typing your letter... Use {{ to insert merge fields.',
      }),
    ],
    content: value,
    editable: !readOnly,
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML());
    },
  });

  const insertField = useCallback((field: MergeField) => {
    if (!editor) return;
    const label = `{{${field.key}}}`;
    editor.chain().focus().insertContent(label).run();
    setShowFields(false);
    setSearch('');
    setActiveCategory(null);
  }, [editor]);

  if (!editor) return null;

  return (
    <div className="relative">
      {/* Toolbar */}
      {!readOnly && (
        <div className="flex flex-wrap items-center gap-1 rounded-t-lg border border-gray-200 bg-gray-50 px-3 py-2">
          <ToolbarButton onClick={() => editor.chain().focus().toggleBold().run()} active={editor.isActive('bold')} title="Bold (Ctrl+B)">B</ToolbarButton>
          <ToolbarButton onClick={() => editor.chain().focus().toggleItalic().run()} active={editor.isActive('italic')} title="Italic (Ctrl+I)"><em>I</em></ToolbarButton>
          <ToolbarButton onClick={() => editor.chain().focus().toggleStrike().run()} active={editor.isActive('strike')} title="Strikethrough"><s>S</s></ToolbarButton>
          <span className="mx-1 text-gray-300">|</span>
          <ToolbarButton onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} active={editor.isActive('heading', { level: 2 })} title="Heading 2">H2</ToolbarButton>
          <ToolbarButton onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()} active={editor.isActive('heading', { level: 3 })} title="Heading 3">H3</ToolbarButton>
          <span className="mx-1 text-gray-300">|</span>
          <ToolbarButton onClick={() => editor.chain().focus().toggleBulletList().run()} active={editor.isActive('bulletList')} title="Bullet List">• List</ToolbarButton>
          <ToolbarButton onClick={() => editor.chain().focus().toggleOrderedList().run()} active={editor.isActive('orderedList')} title="Numbered List">1. List</ToolbarButton>
          <ToolbarButton onClick={() => editor.chain().focus().toggleBlockquote().run()} active={editor.isActive('blockquote')} title="Quote">&ldquo;</ToolbarButton>
          <span className="mx-1 text-gray-300">|</span>
          <ToolbarButton onClick={() => editor.chain().focus().setHorizontalRule().run()} title="Horizontal Rule">—</ToolbarButton>
          <ToolbarButton onClick={() => editor.chain().focus().undo().run()} title="Undo (Ctrl+Z)">↩</ToolbarButton>
          <ToolbarButton onClick={() => editor.chain().focus().redo().run()} title="Redo (Ctrl+Y)">↪</ToolbarButton>
          <span className="mx-1 text-gray-300">|</span>
          <button
            type="button"
            onClick={() => setShowFields(!showFields)}
            className={`rounded px-2.5 py-1 text-xs font-medium transition ${showFields ? 'bg-emerald-100 text-emerald-700' : 'text-gray-600 hover:bg-gray-200'}`}
          >
            {'{ }'} Merge Fields
          </button>
        </div>
      )}

      {/* Merge field panel */}
      {showFields && (
        <div className="absolute right-0 top-full z-30 mt-1 w-80 rounded-lg border border-gray-200 bg-white shadow-lg">
          <div className="border-b border-gray-100 p-3">
            <input
              type="text"
              placeholder="Search fields..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-md border border-gray-200 px-3 py-1.5 text-xs focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
            />
          </div>
          <div className="flex gap-1 border-b border-gray-100 px-3 py-2">
            <CategoryPill label="All" active={!activeCategory} onClick={() => setActiveCategory(null)} />
            {FIELD_CATEGORIES.map((cat) => (
              <CategoryPill key={cat} label={cat} active={activeCategory === cat} onClick={() => setActiveCategory(cat)} />
            ))}
          </div>
          <div className="max-h-64 overflow-y-auto p-2">
            {filtered.length === 0 ? (
              <p className="px-3 py-4 text-center text-xs text-gray-400">No fields match your search.</p>
            ) : (
              filtered.map((field) => (
                <button
                  key={field.key}
                  type="button"
                  onClick={() => insertField(field)}
                  className="flex w-full items-center justify-between rounded px-3 py-2 text-left text-xs transition hover:bg-emerald-50"
                >
                  <span>
                    <span className="font-medium text-gray-800">{field.label}</span>
                    <span className="ml-2 text-gray-400">{field.preview}</span>
                  </span>
                  <span className="font-mono text-[10px] text-emerald-600">{`{{${field.key}}}`}</span>
                </button>
              ))
            )}
          </div>
        </div>
      )}

      {/* Editor area */}
      <div className={`prose prose-sm max-w-none ${!readOnly ? 'rounded-b-lg border border-t-0 border-gray-200' : ''}`}>
        <style jsx global>{`
          .ProseMirror {
            padding: 1rem 1.5rem;
            min-height: 300px;
            outline: none;
            font-size: 14px;
            line-height: 1.7;
            color: #1a1a2e;
          }
          .ProseMirror p.is-editor-empty:first-child::before {
            color: #adb5bd;
            content: attr(data-placeholder);
            float: left;
            height: 0;
            pointer-events: none;
          }
          .ProseMirror h2 { font-size: 1.25rem; font-weight: 600; margin-top: 1.25rem; margin-bottom: 0.5rem; }
          .ProseMirror h3 { font-size: 1.1rem; font-weight: 600; margin-top: 1rem; margin-bottom: 0.5rem; }
          .ProseMirror p { margin-bottom: 0.5rem; }
          .ProseMirror ul, .ProseMirror ol { padding-left: 1.5rem; margin-bottom: 0.5rem; }
          .ProseMirror li { margin-bottom: 0.25rem; }
          .ProseMirror blockquote {
            border-left: 3px solid #10b981;
            padding-left: 1rem;
            margin-left: 0;
            color: #64748b;
            font-style: italic;
          }
          .ProseMirror hr { border: none; border-top: 1px solid #e5e7eb; margin: 1rem 0; }
        `}</style>
        <EditorContent editor={editor} />
      </div>
    </div>
  );
}

function ToolbarButton({ onClick, active, title, children }: { onClick: () => void; active?: boolean; title?: string; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className={`rounded px-2 py-0.5 text-xs font-medium transition ${active ? 'bg-emerald-100 text-emerald-700' : 'text-gray-600 hover:bg-gray-200'}`}
    >
      {children}
    </button>
  );
}

function CategoryPill({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full px-2.5 py-0.5 text-[11px] font-medium transition ${active ? 'bg-emerald-100 text-emerald-700' : 'text-gray-500 hover:bg-gray-100'}`}
    >
      {label}
    </button>
  );
}
