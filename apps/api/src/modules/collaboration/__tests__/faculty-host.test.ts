import { Types } from 'mongoose';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../../models', () => ({
  CollaborationEvent: {
    create: vi.fn(),
    findById: vi.fn(),
    find: vi.fn(),
    countDocuments: vi.fn(),
  },
  EventRegistration: {
    findOne: vi.fn(),
    find: vi.fn(),
    countDocuments: vi.fn(),
    create: vi.fn(),
  },
  CompanyProfile: {
    findOne: vi.fn(),
    findById: vi.fn(),
  },
  FacultyProfile: {
    findOne: vi.fn(),
    findById: vi.fn(),
  },
  Institution: {
    findById: vi.fn(),
  },
  User: {
    findById: vi.fn(),
  },
}));

import {
  CollaborationEvent,
  EventRegistration,
  FacultyProfile,
  Institution,
  User,
} from '../../../models';
import { createEvent, publishEvent, registerForEvent } from '../collaboration.service';

const FACULTY_USER_ID = new Types.ObjectId().toString();
const FACULTY_PROFILE_ID = new Types.ObjectId();
const FACULTY_INSTITUTION_ID = new Types.ObjectId();

function query<T>(result: T) {
  const q = {} as Record<string, unknown>;
  for (const m of ['populate', 'select', 'sort', 'skip', 'limit', 'lean']) {
    q[m] = () => q;
  }
  q.lean = () => Promise.resolve(result);
  q.then = (onF: (v: T) => unknown) => Promise.resolve(result).then(onF);
  return q;
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(FacultyProfile.findOne).mockReturnValue(
    query({ _id: FACULTY_PROFILE_ID, fullName: 'Dr. Faculty Host' }) as never,
  );
  vi.mocked(User.findById).mockReturnValue(query({ institution: FACULTY_INSTITUTION_ID }) as never);
  vi.mocked(Institution.findById).mockReturnValue(
    query({ _id: FACULTY_INSTITUTION_ID, name: 'Test University' }) as never,
  );
});

