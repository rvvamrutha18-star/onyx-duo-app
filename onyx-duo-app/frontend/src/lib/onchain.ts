// Hand-written client for the ONYX registry program (anchor/lib.rs). No IDL needed: instruction and account
// layouts below mirror the Rust code exactly. If you change the program, change this file too.
import { Connection, PublicKey, SystemProgram, Transaction, TransactionInstruction } from '@solana/web3.js';
import type { WalletContextState } from '@solana/wallet-adapter-react';
import type { InspectionResult, Status } from './types';

export const RPC_URL = process.env.NEXT_PUBLIC_SOLANA_RPC_URL ?? 'https://api.devnet.solana.com';
export const PROGRAM_ID = new PublicKey(process.env.NEXT_PUBLIC_PROGRAM_ID ?? 'FMZsoKzQoF7JtZmFd9pzBKkB8xY1aRi11689rXc8bFbQ');

// Anchor discriminators = first 8 bytes of sha256("global:<ix>") / sha256("account:<Name>")
const D = {
  register_component: [66, 171, 91, 92, 162, 54, 221, 194],
  record_maintenance: [51, 199, 252, 217, 223, 87, 87, 195],
  update_status: [147, 215, 74, 174, 55, 191, 42, 0],
  Component: [181, 150, 112, 185, 188, 5, 202, 239],
  MaintenanceRecord: [39, 242, 23, 105, 219, 98, 100, 127],
};

export const STATUS_CODE: Record<Status, number> = { REGISTERED: 0, IN_SERVICE: 1, UNDER_MAINTENANCE: 2, QUARANTINED: 3, RETIRED: 4 };
const STATUS_BY_CODE: Status[] = ['REGISTERED', 'IN_SERVICE', 'UNDER_MAINTENANCE', 'QUARANTINED', 'RETIRED'];
export const RESULT_CODE: Record<InspectionResult, number> = { PASS: 0, FAIL: 1, ACTION_REQUIRED: 2 };
const RESULT_BY_CODE: InspectionResult[] = ['PASS', 'FAIL', 'ACTION_REQUIRED'];

const enc = new TextEncoder();
const dec = new TextDecoder();
export const byteLen = (s: string) => enc.encode(s).length;

const concat = (...parts: Uint8Array[]) => {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let o = 0;
  for (const p of parts) { out.set(p, o); o += p.length; }
  return out;
};
const u32 = (n: number) => { const b = new Uint8Array(4); new DataView(b.buffer).setUint32(0, n, true); return b; };
const u8 = (n: number) => Uint8Array.of(n);
const str = (s: string) => { const e = enc.encode(s); return concat(u32(e.length), e); };

export const componentPda = (id: string) =>
  PublicKey.findProgramAddressSync([enc.encode('component'), enc.encode(id)], PROGRAM_ID)[0];
export const recordPda = (component: PublicKey, index: number) =>
  PublicKey.findProgramAddressSync([enc.encode('maintenance'), component.toBytes(), u32(index)], PROGRAM_ID)[0];

