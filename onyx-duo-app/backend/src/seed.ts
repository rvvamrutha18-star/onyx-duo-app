// DEMO DATA ONLY. Everything seeded here is an off-chain prototype record: no signatures, nothing on Solana.
import { PrismaClient } from '@prisma/client';
import 'dotenv/config';

const prisma = new PrismaClient();
const wallets = [
  '11111111111111111111111111111111', // placeholder technician identity for demo rows
];

async function main() {
  await prisma.maintenance.deleteMany();
  await prisma.activity.deleteMany();
  await prisma.component.deleteMany();

  const rows = [
    { id: 'DEMO-TB-0001', manufacturer: 'Demo Aviation Manufacturing', partNumber: 'TB-2048', serialNumber: 'SN-TB-2048-001', aircraftModel: 'Demo A320-family', status: 'IN_SERVICE' },
    { id: 'DEMO-FPA-0014', manufacturer: 'Demo Aviation Manufacturing', partNumber: 'FPA-7710', serialNumber: 'SN-FPA-7710-014', aircraftModel: 'Demo B737-family', status: 'QUARANTINED' },
    { id: 'DEMO-HVB-0021', manufacturer: 'Demo Hydraulics Ltd', partNumber: 'HVB-5521', serialNumber: 'SN-HVB-5521-007', aircraftModel: 'Demo A320-family', status: 'UNDER_MAINTENANCE' },
    { id: 'DEMO-LGA-0030', manufacturer: 'Demo Hydraulics Ltd', partNumber: 'LGA-3301', serialNumber: 'SN-LGA-3301-009', aircraftModel: 'Demo B787-family', status: 'REGISTERED' },
  ];
  for (const r of rows) {
    await prisma.component.create({ data: r });
    await prisma.activity.create({ data: { componentId: r.id, kind: 'REGISTERED', message: `DEMO: ${r.id} seeded (off-chain prototype record)` } });
  }
  const m = (componentId: string, inspectionResult: string, notes: string, daysAgo: number) =>
    prisma.maintenance.create({ data: { componentId, technicianWallet: wallets[0], inspectionResult, notes, timestamp: new Date(Date.now() - daysAgo * 86400000) } });
  await m('DEMO-TB-0001', 'PASS', 'DEMO: full overhaul, clearances within demo tolerance', 30);
  await m('DEMO-FPA-0014', 'FAIL', 'DEMO: document hash mismatch flagged by inspector', 12);
  await m('DEMO-HVB-0021', 'ACTION_REQUIRED', 'DEMO: seal replacement pending re-inspection', 3);
  console.log('Seeded 4 demo components (off-chain prototype records).');
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
