import { FileText, Scale, Users, File } from 'lucide-react'

const sections = [
  { title: 'Governing Documents', icon: Scale, items: ['Declaration', 'Bylaws', 'Rules & Regulations', 'Amendments'] },
  { title: 'Owner Documents', icon: FileText, items: ['Welcome Packet', 'Association Forms', 'Parking Rules', 'Move-In / Move-Out Procedures', 'Insurance Requirements', 'Lease Requirements'] },
  { title: 'Meeting Records', icon: Users, items: ['Approved Meeting Minutes', 'Annual Meeting Minutes', 'Owner Notices'] },
]

export default function OwnerDocumentsPage() {
  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Documents</h1>
        <p className="text-sm text-gray-500">Governing documents, forms, and association records</p>
      </div>

      <div className="space-y-6">
        {sections.map(s => (
          <div key={s.title} className="rounded-xl bg-white border border-gray-200 shadow-sm overflow-hidden">
            <div className="flex items-center gap-3 border-b border-gray-100 px-5 py-4 bg-gray-50">
              <s.icon className="h-5 w-5 text-blue-600" />
              <h2 className="font-semibold text-gray-900">{s.title}</h2>
            </div>
            <div className="divide-y divide-gray-100">
              {s.items.map(item => (
                <div key={item} className="flex items-center justify-between px-5 py-3.5 hover:bg-gray-50 transition">
                  <div className="flex items-center gap-3">
                    <File className="h-4 w-4 text-gray-400" />
                    <span className="text-sm text-gray-700">{item}</span>
                  </div>
                  <span className="text-xs text-gray-400">No file uploaded yet</span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
