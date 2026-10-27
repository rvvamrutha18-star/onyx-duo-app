# ONYX DUO - Aviation Supply-Chain Traceability (Solana Devnet prototype)

Next.js + Tailwind frontend, Express + Prisma + SQLite backend, Anchor registry program on Devnet.
Prototype only - not for real airworthiness decisions.

## What is real and what is not

| Thing | Where it lives | Label in the UI |
|---|---|---|
| Component identity, status, maintenance records signed in your wallet | Solana Devnet account (PDA) | "On-chain confirmed" + Explorer link, shown only after the backend re-checks the signature on Devnet |
| Everything saved without a wallet transaction, and all `DEMO-*` seed rows | SQLite file `backend/prisma/dev.db` | "Off-chain prototype record" |
| Search, dashboard, activity feed | SQLite | - |

The deployed program is still the `hello_anchor` starter until you do STEP 1. Until then, on-chain
actions fail with a clear message and nothing is ever labelled on-chain.

## STEP 1 - upgrade the program (Solana Playground, same program ID)

1. Open your project in https://beta.solpg.io (the one that deployed `FMZsoKzQoF7JtZmFd9pzBKkB8xY1aRi11689rXc8bFbQ`).
   Connect the same Playground wallet.
2. In the Playground terminal run: `solana program show FMZsoKzQoF7JtZmFd9pzBKkB8xY1aRi11689rXc8bFbQ`
   Check that **Authority** is your deployer wallet. If it says `none`, the program is immutable and cannot be upgraded:
   go to option B below.
3. Replace everything in `src/lib.rs` with the file `anchor/lib.rs` from this folder.
4. Make sure the wallet has Devnet SOL (`solana airdrop 2`, or https://faucet.solana.com).
5. Click Build, then Deploy.
   - If Deploy says the new program is too big for the existing account, try
     `solana program extend FMZsoKzQoF7JtZmFd9pzBKkB8xY1aRi11689rXc8bFbQ 200000` in the terminal and deploy again.
   - Option B (always works): in Playground create a new program keypair, deploy under the new ID, then put the new ID in
     `backend/.env` (`PROGRAM_ID=`) and `frontend/.env.local` (`NEXT_PUBLIC_PROGRAM_ID=`). Also change `declare_id!` if Playground did not.
6. Verify: `solana program show <ID>` shows a new "Last Deployed Slot". The real proof is STEP 4 below.

Note: the Explorer link in your notes had a stray space ("F MZso..."). Use the ID without spaces.

## STEP 2 - backend (PowerShell, terminal 1)

```powershell
cd <path>\onyx-duo-app\backend
npm install
Copy-Item .env.example .env
npx prisma db push
npm run seed
npm run dev
```
Check http://localhost:4000/api/health returns `{"ok":true,...}`. No database server and no secrets needed.
If PowerShell blocks npm: `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned`, then reopen PowerShell.

## STEP 3 - frontend (PowerShell, terminal 2)

```powershell
cd <path>\onyx-duo-app\frontend
npm install
Copy-Item .env.example .env.local
npm run dev
```
Open http://localhost:3000 (not 127.0.0.1).

## STEP 4 - verify the real on-chain flow

1. Install Phantom or Solflare, switch it to **Devnet**, get Devnet SOL from https://faucet.solana.com.
2. Click Connect wallet. Register a component with the on-chain box ticked. Approve in your wallet.
3. You should see "On-chain confirmed" and an Explorer link. Open it and confirm the transaction calls program `FMZs...`.
4. Open the component: the "Live on-chain state" box reads the account straight from Devnet.
5. Record maintenance and change status the same way (status is restricted to the wallet that registered the component).

## Judge demo script (3 minutes)

1. "Dashboard: counts and activity come from our API and SQLite. Rows named DEMO-* are mock data, labelled off-chain."
2. "I connect my Devnet wallet and register component ENG-0001. My wallet signs; no private key is in the app."
3. "The badge says On-chain confirmed only because the backend re-fetched the transaction from Devnet and checked that it succeeded, called our program and touched this component's account."
4. Click the Explorer link. "Real signature, real program."
5. "Live on-chain state reads the account back from Solana, independent of our database."
6. Record a FAIL maintenance result, then set the component to Quarantined. "Each is a signed on-chain instruction with an on-chain timestamp; history is indexed PDAs."
7. Register one component without the wallet box: "This one is labelled Off-chain prototype record - we never fake the chain."
8. Honest limits: any wallet may record maintenance (no technician allowlist yet); the database and chain are separate writes; Devnet only.

## Layout

```
anchor/lib.rs                 Anchor program: register_component, record_maintenance, update_status
backend/                      Express + Zod + Prisma (SQLite); verifies signatures against Devnet RPC
frontend/src/lib/onchain.ts   Hand-written client matching lib.rs (no IDL needed)
```
If you change the Rust code, update `onchain.ts` to match (instruction args, account order, discriminators).

## API

`GET /api/health` · `GET /api/stats` · `GET /api/activity` · `GET /api/components?q=&status=&manufacturer=` ·
`GET /api/components/check?id=&serial=` · `POST /api/components` · `GET /api/components/:id` ·
`POST /api/components/:id/maintenance` · `PATCH /api/components/:id/status`
Write endpoints accept an optional `onchainSignature`; it is stored as on-chain proof only if Devnet confirms it.

## Not tested yet (be honest in your demo)

Nothing here has been run on a real machine yet: `npm install`, Prisma, `next build`, the Anchor build/upgrade and every
Devnet transaction still need to be run by you. Paste any error and it can be fixed quickly.
