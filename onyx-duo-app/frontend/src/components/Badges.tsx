import { ExternalLink, ShieldCheck, Database } from 'lucide-react';
import { explorerTx, STATUS_LABEL, type Status } from '@/lib/types';

const COLORS: Record<Status, string> = {
  REGISTERED: 'bg-steel-500/20 text-steel-300 ring-steel-500/40',
  IN_SERVICE: 'bg-emerald-500/15 text-emerald-300 ring-emerald-500/30',
  UNDER_MAINTENANCE: 'bg-amber-500/15 text-amber-300 ring-amber-500/40',
  QUARANTINED: 'bg-red-500/15 text-red-300 ring-red-500/40',
  RETIRED: 'bg-slate-500/20 text-slate-300 ring-slate-500/40',
};

export function StatusBadge({ status }: { status: Status }) {
  return <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ${COLORS[status]}`}>{STATUS_LABEL[status]}</span>;
}

/** "On-chain confirmed" is shown ONLY when the backend verified the signature on Devnet. */
export function OnchainBadge({ verified, signature, compact = false }: { verified: boolean; signature: string | null; compact?: boolean }) {
  if (compact) {
    return verified ? (
      <span className="inline-flex items-center gap-1 rounded-full bg-steel-500/20 px-2 py-0.5 text-xs font-semibold text-steel-300 ring-1 ring-steel-500/40"><ShieldCheck size={12} /> On-chain</span>
    ) : (
      <span className="inline-flex items-center gap-1 rounded-full bg-slate-500/15 px-2 py-0.5 text-xs font-medium text-slate-300 ring-1 ring-slate-500/30"><Database size={12} /> Off-chain</span>
    );
  }
  if (verified && signature) {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs">
        <span className="inline-flex items-center gap-1 rounded-full bg-steel-500/20 px-2 py-0.5 font-semibold text-steel-300 ring-1 ring-steel-500/40">
          <ShieldCheck size={12} /> On-chain confirmed
        </span>
        <a href={explorerTx(signature)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-steel-400 underline hover:text-steel-300">
          Explorer <ExternalLink size={11} />
        </a>
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-slate-500/15 px-2 py-0.5 text-xs font-medium text-slate-300 ring-1 ring-slate-500/30">
      <Database size={12} /> Off-chain prototype record{signature ? ' (signature not verified)' : ''}
    </span>
  );
}
