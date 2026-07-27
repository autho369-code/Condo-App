'use client';

import { useEffect, useState } from 'react';
import { sanitizeRichTextHtml } from '@/lib/security/rich-text';

export function SafeRichText({ html, className }: { html: string; className?: string }) {
  const [sanitized, setSanitized] = useState('');

  useEffect(() => {
    setSanitized(sanitizeRichTextHtml(html));
  }, [html]);

  return <div className={className} dangerouslySetInnerHTML={{ __html: sanitized }} />;
}
