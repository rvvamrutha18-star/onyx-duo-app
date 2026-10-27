import { ExternalLink, X } from 'lucide-react';
import { explorerTx } from '@/lib/types';

export interface NoticeState { kind: 'ok' | 'err' | 'info'; text: string; sig?: string }

export default function Notice({ notice, onClose }: { notice: NoticeState | null; onClose: () => void }) {
  if (!notice) return null;
  const tone = notice.kind === 'ok' ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-200'
    : notice.kind === 'err' ? 'border-red-500/40 bg-red-500/10 text-red-200' : 'border-steel-500/40 bg-steel-500/10 text-steel-300';
  return (
    <div role="status" className={`mb-4 flex items-start justify-between gap-3 rounded-lg border px-4 py-3 text-sm ${tone}`}>
      <div>
        {notice.text}
        {notice.sig && (
          <a href={explorerTx(notice.sig)} target="_blank" rel="noreferrer" className="ml-2 inline-flex items-center gap-1 underline">
            View transaction <ExternalLink size={12} />
          </a>
        )}
      </div>
      <button onClick={onClose} aria-label="Dismiss"><X size={16} /></button>
    </div>
  );
}
