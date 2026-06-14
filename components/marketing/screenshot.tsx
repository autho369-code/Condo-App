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
}: {
  file: string;
  alt: string;
  width: number;
  height: number;
  className?: string;
  fallback: React.ReactNode;
  priority?: boolean;
}) {
  if (!screenshotExists(file)) return <>{fallback}</>;
  return (
    <Image
      src={`/screenshots/${file}`}
      alt={alt}
      width={width}
      height={height}
      className={className}
      priority={priority}
      sizes="(max-width: 768px) 100vw, (max-width: 1280px) 80vw, 1100px"
    />
  );
}
