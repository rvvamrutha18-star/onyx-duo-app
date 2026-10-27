import 'dotenv/config';
import { PublicKey } from '@solana/web3.js';

export const PORT = Number(process.env.PORT ?? 4000);
export const FRONTEND_ORIGIN = process.env.FRONTEND_ORIGIN ?? 'http://localhost:3000';
export const RPC_URL = process.env.SOLANA_RPC_URL ?? 'https://api.devnet.solana.com';
export const PROGRAM_ID = new PublicKey(process.env.PROGRAM_ID ?? 'FMZsoKzQoF7JtZmFd9pzBKkB8xY1aRi11689rXc8bFbQ');

if (/mainnet/i.test(RPC_URL)) {
  console.error('Refusing to start: this prototype supports Solana Devnet only.');
  process.exit(1);
}
if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL is missing. Run: Copy-Item .env.example .env');
  process.exit(1);
}
