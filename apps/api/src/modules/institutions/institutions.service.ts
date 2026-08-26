import type { PublicInstitution } from '@aip/types';
import { Institution } from '../../models';

export async function listVerifiedPublic(): Promise<PublicInstitution[]> {
  const rows = await Institution.find({ verificationStatus: 'VERIFIED' })
    .select('_id name code')
    .sort({ name: 1 })
    .lean();
  return rows.map((r) => ({
    id: String(r._id),
    name: r.name as string,
    code: r.code as string,
  }));
}
