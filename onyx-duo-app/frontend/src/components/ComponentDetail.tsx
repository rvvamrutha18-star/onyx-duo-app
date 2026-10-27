'use client';
import { useCallback, useEffect, useState } from 'react';
import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import { AlertTriangle, ExternalLink, Link2, Wrench } from 'lucide-react';
import { api } from '@/lib/api';
import {
  byteLen, explainError, fetchOnchainComponent, fetchOnchainRecords, maintenanceIx, sendAndConfirm, statusIx,
  type OnchainComponent, type OnchainRecord,
} from '@/lib/onchain';
import {
  explorerAddr, RESULT_LABEL, RESULTS, shorten, STATUS_LABEL, STATUSES,
  type ComponentRec, type InspectionResult, type OnchainResult, type Status,
} from '@/lib/types';
import { OnchainBadge, StatusBadge } from './Badges';
import type { NoticeState } from './Notice';

const localInput = (d: Date) => new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
interface ChainState { comp: OnchainComponent | null; records: OnchainRecord[]; error?: string }

export default function ComponentDetail({ id, onChanged, notify }: { id: string; onChanged: () => void; notify: (n: NoticeState) => void }) {
  const { connection } = useConnection();
  const { publicKey, sendTransaction } = useWallet();
  const [comp, setComp] = useState<ComponentRec | null>(null);
  const [chain, setChain] = useState<ChainState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<'status' | 'maint' | null>(null);
  const [newStatus, setNewStatus] = useState<Status>('IN_SERVICE');
  const [statusChain, setStatusChain] = useState(true);
  const [m, setM] = useState({ tech: '', result: 'PASS' as InspectionResult, notes: '', time: localInput(new Date()), chain: true });

  const loadChain = useCallback(async (c: ComponentRec) => {
    if (!c.onchainVerified) { setChain(null); return; }
    try {
      const oc = await fetchOnchainComponent(connection, c.id);
      const records = oc ? await fetchOnchainRecords(connection, c.id, oc.maintenanceCount) : [];
      setChain({ comp: oc, records });
    } catch (e) { setChain({ comp: null, records: [], error: explainError(e) }); }
  }, [connection]);

  const load = useCallback(async () => {
    try {
      const c = await api<ComponentRec>(`/components/${encodeURIComponent(id)}`);
      setComp(c); setError(null); loadChain(c);
    } catch (e) { setError((e as Error).message); }
  }, [id, loadChain]);

  useEffect(() => { setComp(null); setChain(null); load(); }, [load]);
  useEffect(() => { if (publicKey && !m.tech) setM((x) => ({ ...x, tech: publicKey.toBase58() })); }, [publicKey]); // eslint-disable-line react-hooks/exhaustive-deps

  if (error) return <section className="card p-5 text-sm text-red-300">{error}</section>;
  if (!comp) return <section className="card p-5 text-sm text-slate-400">Loading component...</section>;

  const options = STATUSES.filter((s) => s !== comp.status);
  const effective = options.includes(newStatus) ? newStatus : options[0];
  const retired = comp.status === 'RETIRED';
  const canChain = comp.onchainVerified && !!publicKey;

  async function changeStatus() {
    if (!comp) return;
    setBusy('status');
    let sig: string | undefined;
    try {
      if (canChain && statusChain && publicKey) {
        const oc = await fetchOnchainComponent(connection, comp.id);
        if (!oc) throw new Error('Component account not found on-chain');
        if (oc.authority !== publicKey.toBase58()) throw new Error(`Connected wallet is not this component's on-chain authority (${shorten(oc.authority)})`);
        sig = await sendAndConfirm(connection, sendTransaction, publicKey, [statusIx(publicKey, comp.id, effective)]);
      }
      let res: { onchain: OnchainResult | null };
      try { res = await api(`/components/${comp.id}/status`, { method: 'PATCH', body: { status: effective, onchainSignature: sig } }); }
      catch (e) { throw new Error(sig ? `On-chain transaction succeeded but saving to the database failed: ${(e as Error).message}` : (e as Error).message); }
      if (sig && res.onchain?.verified) notify({ kind: 'ok', text: `Status set to ${STATUS_LABEL[effective]}. On-chain confirmed.`, sig });
      else if (sig) notify({ kind: 'info', text: `Status saved off-chain; the backend could not verify the transaction yet: ${res.onchain?.error ?? 'unknown'}`, sig });
      else notify({ kind: 'ok', text: `Status set to ${STATUS_LABEL[effective]} (off-chain prototype record).` });
      await load(); onChanged();
    } catch (e) { notify({ kind: 'err', text: explainError(e), sig }); }
    finally { setBusy(null); }
  }

  async function addMaintenance(e: React.FormEvent) {
    e.preventDefault();
    if (!comp) return;
    setBusy('maint');
    let sig: string | undefined;
    try {
      const notes = m.notes.trim();
      if (notes.length < 3) throw new Error('Notes are required (min 3 characters)');
      if (byteLen(notes) > 200) throw new Error('Notes are too long (max 200 bytes)');
      const when = new Date(m.time);
      if (isNaN(when.getTime())) throw new Error('Enter a valid timestamp');
      if (!m.tech.trim()) throw new Error('Technician wallet address is required');
      if (canChain && m.chain && publicKey) {
        if (m.tech.trim() !== publicKey.toBase58()) throw new Error('For an on-chain record the technician address must be the connected wallet, because that wallet signs the transaction');
        const oc = await fetchOnchainComponent(connection, comp.id);
        if (!oc) throw new Error('Component account not found on-chain');
        sig = await sendAndConfirm(connection, sendTransaction, publicKey, [maintenanceIx(publicKey, comp.id, oc.maintenanceCount, m.result, notes)]);
      }
      let res: { onchain: OnchainResult | null };
      try {
        res = await api(`/components/${comp.id}/maintenance`, {
          method: 'POST',
          body: { technicianWallet: m.tech.trim(), inspectionResult: m.result, notes, timestamp: when.toISOString(), onchainSignature: sig },
        });
      } catch (err) { throw new Error(sig ? `On-chain transaction succeeded but saving to the database failed: ${(err as Error).message}` : (err as Error).message); }
      if (sig && res.onchain?.verified) notify({ kind: 'ok', text: 'Maintenance recorded. On-chain confirmed.', sig });
      else if (sig) notify({ kind: 'info', text: `Maintenance saved off-chain; the backend could not verify the transaction yet: ${res.onchain?.error ?? 'unknown'}`, sig });
      else notify({ kind: 'ok', text: 'Maintenance saved as an off-chain prototype record.' });
      setM((x) => ({ ...x, notes: '', time: localInput(new Date()) }));
      await load(); onChanged();
    } catch (err) { notify({ kind: 'err', text: explainError(err), sig }); }
    finally { setBusy(null); }
  }

  const statusMismatch = chain?.comp && chain.comp.status !== comp.status;

  return (
    <section className="card p-5" aria-label="Component detail">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="text-xl font-bold">{comp.id}</h2>
          <p className="text-sm text-slate-400">{comp.manufacturer} · {comp.partNumber}</p>
        </div>
        <StatusBadge status={comp.status} />
      </div>
      <div className="mt-2"><OnchainBadge verified={comp.onchainVerified} signature={comp.onchainSignature} /></div>

      <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
        <div><dt className="label">Serial number</dt><dd>{comp.serialNumber}</dd></div>
        <div><dt className="label">Aircraft / model</dt><dd>{comp.aircraftModel}</dd></div>
        <div><dt className="label">Registered</dt><dd>{new Date(comp.createdAt).toLocaleString()}</dd></div>
        <div><dt className="label">Updated</dt><dd>{new Date(comp.updatedAt).toLocaleString()}</dd></div>
        {comp.onchainAddress && (
          <div className="col-span-2">
            <dt className="label">On-chain account (PDA)</dt>
            <dd><a className="inline-flex items-center gap-1 text-steel-400 underline" href={explorerAddr(comp.onchainAddress)} target="_blank" rel="noreferrer">{shorten(comp.onchainAddress, 8)} <ExternalLink size={11} /></a></dd>
          </div>
        )}
      </dl>

      {comp.onchainVerified && (
        <div className="mt-4 rounded-lg border border-navy-600 bg-navy-900/60 p-3 text-sm">
          <div className="mb-1 flex items-center gap-2 font-semibold"><Link2 size={14} className="text-steel-400" /> Live on-chain state (read from Devnet just now)</div>
          {!chain && <p className="text-slate-400">Reading Devnet...</p>}
          {chain?.error && <p className="text-red-300">{chain.error}</p>}
          {chain && !chain.error && !chain.comp && <p className="text-amber-300">Account not found on Devnet.</p>}
          {chain?.comp && (
            <>
              <p className="text-slate-300">Status: <b>{STATUS_LABEL[chain.comp.status]}</b> · Maintenance records: <b>{chain.comp.maintenanceCount}</b> · Authority: {shorten(chain.comp.authority, 6)}</p>
              {statusMismatch && <p className="mt-1 flex items-center gap-1 text-amber-300"><AlertTriangle size={14} /> Database status differs from the on-chain status.</p>}
              <ul className="mt-2 space-y-1 text-xs text-slate-300">
                {chain.records.map((r) => (
                  <li key={r.address}>#{r.index} · {RESULT_LABEL[r.result]} · {new Date(r.timestamp * 1000).toLocaleString()} · tech {shorten(r.technician)} · {r.notes}</li>
                ))}
              </ul>
            </>
          )}
        </div>
      )}

      <div className="mt-5 border-t border-navy-600 pt-4">
        <h3 className="mb-2 text-sm font-semibold">Change status</h3>
        {retired ? <p className="text-sm text-slate-400">Retired components are final.</p> : (
          <div className="flex flex-wrap items-center gap-2">
            <select aria-label="New status" className="input w-auto" value={effective} onChange={(e) => setNewStatus(e.target.value as Status)}>
              {options.map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
            </select>
            <button className="btn" onClick={changeStatus} disabled={busy !== null}>{busy === 'status' ? 'Working...' : canChain && statusChain ? 'Update on-chain' : 'Update (off-chain)'}</button>
          </div>
        )}
        {comp.onchainVerified && !retired && (
          <label className="mt-2 flex items-center gap-2 text-xs text-slate-300">
            <input type="checkbox" checked={statusChain} onChange={(e) => setStatusChain(e.target.checked)} disabled={!publicKey} /> Sign on-chain (only the registering wallet is allowed)
          </label>
        )}
      </div>

      {!retired && (
        <form onSubmit={addMaintenance} className="mt-5 border-t border-navy-600 pt-4" aria-label="Record maintenance">
          <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold"><Wrench size={14} className="text-steel-400" /> Record maintenance</h3>
          <div className="grid gap-3">
            <div>
              <label className="label" htmlFor="m-tech">Technician wallet address</label>
              <input id="m-tech" className="input font-mono text-xs" value={m.tech} onChange={(e) => setM({ ...m, tech: e.target.value })} placeholder="Connect a wallet to autofill" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label" htmlFor="m-res">Inspection result</label>
                <select id="m-res" className="input" value={m.result} onChange={(e) => setM({ ...m, result: e.target.value as InspectionResult })}>
                  {RESULTS.map((r) => <option key={r} value={r}>{RESULT_LABEL[r]}</option>)}
                </select>
              </div>
              <div>
                <label className="label" htmlFor="m-time">Timestamp</label>
                <input id="m-time" type="datetime-local" className="input" value={m.time} onChange={(e) => setM({ ...m, time: e.target.value })} />
              </div>
            </div>
            <div>
              <label className="label" htmlFor="m-notes">Notes (max 200 bytes)</label>
              <textarea id="m-notes" className="input" rows={3} maxLength={200} value={m.notes} onChange={(e) => setM({ ...m, notes: e.target.value })} />
            </div>
          </div>
          {comp.onchainVerified && (
            <label className="mt-2 flex items-center gap-2 text-xs text-slate-300">
              <input type="checkbox" checked={m.chain} onChange={(e) => setM({ ...m, chain: e.target.checked })} disabled={!publicKey} />
              Sign on-chain (technician = connected wallet; the on-chain timestamp is the Solana clock, not the field above)
            </label>
          )}
          <button className="btn mt-3" disabled={busy !== null}>{busy === 'maint' ? 'Working...' : canChain && m.chain ? 'Record on-chain' : 'Save off-chain record'}</button>
        </form>
      )}

      <div className="mt-5 border-t border-navy-600 pt-4">
        <h3 className="mb-2 text-sm font-semibold">Maintenance history ({comp.maintenance?.length ?? 0})</h3>
        {!comp.maintenance?.length && <p className="text-sm text-slate-400">No maintenance recorded yet.</p>}
        <ol className="space-y-3">
          {comp.maintenance?.map((r) => (
            <li key={r.id} className="rounded-lg border border-navy-600 bg-navy-900/50 p-3 text-sm">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <b className={r.inspectionResult === 'PASS' ? 'text-emerald-300' : r.inspectionResult === 'FAIL' ? 'text-red-300' : 'text-amber-300'}>{RESULT_LABEL[r.inspectionResult]}</b>
                <time className="text-xs text-slate-400">{new Date(r.timestamp).toLocaleString()}</time>
              </div>
              <p className="mt-1 text-slate-200">{r.notes}</p>
              <p className="mt-1 font-mono text-xs text-slate-400">Technician {shorten(r.technicianWallet, 6)}</p>
              <div className="mt-1"><OnchainBadge verified={r.onchainVerified} signature={r.onchainSignature} /></div>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
