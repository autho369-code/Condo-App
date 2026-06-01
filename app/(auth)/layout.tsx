export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#060B18] px-4 py-12">
      <div className="w-full max-w-3xl">
        {children}
      </div>
    </div>
  );
}
