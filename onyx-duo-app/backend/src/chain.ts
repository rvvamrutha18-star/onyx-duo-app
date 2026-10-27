import { Connection, PublicKey } from '@solana/web3.js';
import { PROGRAM_ID, RPC_URL } from './config';

const conn = new Connection(RPC_URL, 'confirmed');
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const enc = new TextEncoder();

export const componentPda = (id: string) =>
  PublicKey.findProgramAddressSync([enc.encode('component'), enc.encode(id)], PROGRAM_ID)[0];

export interface Verification { verified: boolean; slot?: number; error?: string }

/**
 * Returns verified=true ONLY if the transaction exists on Devnet, succeeded, invoked the ONYX program,
 * and touched this component's PDA. Nothing is ever marked on-chain without this check.
 */
export async function verifyProgramTx(signature: string, componentId: string): Promise<Verification> {
  const pda = componentPda(componentId);
  let lastErr = 'Transaction not found on Devnet (it may still be propagating)';
  for (let i = 0; i < 6; i++) {
    try {
      const tx = await conn.getTransaction(signature, { commitment: 'confirmed', maxSupportedTransactionVersion: 0 });
      if (tx) {
        if (tx.meta?.err) return { verified: false, slot: tx.slot, error: 'Transaction failed on-chain' };
        const msg = tx.transaction.message;
        const keys = msg.staticAccountKeys;
        const callsProgram = msg.compiledInstructions.some((ix) => keys[ix.programIdIndex].equals(PROGRAM_ID));
        if (!callsProgram) return { verified: false, slot: tx.slot, error: 'Transaction does not call the ONYX program' };
        if (!keys.some((k) => k.equals(pda))) return { verified: false, slot: tx.slot, error: 'Transaction does not touch this component account' };
        return { verified: true, slot: tx.slot };
      }
    } catch (e) {
      lastErr = (e as Error).message;
    }
    await sleep(1500);
  }
  return { verified: false, error: lastErr };
}
