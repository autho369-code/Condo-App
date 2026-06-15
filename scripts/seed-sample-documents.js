/**
 * Seed sample association documents for Granville Courts.
 *
 * Uploads small real PDF files into the `association-documents` storage bucket
 * (under a granville/ path) and inserts matching public.documents rows so the
 * owner portal (/portal/documents) shows real, openable files.
 *
 * Run: node scripts/seed-sample-documents.js
 * Requires .env.local with NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY.
 */
const fs = require('fs')
const path = require('path')
const { createClient } = require('@supabase/supabase-js')

// --- load .env.local (simple parser, no extra deps) ---
const envPath = path.join(__dirname, '..', '.env.local')
const env = {}
for (const line of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
  if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, '')
}

const SUPABASE_URL = env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_KEY = env.SUPABASE_SERVICE_ROLE_KEY
if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local')
  process.exit(1)
}

const BUCKET = 'association-documents'
const ASSOCIATION_ID = 'b1111111-1111-1111-1111-111111111111'

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})

/**
 * Build a minimal, valid single-page PDF with a title + body lines.
 * Hand-rolled so we need no PDF library. Opens in any browser/viewer.
 */
function makePdf(title, lines) {
  const esc = (s) => s.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)')
  const body = []
  body.push('BT')
  body.push('/F1 18 Tf')
  body.push('72 720 Td')
  body.push(`(${esc(title)}) Tj`)
  body.push('/F1 11 Tf')
  body.push('0 -28 TD')
  for (const ln of lines) {
    body.push(`(${esc(ln)}) Tj`)
    body.push('0 -16 TD')
  }
  body.push('ET')
  const stream = body.join('\n')

  const objs = []
  objs.push('<< /Type /Catalog /Pages 2 0 R >>')
  objs.push('<< /Type /Pages /Kids [3 0 R] /Count 1 >>')
  objs.push('<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>')
  objs.push(`<< /Length ${Buffer.byteLength(stream, 'utf8')} >>\nstream\n${stream}\nendstream`)
  objs.push('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>')

  let pdf = '%PDF-1.4\n'
  const offsets = []
  objs.forEach((o, i) => {
    offsets.push(Buffer.byteLength(pdf, 'utf8'))
    pdf += `${i + 1} 0 obj\n${o}\nendobj\n`
  })
  const xrefStart = Buffer.byteLength(pdf, 'utf8')
  pdf += `xref\n0 ${objs.length + 1}\n`
  pdf += '0000000000 65535 f \n'
  for (const off of offsets) pdf += `${String(off).padStart(10, '0')} 00000 n \n`
  pdf += `trailer\n<< /Size ${objs.length + 1} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF`
  return Buffer.from(pdf, 'utf8')
}

