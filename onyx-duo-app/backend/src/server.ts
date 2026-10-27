import express, { NextFunction, Request, RequestHandler, Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { z, ZodError } from 'zod';
import { PublicKey } from '@solana/web3.js';
import { Prisma, PrismaClient } from '@prisma/client';
import { FRONTEND_ORIGIN, PORT, PROGRAM_ID, RPC_URL } from './config';
import { componentPda, verifyProgramTx } from './chain';

const prisma = new PrismaClient();
const app = express();
app.disable('x-powered-by');
app.use(helmet());
app.use(cors({ origin: [FRONTEND_ORIGIN, FRONTEND_ORIGIN.replace('localhost', '127.0.0.1')] }));
app.use(express.json({ limit: '100kb' }));

class HttpError extends Error {
  constructor(public status: number, message: string, public code = 'ERROR') { super(message); }
}
type Handler = (req: Request, res: Response) => Promise<unknown>;
const h = (fn: Handler): RequestHandler => (req, res, next) => { fn(req, res).catch(next); };

export const STATUSES = ['REGISTERED', 'IN_SERVICE', 'UNDER_MAINTENANCE', 'QUARANTINED', 'RETIRED'] as const;
export const RESULTS = ['PASS', 'FAIL', 'ACTION_REQUIRED'] as const;

const utf8 = new TextEncoder();
const bytes = (max: number) =>
  z.string().trim().min(2).refine((v) => utf8.encode(v).length <= max, `Max ${max} bytes (on-chain limit)`);
const wallet = z.string().refine((v) => { try { new PublicKey(v); return true; } catch { return false; } }, 'Invalid Solana wallet address');
const signature = z.string().regex(/^[1-9A-HJ-NP-Za-km-z]{80,100}$/, 'Invalid transaction signature');

const createComponent = z.object({
  id: z.string().trim().min(2).regex(/^[A-Za-z0-9_-]+$/, 'Use letters, digits, - and _ only')
    .refine((v) => utf8.encode(v).length <= 32, 'Max 32 bytes (on-chain limit)'),
  manufacturer: bytes(48),
  partNumber: bytes(32),
  serialNumber: bytes(48),
  aircraftModel: bytes(48),
  onchainSignature: signature.optional(),
}).strict();

const createMaintenance = z.object({
  technicianWallet: wallet,
  inspectionResult: z.enum(RESULTS),
  notes: z.string().trim().min(3).refine((v) => utf8.encode(v).length <= 200, 'Max 200 bytes (on-chain limit)'),
  timestamp: z.string().datetime().optional(),
  onchainSignature: signature.optional(),
}).strict();

const patchStatus = z.object({ status: z.enum(STATUSES), onchainSignature: signature.optional() }).strict();

/** A signature is accepted as on-chain proof only if Devnet confirms it and it has not been used before. */
async function verifyOptional(sig: string | undefined, componentId: string) {
  if (!sig) return null;
  const used = await prisma.activity.findFirst({ where: { signature: sig, verified: true } });
  if (used) throw new HttpError(409, 'This transaction signature is already attached to another record', 'SIGNATURE_REUSED');
  return verifyProgramTx(sig, componentId);
}

// ---------------- routes ----------------
app.get('/api/health', (_req, res) =>
  res.json({ ok: true, time: new Date().toISOString(), cluster: 'devnet', rpc: RPC_URL, programId: PROGRAM_ID.toBase58() }));

app.get('/api/stats', h(async (_req, res) => {
  const groups = await prisma.component.groupBy({ by: ['status'], _count: { _all: true } });
  const byStatus: Record<string, number> = Object.fromEntries(STATUSES.map((s) => [s, 0]));
  for (const g of groups) byStatus[g.status] = g._count._all;
  res.json({
    total: await prisma.component.count(),
    byStatus,
    maintenanceRecords: await prisma.maintenance.count(),
    onchainComponents: await prisma.component.count({ where: { onchainVerified: true } }),
  });
}));

app.get('/api/activity', h(async (req, res) => {
  const limit = z.coerce.number().int().min(1).max(100).default(15).parse(req.query.limit);
  res.json(await prisma.activity.findMany({ orderBy: { createdAt: 'desc' }, take: limit }));
}));

app.get('/api/components/check', h(async (req, res) => {
  const q = z.object({ id: z.string().max(64).optional(), serial: z.string().max(100).optional() }).parse(req.query);
  res.json({
    idTaken: q.id ? !!(await prisma.component.findUnique({ where: { id: q.id } })) : false,
    serialTaken: q.serial ? !!(await prisma.component.findUnique({ where: { serialNumber: q.serial } })) : false,
  });
}));

app.get('/api/components', h(async (req, res) => {
  const q = z.object({
    q: z.string().max(100).optional(),
    status: z.enum(STATUSES).optional(),
    manufacturer: z.string().max(100).optional(),
  }).parse(req.query);
  const where: Prisma.ComponentWhereInput = {};
  if (q.status) where.status = q.status;
  if (q.manufacturer) where.manufacturer = q.manufacturer;
  if (q.q) where.OR = [{ id: { contains: q.q } }, { serialNumber: { contains: q.q } }, { manufacturer: { contains: q.q } }, { partNumber: { contains: q.q } }];
  res.json(await prisma.component.findMany({ where, orderBy: { createdAt: 'desc' }, include: { _count: { select: { maintenance: true } } } }));
}));

app.post('/api/components', h(async (req, res) => {
  const b = createComponent.parse(req.body);
  const v = await verifyOptional(b.onchainSignature, b.id);
  const verified = !!v?.verified;
  const component = await prisma.$transaction(async (tx) => {
    const c = await tx.component.create({
      data: {
        id: b.id, manufacturer: b.manufacturer, partNumber: b.partNumber, serialNumber: b.serialNumber, aircraftModel: b.aircraftModel,
        onchainSignature: b.onchainSignature ?? null, onchainVerified: verified,
        onchainAddress: verified ? componentPda(b.id).toBase58() : null,
      },
    });
    await tx.activity.create({
      data: {
        componentId: c.id, kind: 'REGISTERED', message: `Component ${c.id} registered (${c.manufacturer} ${c.partNumber})`,
        signature: verified ? b.onchainSignature! : null, verified,
      },
    });
    return c;
  });
  res.status(201).json({ component, onchain: v });
}));

app.get('/api/components/:id', h(async (req, res) => {
  const c = await prisma.component.findUnique({
    where: { id: req.params.id },
    include: { maintenance: { orderBy: { timestamp: 'desc' } } },
  });
  if (!c) throw new HttpError(404, 'Component not found', 'NOT_FOUND');
  res.json(c);
}));

app.post('/api/components/:id/maintenance', h(async (req, res) => {
  const b = createMaintenance.parse(req.body);
  const c = await prisma.component.findUnique({ where: { id: req.params.id } });
  if (!c) throw new HttpError(404, 'Component not found', 'NOT_FOUND');
  if (c.status === 'RETIRED') throw new HttpError(409, 'Component is retired', 'RETIRED');
  if (b.onchainSignature && !c.onchainVerified) throw new HttpError(409, 'Component is not registered on-chain, so no on-chain proof can be attached', 'NOT_ONCHAIN');
  const v = await verifyOptional(b.onchainSignature, c.id);
  const verified = !!v?.verified;
  const record = await prisma.$transaction(async (tx) => {
    const m = await tx.maintenance.create({
      data: {
        componentId: c.id, technicianWallet: b.technicianWallet, inspectionResult: b.inspectionResult, notes: b.notes,
        timestamp: b.timestamp ? new Date(b.timestamp) : new Date(), onchainSignature: b.onchainSignature ?? null, onchainVerified: verified,
      },
    });
    await tx.activity.create({
      data: { componentId: c.id, kind: 'MAINTENANCE', message: `${b.inspectionResult} maintenance recorded on ${c.id}`, signature: verified ? b.onchainSignature! : null, verified },
    });
    return m;
  });
  res.status(201).json({ record, onchain: v });
}));

app.patch('/api/components/:id/status', h(async (req, res) => {
  const b = patchStatus.parse(req.body);
  const c = await prisma.component.findUnique({ where: { id: req.params.id } });
  if (!c) throw new HttpError(404, 'Component not found', 'NOT_FOUND');
  if (c.status === 'RETIRED') throw new HttpError(409, 'Retired components cannot change status', 'RETIRED');
  if (c.status === b.status) throw new HttpError(409, `Component is already ${b.status}`, 'NO_CHANGE');
  if (b.onchainSignature && !c.onchainVerified) throw new HttpError(409, 'Component is not registered on-chain, so no on-chain proof can be attached', 'NOT_ONCHAIN');
  const v = await verifyOptional(b.onchainSignature, c.id);
  const verified = !!v?.verified;
  const component = await prisma.$transaction(async (tx) => {
    const u = await tx.component.update({ where: { id: c.id }, data: { status: b.status } });
    await tx.activity.create({
      data: { componentId: c.id, kind: 'STATUS', message: `${c.id}: ${c.status} -> ${b.status}`, signature: verified ? b.onchainSignature! : null, verified },
    });
    return u;
  });
  res.json({ component, onchain: v });
}));

app.use((_req, res) => res.status(404).json({ error: 'Not found', code: 'NOT_FOUND' }));
app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  if (err instanceof ZodError)
    return res.status(400).json({ error: err.issues.map((i) => `${i.path.join('.') || 'body'}: ${i.message}`).join('; '), code: 'VALIDATION' });
  if (err instanceof HttpError) return res.status(err.status).json({ error: err.message, code: err.code });
  const e = err as { code?: string };
  if (e?.code === 'P2002') return res.status(409).json({ error: 'Duplicate component ID or serial number', code: 'CONFLICT' });
  console.error(err);
  res.status(500).json({ error: 'Internal server error', code: 'INTERNAL' });
});

app.listen(PORT, () => console.log(`ONYX DUO API  http://localhost:${PORT}/api   (Devnet program ${PROGRAM_ID.toBase58()})`));
