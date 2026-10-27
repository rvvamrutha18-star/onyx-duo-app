'use client';
import dynamic from 'next/dynamic';
import { useCallback, useEffect, useState } from 'react';
import { ExternalLink, PlaneTakeoff, Plus, Search, ShieldAlert, Wrench, CheckCircle2, Boxes } from 'lucide-react';
import { api } from '@/lib/api';
import { PROGRAM_ID } from '@/lib/onchain';
import { explorerAddr, shorten, STATUS_LABEL, STATUSES, type ActivityRec, type ComponentRec, type Stats, type Status } from '@/lib/types';
import { OnchainBadge, StatusBadge } from '@/components/Badges';
import Notice, { type NoticeState } from '@/components/Notice';
import RegisterForm from '@/components/RegisterForm';
import ComponentDetail from '@/components/ComponentDetail';
import ActivityPanel from '@/components/ActivityPanel';

const WalletMultiButton = dynamic(() => import('@solana/wallet-adapter-react-ui').then((m) => m.WalletMultiButton), { ssr: false });

export default function Home() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [items, setItems] = useState<ComponentRec[]>([]);
  const [all, setAll] = useState<ComponentRec[]>([]);
  const [activity, setActivity] = useState<ActivityRec[]>([]);
  const [q, setQ] = useState('');
  const [status, setStatus] = useState<'' | Status>('');
  const [mfr, setMfr] = useState('');
  const [selected, setSelected] = useState<string | null>(null);
  const [showReg, setShowReg] = useState(false);
  const [notice, setNotice] = useState<NoticeState | null>(null);
  const [backendError, setBackendError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (q.trim()) params.set('q', q.trim());
      if (status) params.set('status', status);
      if (mfr) params.set('manufacturer', mfr);
      const [s, list, every, act] = await Promise.all([
        api<Stats>('/stats'), api<ComponentRec[]>(`/components?${params}`), api<ComponentRec[]>('/components'), api<ActivityRec[]>('/activity?limit=12'),
      ]);
      setStats(s); setItems(list); setAll(every); setActivity(act); setBackendError(null);
    } catch (e) { setBackendError((e as Error).message); }
    finally { setLoading(false); }
  }, [q, status, mfr]);

  useEffect(() => { const t = setTimeout(refresh, 250); return () => clearTimeout(t); }, [refresh]);

  const manufacturers = Array.from(new Set(all.map((c) => c.manufacturer))).sort();
  const cards: { label: string; value: number; icon: React.ReactNode; tone: string }[] = [
    { label: 'Registered components', value: stats?.total ?? 0, icon: <Boxes size={18} />, tone: 'text-steel-300' },
    { label: 'In service', value: stats?.byStatus.IN_SERVICE ?? 0, icon: <CheckCircle2 size={18} />, tone: 'text-emerald-300' },
    { label: 'Under maintenance', value: stats?.byStatus.UNDER_MAINTENANCE ?? 0, icon: <Wrench size={18} />, tone: 'text-amber-300' },
    { label: 'Quarantined', value: stats?.byStatus.QUARANTINED ?? 0, icon: <ShieldAlert size={18} />, tone: 'text-red-300' },
  ];

  return (
    <main className="mx-auto max-w-7xl px-4 py-6">
      <header className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <PlaneTakeoff className="text-steel-400" size={30} />
          <div>
            <h1 className="text-2xl font-extrabold tracking-wide">ONYX DUO</h1>
            <p className="text-xs text-steel-300">Aviation supply-chain traceability · Solana Devnet prototype</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3 text-xs text-slate-300">
          <a href={explorerAddr(PROGRAM_ID.toBase58())} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 rounded-full border border-navy-600 px-3 py-1 hover:bg-navy-700">
            Program {shorten(PROGRAM_ID.toBase58(), 4)} <ExternalLink size={11} />
          </a>
          <WalletMultiButton />
        </div>
      </header>

      {backendError && (
        <div role="alert" className="mb-4 rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-200">{backendError}</div>
      )}
      <Notice notice={notice} onClose={() => setNotice(null)} />

      <section className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4" aria-label="Fleet summary">
        {cards.map((c) => (
          <div key={c.label} className="card p-4">
            <div className={`flex items-center gap-2 text-xs font-semibold uppercase tracking-wide ${c.tone}`}>{c.icon}{c.label}</div>
            <div className="mt-2 text-3xl font-extrabold">{loading ? '-' : c.value}</div>
          </div>
        ))}
      </section>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <div>
            <button className="btn-ghost" onClick={() => setShowReg((v) => !v)}><Plus size={16} /> {showReg ? 'Hide registration form' : 'Register a component'}</button>
            {showReg && <div className="mt-3"><RegisterForm notify={setNotice} onDone={(id) => { setShowReg(false); setSelected(id); refresh(); }} /></div>}
          </div>

          <section className="card p-5" aria-label="Component registry">
            <div className="mb-4 grid gap-3 sm:grid-cols-3">
              <div className="relative sm:col-span-1">
                <Search size={14} className="absolute left-3 top-3 text-slate-500" />
                <input aria-label="Search components" className="input pl-8" placeholder="ID, serial, manufacturer" value={q} onChange={(e) => setQ(e.target.value)} />
              </div>
              <select aria-label="Filter by status" className="input" value={status} onChange={(e) => setStatus(e.target.value as '' | Status)}>
                <option value="">All statuses</option>
                {STATUSES.map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
              </select>
              <select aria-label="Filter by manufacturer" className="input" value={mfr} onChange={(e) => setMfr(e.target.value)}>
                <option value="">All manufacturers</option>
                {manufacturers.map((m) => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="text-xs uppercase tracking-wide text-steel-300">
                  <tr><th className="py-2 pr-3">Component</th><th className="pr-3">Serial</th><th className="pr-3">Manufacturer</th><th className="pr-3">Status</th><th className="pr-3">Maint.</th><th>Record</th></tr>
                </thead>
                <tbody>
                  {items.map((c) => (
                    <tr key={c.id} onClick={() => setSelected(c.id)} className={`cursor-pointer border-t border-navy-700 hover:bg-navy-700/60 ${selected === c.id ? 'bg-navy-700/80' : ''}`}>
                      <td className="py-2 pr-3 font-semibold"><button className="text-left underline-offset-2 hover:underline" onClick={() => setSelected(c.id)}>{c.id}</button></td>
                      <td className="pr-3 text-slate-300">{c.serialNumber}</td>
                      <td className="pr-3 text-slate-300">{c.manufacturer}</td>
                      <td className="pr-3"><StatusBadge status={c.status} /></td>
                      <td className="pr-3">{c._count?.maintenance ?? 0}</td>
                      <td><OnchainBadge verified={c.onchainVerified} signature={c.onchainSignature} compact /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {!loading && items.length === 0 && !backendError && <p className="py-6 text-center text-sm text-slate-400">No components match. Register one or run <code>npm run seed</code> in backend.</p>}
            </div>
          </section>
        </div>

        <div className="space-y-6">
          {selected ? <ComponentDetail id={selected} notify={setNotice} onChanged={refresh} /> : <section className="card p-5 text-sm text-slate-400">Select a component to see its lifecycle, maintenance history and live on-chain state.</section>}
          <ActivityPanel items={activity} />
        </div>
      </div>

      <footer className="mt-8 border-t border-navy-700 pt-4 text-xs text-slate-500">
        Prototype on Solana Devnet. Rows labelled &quot;Off-chain prototype record&quot; exist only in the local SQLite database; DEMO-* rows are mock data. Not for real airworthiness decisions.
      </footer>
    </main>
  );
}
