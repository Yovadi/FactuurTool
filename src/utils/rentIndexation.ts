import { roundMoney } from './invoiceBalance';

export type IndexationSpace = {
  id: string;
  monthly_rent: number;
  price_per_sqm: number;
};

export type IndexationLease = {
  id: string;
  tenant_id?: string | null;
  tenantName: string;
  last_indexation_at?: string | null;
  spaces: IndexationSpace[];
};

export type IndexationPreview = {
  leaseId: string;
  tenantId: string | null;
  tenantName: string;
  totalOld: number;
  totalNew: number;
  lines: {
    id: string;
    oldRent: number;
    newRent: number;
    oldRate: number;
    newRate: number;
  }[];
};

export function pendingIndexation(
  leases: IndexationLease[],
  percentage: number,
  yearStart: string
): IndexationPreview[] {
  if (!(percentage > 0)) return [];
  const multiplier = 1 + percentage / 100;
  return leases
    .filter((lease) => !lease.last_indexation_at || lease.last_indexation_at < yearStart)
    .map((lease) => {
      const lines = lease.spaces.map((space) => ({
        id: space.id,
        oldRent: roundMoney(space.monthly_rent),
        newRent: roundMoney((Number(space.monthly_rent) || 0) * multiplier),
        oldRate: roundMoney(space.price_per_sqm),
        newRate: roundMoney((Number(space.price_per_sqm) || 0) * multiplier),
      }));
      return {
        leaseId: lease.id,
        tenantId: lease.tenant_id || null,
        tenantName: lease.tenantName,
        totalOld: roundMoney(lines.reduce((sum, line) => sum + line.oldRent, 0)),
        totalNew: roundMoney(lines.reduce((sum, line) => sum + line.newRent, 0)),
        lines,
      };
    });
}
