export type Status = 'REGISTERED' | 'IN_SERVICE' | 'UNDER_MAINTENANCE' | 'QUARANTINED' | 'RETIRED';
export type InspectionResult = 'PASS' | 'FAIL' | 'ACTION_REQUIRED';

export const STATUSES: Status[] = ['REGISTERED', 'IN_SERVICE', 'UNDER_MAINTENANCE', 'QUARANTINED', 'RETIRED'];
export const RESULTS: InspectionResult[] = ['PASS', 'FAIL', 'ACTION_REQUIRED'];
export const STATUS_LABEL: Record<Status, string> = {
  REGISTERED: 'Registered', IN_SERVICE: 'In Service', UNDER_MAINTENANCE: 'Under Maintenance', QUARANTINED: 'Quarantined', RETIRED: 'Retired',
};
export const RESULT_LABEL: Record<InspectionResult, string> = { PASS: 'Pass', FAIL: 'Fail', ACTION_REQUIRED: 'Action required' };

export interface MaintenanceRec {
  id: number; componentId: string; technicianWallet: string; inspectionResult: InspectionResult; notes: string;
  timestamp: string; onchainSignature: string | null; onchainVerified: boolean;
}
export interface ComponentRec {
  id: string; manufacturer: string; partNumber: string; serialNumber: string; aircraftModel: string; status: Status;
  onchainSignature: string | null; onchainVerified: boolean; onchainAddress: string | null; createdAt: string; updatedAt: string;
  _count?: { maintenance: number }; maintenance?: MaintenanceRec[];
}
export interface ActivityRec {
  id: number; componentId: string | null; kind: string; message: string; signature: string | null; verified: boolean; createdAt: string;
}
export interface Stats { total: number; byStatus: Record<Status, number>; maintenanceRecords: number; onchainComponents: number }
export interface OnchainResult { verified: boolean; slot?: number; error?: string }

export const explorerTx = (sig: string) => `https://explorer.solana.com/tx/${sig}?cluster=devnet`;
export const explorerAddr = (a: string) => `https://explorer.solana.com/address/${a}?cluster=devnet`;
export const shorten = (s: string, n = 4) => (s.length > n * 2 + 3 ? `${s.slice(0, n)}...${s.slice(-n)}` : s);
