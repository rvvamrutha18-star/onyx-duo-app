import { Activity } from 'lucide-react';
import { OnchainBadge } from './Badges';
import type { ActivityRec } from '@/lib/types';

export default function ActivityPanel({ items }: { items: ActivityRec[] }) {
  return (
    <section className="card p-5" aria-label="Blockchain activity">
      <h2 className="mb-3 flex items-center gap-2 text-lg font-semibold"><Activity size={18} className="text-steel-400" /> Recent activity</h2>
      {items.length === 0 && <p className="text-sm text-slate-400">No activity yet.</p>}
      <ul className="space-y-3">
        {items.map((a) => (
          <li key={a.id} className="border-l-2 border-navy-600 pl-3 text-sm">
            <div className="text-slate-100">{a.message}</div>
            <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-400">
              <time>{new Date(a.createdAt).toLocaleString()}</time>
              <OnchainBadge verified={a.verified} signature={a.signature} />
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
