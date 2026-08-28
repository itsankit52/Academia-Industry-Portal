import { Types } from 'mongoose';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../../models', () => ({
  FacultyProfile: {
    findOne: vi.fn(),
    findOneAndUpdate: vi.fn(),
    findById: vi.fn(),
  },
}));

import { FacultyProfile } from '../../../models';
import { getMyProfile, updateMyProfile } from '../faculty.service';

const USER_ID = new Types.ObjectId().toString();
const PROFILE_ID = new Types.ObjectId();

beforeEach(() => {
  vi.clearAllMocks();
});

describe('faculty service', () => {
  it('returns the faculty profile for the current user', async () => {
    vi.mocked(FacultyProfile.findOne).mockReturnValue({
      toJSON: () => ({ id: String(PROFILE_ID), fullName: 'Dr. Smith', designation: 'Professor' }),
    } as never);

    const profile = await getMyProfile(USER_ID);
    expect(FacultyProfile.findOne).toHaveBeenCalledWith({ user: USER_ID });
    expect(profile.fullName).toBe('Dr. Smith');
  });

  it('throws not-found when the faculty profile is missing', async () => {
    vi.mocked(FacultyProfile.findOne).mockReturnValue(null as never);
    await expect(getMyProfile(USER_ID)).rejects.toThrow('Faculty profile not found');
  });

  it('updates editable fields and rejects institution overrides', async () => {
    const save = vi.fn();
    const profile: Record<string, unknown> = {
      _id: PROFILE_ID,
      fullName: 'Dr. Smith',
      designation: 'Professor',
      department: 'CSE',
      bio: 'old',
      institution: 'orig-inst',
      save,
      toJSON: function () {
        return { id: String(this._id), ...this };
      },
    };
    vi.mocked(FacultyProfile.findOne).mockReturnValue(profile as never);

    const result = (await updateMyProfile(USER_ID, {
      bio: 'New bio about research interests',
      institution: 'hacked',
    } as never)) as Record<string, unknown>;
    expect(save).toHaveBeenCalled();
    expect(profile.bio).toBe('New bio about research interests');
    // institution is stripped
    expect(profile.institution).toBe('orig-inst');
    expect(result.bio).toBe('New bio about research interests');
  });
});