// ---------- instructions ----------
export function registerIx(authority: PublicKey, f: { id: string; manufacturer: string; partNumber: string; serialNumber: string; aircraftModel: string }) {
  const data = concat(Uint8Array.from(D.register_component), str(f.id), str(f.manufacturer), str(f.partNumber), str(f.serialNumber), str(f.aircraftModel));
  return new TransactionInstruction({
    programId: PROGRAM_ID,
    keys: [
      { pubkey: componentPda(f.id), isSigner: false, isWritable: true },
      { pubkey: authority, isSigner: true, isWritable: true },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    data: Buffer.from(data),
  });
}

export function maintenanceIx(technician: PublicKey, id: string, index: number, result: InspectionResult, notes: string) {
  const comp = componentPda(id);
  const data = concat(Uint8Array.from(D.record_maintenance), str(id), u8(RESULT_CODE[result]), str(notes));
  return new TransactionInstruction({
    programId: PROGRAM_ID,
    keys: [
      { pubkey: comp, isSigner: false, isWritable: true },
      { pubkey: recordPda(comp, index), isSigner: false, isWritable: true },
      { pubkey: technician, isSigner: true, isWritable: true },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    data: Buffer.from(data),
  });
}

export function statusIx(authority: PublicKey, id: string, status: Status) {
  const data = concat(Uint8Array.from(D.update_status), str(id), u8(STATUS_CODE[status]));
  return new TransactionInstruction({
    programId: PROGRAM_ID,
    keys: [
      { pubkey: componentPda(id), isSigner: false, isWritable: true },
      { pubkey: authority, isSigner: true, isWritable: false },
    ],
    data: Buffer.from(data),
  });
}

/** Signs in the user's wallet, sends, waits for 'confirmed', and returns the real signature. Throws on any failure. */
export async function sendAndConfirm(
  connection: Connection, sendTransaction: WalletContextState['sendTransaction'], feePayer: PublicKey, ixs: TransactionInstruction[],
): Promise<string> {
  const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('confirmed');
  const tx = new Transaction({ feePayer, blockhash, lastValidBlockHeight }).add(...ixs);
  const signature = await sendTransaction(tx, connection);
  const res = await connection.confirmTransaction({ signature, blockhash, lastValidBlockHeight }, 'confirmed');
  if (res.value.err) throw new Error(`Transaction failed on-chain: ${JSON.stringify(res.value.err)} (${signature})`);
  return signature;
}

// ---------- reading real on-chain data ----------
function reader(data: Uint8Array) {
  const dv = new DataView(data.buffer, data.byteOffset, data.byteLength);
  let o = 8; // skip discriminator
  return {
    pk() { const k = new PublicKey(data.slice(o, o + 32)); o += 32; return k; },
    str() { const n = dv.getUint32(o, true); o += 4; const v = dec.decode(data.slice(o, o + n)); o += n; return v; },
    u8() { return data[o++]; },
    u32() { const v = dv.getUint32(o, true); o += 4; return v; },
    i64() { const v = Number(dv.getBigInt64(o, true)); o += 8; return v; },
  };
}
const hasDisc = (data: Uint8Array, disc: number[]) => disc.every((b, i) => data[i] === b);

export interface OnchainComponent {
  address: string; authority: string; componentId: string; manufacturer: string; partNumber: string; serialNumber: string;
  aircraftModel: string; status: Status; maintenanceCount: number; createdAt: number; updatedAt: number;
}
export interface OnchainRecord { address: string; index: number; technician: string; result: InspectionResult; notes: string; timestamp: number }

export async function fetchOnchainComponent(conn: Connection, id: string): Promise<OnchainComponent | null> {
  const address = componentPda(id);
  const info = await conn.getAccountInfo(address, 'confirmed');
  if (!info) return null;
  if (!info.owner.equals(PROGRAM_ID) || !hasDisc(info.data, D.Component)) throw new Error('Account is not an ONYX component');
  const r = reader(info.data);
  const authority = r.pk().toBase58(); const componentId = r.str(); const manufacturer = r.str(); const partNumber = r.str();
  const serialNumber = r.str(); const aircraftModel = r.str(); const status = STATUS_BY_CODE[r.u8()] ?? 'REGISTERED';
  const maintenanceCount = r.u32(); const createdAt = r.i64(); const updatedAt = r.i64();
  return { address: address.toBase58(), authority, componentId, manufacturer, partNumber, serialNumber, aircraftModel, status, maintenanceCount, createdAt, updatedAt };
}

export async function fetchOnchainRecords(conn: Connection, id: string, count: number): Promise<OnchainRecord[]> {
  if (count <= 0) return [];
  const comp = componentPda(id);
  const from = Math.max(0, count - 50);
  const keys: PublicKey[] = [];
  for (let i = from; i < count; i++) keys.push(recordPda(comp, i));
  const infos = await conn.getMultipleAccountsInfo(keys, 'confirmed');
  const out: OnchainRecord[] = [];
  infos.forEach((info, k) => {
    if (!info || !hasDisc(info.data, D.MaintenanceRecord)) return;
    const r = reader(info.data);
    r.pk(); const index = r.u32(); const technician = r.pk().toBase58(); const result = RESULT_BY_CODE[r.u8()] ?? 'PASS';
    const notes = r.str(); const timestamp = r.i64();
    out.push({ address: keys[k].toBase58(), index, technician, result, notes, timestamp });
  });
  return out.reverse();
}

// ---------- readable errors ----------
const PROGRAM_ERRORS: Record<number, string> = {
  6000: 'A text field is empty or too long', 6001: 'Invalid status code', 6002: 'Invalid inspection result',
  6003: 'Component is retired', 6004: 'Only the component authority (the wallet that registered it) can do this', 6005: 'Counter overflow',
};
export function explainError(e: unknown): string {
  const msg = e instanceof Error ? e.message : String(e);
  if (/User rejected|rejected the request|declined/i.test(msg)) return 'Transaction cancelled in the wallet.';
  if (/already in use/i.test(msg)) return 'This component ID is already registered on-chain.';
  if (/no record of a prior credit|insufficient (funds|lamports)/i.test(msg)) return 'Your wallet needs Devnet SOL. Get some at https://faucet.solana.com (choose Devnet).';
  const m = msg.match(/custom program error: 0x([0-9a-f]+)/i);
  if (m) {
    const code = parseInt(m[1], 16);
    if (code === 101) return 'The deployed program does not have the registry instructions yet. Upgrade it first (see README step 1).';
    if (PROGRAM_ERRORS[code]) return PROGRAM_ERRORS[code];
    return `Program error 0x${m[1]}`;
  }
  return msg;
}
