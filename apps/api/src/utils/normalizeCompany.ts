export function normalizeCompanyRef(company: unknown): { id: string; name: string; logoUrl?: string } | string | undefined {
  if (company == null) return undefined;
  if (typeof company === 'string') return company;
  if (typeof company !== 'object') return undefined;
  const c = company as Record<string, unknown>;
  const id = String(c.id ?? c._id ?? '');
  const name = typeof c.name === 'string' ? c.name : typeof c.companyName === 'string' ? c.companyName : '';
  const logoUrl = typeof c.logoUrl === 'string' ? c.logoUrl : undefined;
  return { id, name, logoUrl };
}

export function normalizeCompanyOn<T extends Record<string, unknown>>(row: T): T {
  if (row.company == null) return row;
  return { ...row, company: normalizeCompanyRef(row.company) } as T;
}