// doc_type is constrained by documents_doc_type_check to:
//   lease, ho6, renters_insurance, bylaws, minutes, other
// The portal's bucketFor() categorizes by keyword on doc_type:
//   'bylaws'  -> matches /bylaw/   -> "Governing Documents"
//   'minutes' -> matches /minute/  -> "Meeting Records"
//   'other'   -> no keyword match  -> "Other documents"
// So all three governing docs use 'bylaws' (the only governing-keyword value
// the constraint allows), the meeting record uses 'minutes', and the welcome
// packet uses 'other'.
const DOCS = [
  {
    doc_type: 'bylaws',
    file_name: 'Declaration of Condominium.pdf',
    object: 'granville/declaration-of-condominium.pdf',
    title: 'Declaration of Condominium',
    lines: [
      'Granville Courts Condominium Association',
      '',
      'This Declaration establishes the condominium regime for Granville',
      'Courts, defining the units, common elements, limited common',
      'elements, and the respective ownership interests of each unit owner.',
      '',
      'Article I - Submission of Property',
      'Article II - Definitions',
      'Article III - Description of Units and Common Elements',
      'Article IV - Allocation of Common Expenses and Voting Rights',
      'Article V - Easements and Use Restrictions',
      '',
      'Recorded with the County Registry of Deeds. Sample seed document.',
    ],
  },
  {
    doc_type: 'bylaws',
    file_name: 'Bylaws.pdf',
    object: 'granville/bylaws.pdf',
    title: 'Bylaws',
    lines: [
      'Granville Courts Condominium Association - Bylaws',
      '',
      'Article I - The Association and Membership',
      'Article II - Board of Directors; Election and Powers',
      'Article III - Meetings of Members and Quorum',
      'Article IV - Officers and Their Duties',
      'Article V - Assessments and Fiscal Management',
      'Article VI - Amendment of Bylaws',
      '',
      'These Bylaws govern the administration of the Association.',
      'Sample seed document.',
    ],
  },
  {
    doc_type: 'bylaws',
    file_name: 'Rules & Regulations.pdf',
    object: 'granville/rules-and-regulations.pdf',
    title: 'Rules & Regulations',
    lines: [
      'Granville Courts - Rules & Regulations',
      '',
      '1. Quiet hours are observed from 10:00 PM to 7:00 AM.',
      '2. Guest parking is limited to marked visitor spaces.',
      '3. Pets must be leashed in all common areas.',
      '4. Pool hours and guest-pass requirements are posted at the pool.',
      '5. Architectural changes require prior Board approval.',
      '6. Trash and recycling must use the designated enclosures.',
      '',
      'Violations may result in fines per the enforcement policy.',
      'Sample seed document.',
    ],
  },
  {
    doc_type: 'other',
    file_name: '2026 Welcome Packet.pdf',
    object: 'granville/2026-welcome-packet.pdf',
    title: '2026 Welcome Packet',
    lines: [
      'Welcome to Granville Courts!',
      '',
      'This packet helps new owners get settled:',
      '- How to access the owner portal and pay assessments',
      '- Key contacts: management office and emergency maintenance',
      '- Amenity access: clubhouse, pool, and fitness room',
      '- Trash, recycling, and parking guidelines',
      '- Board meeting schedule and how to get involved',
      '',
      'We are glad to have you in the community.',
      'Sample seed document.',
    ],
  },
  {
    doc_type: 'minutes',
    file_name: 'Q1 2026 Board Meeting Minutes.pdf',
    object: 'granville/q1-2026-board-meeting-minutes.pdf',
    title: 'Q1 2026 Board Meeting Minutes',
    lines: [
      'Granville Courts Condominium Association',
      'Q1 2026 Board Meeting - March 15, 2026',
      '',
      'Called to order at 6:02 PM; quorum met (4 of 5 directors).',
      'Prior minutes approved unanimously.',
      '2026 operating budget of $312,000 approved; assessments held flat.',
      'Greenfield Grounds Care awarded the landscaping contract.',
      'Pool opens Memorial Day weekend; updated pool rules approved.',
      'Adjourned at 7:43 PM. Next meeting: June 21, 2026.',
      '',
      'Sample seed document.',
    ],
  },
]

async function main() {
  let uploaded = 0
  let inserted = 0
  for (const d of DOCS) {
    const pdf = makePdf(d.title, d.lines)
    const up = await supabase.storage.from(BUCKET).upload(d.object, pdf, {
      contentType: 'application/pdf',
      upsert: true,
    })
    if (up.error) {
      console.error(`UPLOAD FAILED ${d.object}:`, up.error.message)
      continue
    }
    uploaded++
    console.log(`uploaded ${BUCKET}/${d.object}`)

    // Avoid duplicate rows on re-run: delete any prior row for this object.
    await supabase
      .from('documents')
      .delete()
      .eq('entity_type', 'association')
      .eq('entity_id', ASSOCIATION_ID)
      .eq('file_url', d.object)

    const ins = await supabase.from('documents').insert({
      entity_type: 'association',
      entity_id: ASSOCIATION_ID,
      doc_type: d.doc_type,
      file_name: d.file_name,
      file_url: d.object, // storage object path -> portal resolves via signed URL
    })
    if (ins.error) {
      console.error(`INSERT FAILED ${d.file_name}:`, ins.error.message)
      continue
    }
    inserted++
    console.log(`inserted documents row: ${d.doc_type} / ${d.file_name}`)
  }
  console.log(`\nDONE. uploaded=${uploaded} inserted=${inserted}`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
