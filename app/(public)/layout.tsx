export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gray-50">
      <header className="border-b border-gray-200 bg-white px-6 py-4">
        <a href="/" className="text-lg font-semibold text-gray-900">Portier</a>
      </header>
      <main>{children}</main>
    </div>
  );
}
