import type { UpdateFacultyProfileInput } from '@aip/validation';
import { AppError } from '../../utils/AppError';
import { FacultyProfile } from '../../models';

export async function getMyProfile(userId: string) {
  const profile = await FacultyProfile.findOne({ user: userId });
  if (!profile) throw AppError.notFound('Faculty profile not found');
  return profile.toJSON();
}

export async function updateMyProfile(userId: string, patch: UpdateFacultyProfileInput) {
  const profile = await FacultyProfile.findOne({ user: userId });
  if (!profile) throw AppError.notFound('Faculty profile not found');
  const safe: Record<string, unknown> = { ...patch };
  delete safe.institution;
  Object.assign(profile, safe);
  await profile.save();
  return profile.toJSON();
}
