'use client';

import { useState } from 'react';
import { FileText, Download, ExternalLink, Image as ImageIcon, X } from 'lucide-react';
import { formatBytes } from '@/lib/utils';
import { getApiBaseUrl } from '@/lib/apiConfig';

interface Attachment {
  name: string;
  url: string;
  type?: string;
  size?: number;
}

/**
 * Build a safe URL for an attachment.
 *
 * SECURITY NOTE: File attachments are stored on the backend. They must be
 * accessed through the authenticated API endpoint (/api/files/:id/download)
 * rather than the direct /uploads path, which:
 *   1. Requires authentication (prevents unauthenticated access)
 *   2. Enforces company isolation
 *   3. Protects against path traversal
 *
 * For legacy URLs stored as "/uploads/xxx" we keep them relative so the
 * browser sends them to the current origin (the Next.js proxy or the
 * backend on localhost:5000 during development). In production this
 * should always be served through the backend's /api/files download route.
 *
 * We never hardcode 'http://localhost:5000' because that URL only works
 * on the developer's machine — on a phone or deployed environment it
 * would produce a net::ERR_CONNECTION_REFUSED error.
 */
const buildAttachmentUrl = (url: string): string => {
  if (!url) return '';
  // Already an absolute URL (https://... or http://...) — use as-is
  if (url.startsWith('http://') || url.startsWith('https://')) return url;
  // Relative path — resolve against the API base URL from the environment
  const apiBase = getApiBaseUrl().replace(/\/api\/?$/, '');
  return `${apiBase}${url}`;
};

export function MessageAttachment({ attachment }: { attachment: Attachment }) {
  const [isModalOpen, setIsModalOpen] = useState(false);

  const isImage =
    attachment.type?.startsWith('image/') ||
    /\.(jpg|jpeg|png|gif|webp)$/i.test(attachment.url || attachment.name);

  const fullUrl = buildAttachmentUrl(attachment.url);

  if (isImage) {
    return (
      <>
        <div className="mt-2 group/img relative inline-block max-w-sm overflow-hidden rounded-2xl border border-slate-200 bg-slate-50">
          <img
            src={fullUrl}
            alt={attachment.name}
            className="max-h-64 max-w-full rounded-2xl object-cover cursor-pointer hover:opacity-95 transition-opacity"
            onClick={() => setIsModalOpen(true)}
            loading="lazy"
            referrerPolicy="no-referrer"
          />
          <div className="absolute top-2 right-2 flex items-center gap-1 opacity-0 group-hover/img:opacity-100 transition-opacity bg-slate-900/60 backdrop-blur-xs p-1 rounded-xl">
            <button
              onClick={() => setIsModalOpen(true)}
              className="p-1 text-white hover:text-slate-200"
              title="Expand Image"
            >
              <ExternalLink className="h-3.5 w-3.5" />
            </button>
            <a
              href={fullUrl}
              download={attachment.name}
              rel="noopener noreferrer"
              className="p-1 text-white hover:text-slate-200"
              title="Download Image"
            >
              <Download className="h-3.5 w-3.5" />
            </a>
          </div>
        </div>

        {/* Lightbox Modal */}
        {isModalOpen && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-xs p-4 animate-in fade-in duration-200"
            onClick={() => setIsModalOpen(false)}
          >
            <button
              onClick={() => setIsModalOpen(false)}
              className="absolute top-4 right-4 rounded-full bg-white/10 p-2 text-white hover:bg-white/20 transition-colors"
              aria-label="Close image preview"
            >
              <X className="h-6 w-6" />
            </button>
            <img
              src={fullUrl}
              alt={attachment.name}
              className="max-h-[85vh] max-w-[90vw] rounded-xl object-contain shadow-2xl"
              onClick={(e) => e.stopPropagation()}
              referrerPolicy="no-referrer"
            />
          </div>
        )}
      </>
    );
  }

  // Non-image file card
  return (
    <div className="mt-2 flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-3 max-w-sm shadow-2xs hover:bg-slate-50 transition-colors">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
        <FileText className="h-5 w-5" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-semibold text-slate-800 truncate" title={attachment.name}>
          {attachment.name}
        </p>
        <p className="text-[10px] text-slate-400">
          {attachment.size ? formatBytes(attachment.size) : 'Attachment'}
        </p>
      </div>
      <a
        href={fullUrl}
        download={attachment.name}
        rel="noopener noreferrer"
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 hover:bg-indigo-50 hover:text-indigo-600 transition-colors"
        title="Download"
      >
        <Download className="h-4 w-4" />
      </a>
    </div>
  );
}