describe('faculty hosting events', () => {
  it('FACULTY creates an event under their own faculty profile (not the institution)', async () => {
    // Phase 17 — faculty events now resolve the host to the faculty profile id
    // (not the parent institution) so the hostName shown to attendees is the
    // faculty member's display name.
    const doc = {
      _id: new Types.ObjectId(),
      toJSON: () => ({ id: 'eid', title: 'React Workshop' }),
    };
    vi.mocked(CollaborationEvent.create).mockResolvedValue(doc as never);

    const result = await createEvent(FACULTY_USER_ID, 'FACULTY', {
      title: 'React Workshop',
      description: 'Learn React from scratch and build real projects',
      eventType: 'WORKSHOP',
      startAt: new Date().toISOString(),
      mode: 'ONSITE',
      location: 'Campus',
      targetAudience: [],
      tags: [],
    });

    expect(CollaborationEvent.create).toHaveBeenCalled();
    const createCall = (CollaborationEvent.create as ReturnType<typeof vi.fn>).mock.calls[0]![0];
    expect(createCall.hostType).toBe('FACULTY');
    expect(String(createCall.host)).toBe(String(FACULTY_PROFILE_ID));
    expect(result.host.name).toBe('Dr. Faculty Host');
  });

  it('INSTITUTION user still creates events under their institution (regression)', async () => {
    const doc = {
      _id: new Types.ObjectId(),
      toJSON: () => ({ id: 'eid', title: 'I-Hosted' }),
    };
    vi.mocked(CollaborationEvent.create).mockResolvedValue(doc as never);

    await createEvent(FACULTY_USER_ID, 'INSTITUTION', {
      title: 'Institute Talk',
      description: 'Hosting an event as the institution itself',
      eventType: 'GUEST_LECTURE',
      startAt: new Date().toISOString(),
      mode: 'ONLINE',
      targetAudience: [],
      tags: [],
    });

    const createCall = (CollaborationEvent.create as ReturnType<typeof vi.fn>).mock.calls[0]![0];
    expect(createCall.hostType).toBe('INSTITUTION');
    expect(String(createCall.host)).toBe(String(FACULTY_INSTITUTION_ID));
  });

  it('allows FACULTY to publish their own event', async () => {
    const eventId = new Types.ObjectId();
    const doc = {
      _id: eventId,
      postedBy: new Types.ObjectId(FACULTY_USER_ID),
      hostType: 'FACULTY',
      host: FACULTY_PROFILE_ID,
      status: 'DRAFT',
      save: vi.fn(function (this: typeof doc) {
        this.status = 'PUBLISHED';
        return Promise.resolve(this);
      }),
      toJSON: () => ({ id: String(eventId), status: 'PUBLISHED' }),
    };
    vi.mocked(CollaborationEvent.findById).mockResolvedValue(doc as never);
    vi.mocked(FacultyProfile.findOne).mockReturnValue(query({ _id: FACULTY_PROFILE_ID }) as never);

    const result = await publishEvent(String(eventId), FACULTY_USER_ID, 'FACULTY');
    expect(doc.save).toHaveBeenCalled();
    expect(result.status).toBe('PUBLISHED');
  });

  it('prevents FACULTY from editing an event hosted by a different faculty member', async () => {
    const eventId = new Types.ObjectId();
    const otherFacultyId = new Types.ObjectId();
    const doc = {
      _id: eventId,
      postedBy: new Types.ObjectId(),
      hostType: 'FACULTY',
      host: otherFacultyId,
      status: 'DRAFT',
    };
    vi.mocked(CollaborationEvent.findById).mockResolvedValue(doc as never);
    vi.mocked(FacultyProfile.findOne).mockReturnValue(query({ _id: FACULTY_PROFILE_ID }) as never);

    await expect(publishEvent(String(eventId), FACULTY_USER_ID, 'FACULTY')).rejects.toThrow(
      'Not your event',
    );
  });

  it('prevents STUDENT from creating an event (role gate)', async () => {
    await expect(
      createEvent(FACULTY_USER_ID, 'STUDENT', {
        title: 'Student Event',
        description: 'Should be rejected at the role layer',
        eventType: 'WORKSHOP',
        startAt: new Date().toISOString(),
        mode: 'ONLINE',
        targetAudience: [],
        tags: [],
      }),
    ).rejects.toThrow();
  });

  it('allows FACULTY to register for an event with FACULTY in targetAudience', async () => {
    const eventId = new Types.ObjectId();
    const doc = {
      _id: eventId,
      status: 'PUBLISHED',
      targetAudience: ['FACULTY'],
      registrationDeadline: null,
      registeredCount: 0,
      capacity: null,
      save: vi.fn(),
    };
    vi.mocked(CollaborationEvent.findById).mockResolvedValue(doc as never);
    vi.mocked(EventRegistration.findOne).mockResolvedValue(null);
    vi.mocked(EventRegistration.create).mockResolvedValue({
      _id: new Types.ObjectId(),
      toJSON: () => ({ id: 'reg1' }),
    } as never);

    const result = (await registerForEvent(
      FACULTY_USER_ID,
      'FACULTY',
      String(eventId),
    )) as unknown as { id: string };
    expect(EventRegistration.create).toHaveBeenCalled();
    expect(result.id).toBe('reg1');
  });

  it('allows FACULTY to register for an event with no targetAudience restriction', async () => {
    const eventId = new Types.ObjectId();
    const doc = {
      _id: eventId,
      status: 'PUBLISHED',
      targetAudience: [],
      registrationDeadline: null,
      registeredCount: 0,
      capacity: null,
      save: vi.fn(),
    };
    vi.mocked(CollaborationEvent.findById).mockResolvedValue(doc as never);
    vi.mocked(EventRegistration.findOne).mockResolvedValue(null);
    vi.mocked(EventRegistration.create).mockResolvedValue({
      _id: new Types.ObjectId(),
      toJSON: () => ({ id: 'reg2' }),
    } as never);

    const result = (await registerForEvent(
      FACULTY_USER_ID,
      'FACULTY',
      String(eventId),
    )) as unknown as { id: string };
    expect(EventRegistration.create).toHaveBeenCalled();
    expect(result.id).toBe('reg2');
  });
});
