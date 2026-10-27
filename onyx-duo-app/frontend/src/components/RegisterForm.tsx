'use client';
import { useState } from 'react';
import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import { Plane } from 'lucide-react';
import { api } from '@/lib/api';
import { byteLen, explainError, fetchOnchainComponent, registerIx, sendAndConfirm } from '@/lib/onchain';
import type { ComponentRec, OnchainResult } from '@/lib/types';
import type { NoticeState } from './Notice';

const EMPTY = { id: '', manufacturer: '', partNumber: '', serialNumber: '', aircraftModel: '' };
const LIMITS: Record<keyof typeof EMPTY, number> = { id: 32, manufacturer: 48, partNumber: 32, serialNumber: 48, aircraftModel: 48 };
const LABELS: Record<keyof typeof EMPTY, string> = { id: 'Component ID', manufacturer: 'Manufacturer', partNumber: 'Part number', serialNumber: 'Serial number', aircraftModel: 'Aircraft / model' };

export default function RegisterForm({ onDone, notify }: { onDone: (id: string) => void; notify: (n: NoticeState) => void }) {
  const { connection } = useConnection();
  const { publicKey, sendTransaction } = useWallet();
  const [f, setF] = useState(EMPTY);
  const [onchain, setOnchain] = useState(true);
  const [busy, setBusy] = useState(false);
  const useChain = onchain && !!publicKey;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    let sig: string | undefined;
    try {
      const v = Object.fromEntries(Object.entries(f).map(([k, x]) => [k, x.trim()])) as typeof EMPTY;
      for (const k of Object.keys(LIMITS) as (keyof typeof EMPTY)[]) {
        if (v[k].length < 2) throw new Error(`${LABELS[k]} is required (min 2 characters)`);
        if (byteLen(v[k]) > LIMITS[k]) throw new Error(`${LABELS[k]} is too long (max ${LIMITS[k]} bytes)`);
      }
      if (!/^[A-Za-z0-9_-]+$/.test(v.id)) throw new Error('Component ID: letters, digits, - and _ only');

      const chk = await api<{ idTaken: boolean; serialTaken: boolean }>(`/components/check?id=${encodeURIComponent(v.id)}&serial=${encodeURIComponent(v.serialNumber)}`);
      if (chk.idTaken) throw new Error(`Component ID ${v.id} already exists`);
      if (chk.serialTaken) throw new Error(`Serial number ${v.serialNumber} is already registered`);

      if (useChain && publicKey) {
        if (await fetchOnchainComponent(connection, v.id)) throw new Error(`${v.id} is already registered on-chain`);
        sig = await sendAndConfirm(connection, sendTransaction, publicKey, [registerIx(publicKey, v)]);
      }
      let res: { component: ComponentRec; onchain: OnchainResult | null };
      try {
        res = await api('/components', { method: 'POST', body: { ...v, onchainSignature: sig } });
      } catch (err) {
        throw new Error(sig ? `On-chain transaction succeeded but saving to the database failed: ${(err as Error).message}` : (err as Error).message);
      }
      if (sig && res.onchain?.verified) notify({ kind: 'ok', text: `${v.id} registered. On-chain confirmed.`, sig });
      else if (sig) notify({ kind: 'info', text: `${v.id} saved as an off-chain prototype record. The backend could not verify the transaction yet: ${res.onchain?.error ?? 'unknown'}`, sig });
      else notify({ kind: 'ok', text: `${v.id} saved as an off-chain prototype record (no wallet transaction).` });
      setF(EMPTY);
      onDone(v.id);
    } catch (err) {
      notify({ kind: 'err', text: explainError(err), sig });
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="card p-5" aria-label="Register component">
      <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold"><Plane size={18} className="text-steel-400" /> Register component</h2>
      <div className="grid gap-3 sm:grid-cols-2">
        {(Object.keys(EMPTY) as (keyof typeof EMPTY)[]).map((k) => (
          <div key={k}>
            <label className="label" htmlFor={`r-${k}`}>{LABELS[k]}</label>
            <input id={`r-${k}`} className="input" value={f[k]} maxLength={LIMITS[k]} onChange={(e) => setF({ ...f, [k]: e.target.value })} placeholder={k === 'id' ? 'e.g. ENG-0001' : ''} />
          </div>
        ))}
      </div>
      <label className="mt-4 flex items-center gap-2 text-sm text-slate-300">
        <input type="checkbox" checked={onchain} onChange={(e) => setOnchain(e.target.checked)} disabled={!publicKey} />
        Also record on Solana Devnet (you sign in your wallet; costs a little Devnet SOL)
      </label>
      {!publicKey && <p className="mt-1 text-xs text-slate-400">Connect a wallet to enable on-chain registration. Without one, this saves an off-chain prototype record only.</p>}
      <button className="btn mt-4" disabled={busy}>{busy ? 'Working... check your wallet' : useChain ? 'Register on-chain' : 'Save off-chain record'}</button>
    </form>
  );
}
