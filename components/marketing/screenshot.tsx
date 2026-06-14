import fs from 'node:fs';
import path from 'node:path';
import Image from 'next/image';

/* Shows a real screenshot from /public/screenshots if the file exists,
   otherwise renders the provided fallback (the realistic placeholder UI).
   File existence is checked at build/request time on the server, so adding
   a PNG and redeploying is all it takes to "go live" with a real shot. */

function screenshotExists(file: string): boolean {
  try {
    return fs.existsSync(path.join(process.cwd(), 'public', 'screenshots', file));
  } catch {
    return false;
  }
}

export function Screenshot({
  file,
  alt,
  width,
  height,
  className,
  fallback,
  priority,
  framed = false,
}: {
  file: string;
  alt: string;
  width: number;
  height: number;
  className?: string;
  fallback: React.ReactNode;
  priority?: boolean;
  framed?: boolean;
}) {
  if (!screenshotExists(file)) return <>{fallback}</>;

  if (framed) {
    return (
      <div className={className}>
        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-[0_25px_70px_-20px_rgba(30,58,95,0.15),0_15px_35px_-15px_rgba(0,0,0,0.08)]">
          <div className="flex items-center gap-1.5 border-b border-gray-100 bg-gray-50/70 px-3.5 py-2.5">
            <div className="h-2.5 w-2.5 rounded-full bg-red-300" />
            <div className="h-2.5 w-2.5 rounded-full bg-amber-300" />
            <div className="h-2.5 w-2.5 rounded-full bg-emerald-300" />
          </div>
          <Image src={`/screenshots/${file}`} alt={alt} width={width} height={height} priority={priority} className="block w-full" sizes="(max-width: 768px) 100vw, (max-width: 1280px) 80vw, 1100px" />
        </div>
      </div>
    );
  }

  return (
    <Image
      src={`/screenshots/${file}`}
      alt={alt}
      width={width}
      height={height}
      priority={priority}
      className={className ?? 'block w-full'}
      sizes="(max-width: 768px) 100vw, (max-width: 1280px) 80vw, 1100px"
    />
  );
}
