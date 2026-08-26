import { Types } from 'mongoose';
import type { Role } from '@aip/config';
import type {
  CreateEventInput,
  UpdateEventInput,
  ListEventsQuery,
  ListMyRegistrationsQuery,
  ListEventRegistrationsQuery,
} from '@aip/validation';
import { AppError } from '../../utils/AppError';
import { applyPagination, buildPaginated } from '../../utils/pagination';
import {
  CollaborationEvent,
  EventRegistration,
  CompanyProfile,
  Institution,
  User,
} from '../../models';
import { createNotification } from '../notifications/notifications.service';

interface HostRef {
  hostType: 'COMPANY' | 'INSTITUTION';
  hostId: Types.ObjectId;
  hostName: string;
}

async function resolveActorHost(userId: string, role: Role): Promise<HostRef> {
  if (role === 'COMPANY') {
    const c = await CompanyProfile.findOne({ user: userId }).select('_id companyName');
    if (!c) throw AppError.notFound('Company profile not found');
    return {
      hostType: 'COMPANY',
      hostId: c._id as Types.ObjectId,
      hostName: String(c.companyName),
    };
  }
  if (role === 'INSTITUTION' || role === 'ADMIN') {
    const user = await User.findById(userId).select('institution').lean();
    if (!user?.institution) throw AppError.badRequest('User has no institution to host under');
    const inst = await Institution.findById(user.institution).select('name');
    if (!inst) throw AppError.notFound('Institution not found');
    return {
      hostType: 'INSTITUTION',
      hostId: inst._id as Types.ObjectId,
      hostName: String(inst.name),
    };
  }
  throw AppError.forbidden('Role cannot host events');
}

async function resolveHostName(
  hostType: 'COMPANY' | 'INSTITUTION',
  hostId: unknown,
): Promise<string> {
  if (hostType === 'COMPANY') {
    const c = await CompanyProfile.findById(hostId).select('companyName').lean();
    return c ? String(c.companyName) : '—';
  }
  const inst = await Institution.findById(hostId).select('name').lean();
  return inst ? String(inst.name) : '—';
}

async function assertHostOrAdmin(eventId: string, userId: string, role: Role) {
  const event = await CollaborationEvent.findById(eventId);
  if (!event) throw AppError.notFound('Event not found');
  if (role === 'ADMIN') return event;
  if (String(event.postedBy) === userId) return event;
  if (role === 'COMPANY' && event.hostType === 'COMPANY') {
    const c = await CompanyProfile.findOne({ user: userId }).select('_id');
    if (c && String(event.host) === String(c._id)) return event;
  }
  if (role === 'INSTITUTION' && event.hostType === 'INSTITUTION') {
    const user = await User.findById(userId).select('institution').lean();
    if (user?.institution && String(event.host) === String(user.institution)) return event;
  }
  throw AppError.forbidden('Not your event');
}

export async function createEvent(userId: string, role: Role, input: CreateEventInput) {
  const host = await resolveActorHost(userId, role);
  const doc = await CollaborationEvent.create({
    title: input.title,
    description: input.description,
    eventType: input.eventType,
    hostType: host.hostType,
    host: host.hostId,
    postedBy: userId,
    startAt: new Date(input.startAt),
    ...(input.endAt ? { endAt: new Date(input.endAt) } : {}),
    ...(input.location ? { location: input.location } : {}),
    mode: input.mode,
    ...(input.meetingLink ? { meetingLink: input.meetingLink } : {}),
    ...(typeof input.capacity === 'number' ? { capacity: input.capacity } : {}),
    ...(input.registrationDeadline
      ? { registrationDeadline: new Date(input.registrationDeadline) }
      : {}),
    targetAudience: input.targetAudience ?? [],
    tags: input.tags ?? [],
  });
  const json = doc.toJSON() as Record<string, unknown>;
  return { ...json, host: { id: String(host.hostId), name: host.hostName } };
}

export async function listEvents(filters: ListEventsQuery, viewerUserId?: string) {
  const { page, pageSize, skip, limit } = applyPagination({
    page: filters.page,
    pageSize: filters.pageSize,
  });
  const where: Record<string, unknown> = {};
  if (filters.mine && viewerUserId) {
    where.postedBy = viewerUserId;
    if (filters.status) where.status = filters.status;
  } else {
    where.status = filters.status ?? 'PUBLISHED';
  }
  if (filters.eventType) where.eventType = filters.eventType;
  if (filters.hostType) where.hostType = filters.hostType;
  if (filters.mode) where.mode = filters.mode;
  if (filters.since) where.startAt = { $gte: new Date(filters.since) };
  if (filters.search) where.$text = { $search: filters.search };

  const [rows, total] = await Promise.all([
    CollaborationEvent.find(where).sort({ startAt: 1 }).skip(skip).limit(limit).lean(),
    CollaborationEvent.countDocuments(where),
  ]);

  const items = await Promise.all(
    rows.map(async (r) => ({
      ...r,
      id: String(r._id),
      host: {
        id: String(r.host),
        name: await resolveHostName(r.hostType as 'COMPANY' | 'INSTITUTION', r.host),
      },
    })),
  );
  return buildPaginated(items, total, page, pageSize);
}

export async function getEventById(id: string) {
  const doc = await CollaborationEvent.findById(id).lean();
  if (!doc) throw AppError.notFound('Event not found');
  const hostName = await resolveHostName(doc.hostType as 'COMPANY' | 'INSTITUTION', doc.host);
  return {
    ...doc,
    id: String(doc._id),
    host: { id: String(doc.host), name: hostName },
  };
}

export async function updateEvent(
  id: string,
  userId: string,
  role: Role,
  input: UpdateEventInput,
) {
  const event = await assertHostOrAdmin(id, userId, role);
  if (input.title !== undefined) event.title = input.title;
  if (input.description !== undefined) event.description = input.description;
  if (input.eventType !== undefined) event.eventType = input.eventType;
  if (input.startAt !== undefined) event.startAt = new Date(input.startAt);
  if (input.endAt !== undefined) event.endAt = new Date(input.endAt);
  if (input.location !== undefined) event.location = input.location;
  if (input.mode !== undefined) event.mode = input.mode;
  if (input.meetingLink !== undefined) event.meetingLink = input.meetingLink;
  if (input.capacity !== undefined) event.capacity = input.capacity;
  if (input.registrationDeadline !== undefined) {
    event.registrationDeadline = new Date(input.registrationDeadline);
  }
  if (input.targetAudience !== undefined) event.targetAudience = input.targetAudience;
  if (input.tags !== undefined) event.tags = input.tags;
  if (input.status !== undefined && role === 'ADMIN') event.status = input.status;
  await event.save();
  return event.toJSON();
}

export async function publishEvent(id: string, userId: string, role: Role) {
  const event = await assertHostOrAdmin(id, userId, role);
  if (event.status !== 'DRAFT' && role !== 'ADMIN') {
    throw AppError.badRequest('Only DRAFT events can be published');
  }
  event.status = 'PUBLISHED';
  await event.save();
  return event.toJSON();
}

export async function cancelEvent(id: string, userId: string, role: Role) {
  const event = await assertHostOrAdmin(id, userId, role);
  if (event.status === 'CANCELLED' || event.status === 'COMPLETED') {
    throw AppError.badRequest('Event cannot be cancelled');
  }
  event.status = 'CANCELLED';
  await event.save();
  return event.toJSON();
}

export async function registerForEvent(userId: string, role: Role, eventId: string) {
  const event = await CollaborationEvent.findById(eventId);
  if (!event) throw AppError.notFound('Event not found');
  if (event.status !== 'PUBLISHED') throw AppError.badRequest('Event is not open for registration');

  const audience = event.targetAudience ?? [];
  if (audience.length > 0 && !audience.includes(role)) {
    throw AppError.forbidden('Your role is not in the target audience');
  }
  if (event.registrationDeadline && event.registrationDeadline < new Date()) {
    throw AppError.badRequest('Registration deadline has passed');
  }

  const existing = await EventRegistration.findOne({ event: event._id, user: userId });
  if (existing) return existing.toJSON();

  if (typeof event.capacity === 'number' && event.registeredCount >= event.capacity) {
    throw AppError.badRequest('Event is at full capacity');
  }

  const reg = await EventRegistration.create({ event: event._id, user: userId });
  event.registeredCount = (event.registeredCount ?? 0) + 1;
  await event.save();
  return reg.toJSON();
}

export async function unregisterFromEvent(userId: string, eventId: string) {
  const reg = await EventRegistration.findOne({ event: eventId, user: userId });
  if (!reg) throw AppError.notFound('Registration not found');
  await reg.deleteOne();
  const event = await CollaborationEvent.findById(eventId);
  if (event && event.registeredCount > 0) {
    event.registeredCount -= 1;
    await event.save();
  }
}

export async function listMyRegistrations(userId: string, filters: ListMyRegistrationsQuery) {
  const { page, pageSize, skip, limit } = applyPagination({
    page: filters.page,
    pageSize: filters.pageSize,
  });
  const where = { user: new Types.ObjectId(userId) };
  const [rows, total] = await Promise.all([
    EventRegistration.find(where).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
    EventRegistration.countDocuments(where),
  ]);
  const eventIds = rows.map((r) => r.event);
  const events =
    eventIds.length > 0
      ? await CollaborationEvent.find({ _id: { $in: eventIds } })
          .select('_id title startAt mode status hostType host')
          .lean()
      : [];
  const eventMap = new Map(events.map((e) => [String(e._id), e]));
  const items = await Promise.all(
    rows.map(async (r) => {
      const e = eventMap.get(String(r.event));
      return {
        ...r,
        id: String(r._id),
        event: e
          ? {
              id: String(e._id),
              title: String(e.title),
              startAt: e.startAt,
              mode: e.mode,
              status: e.status,
              host: {
                id: String(e.host),
                name: await resolveHostName(e.hostType as 'COMPANY' | 'INSTITUTION', e.host),
              },
            }
          : null,
      };
    }),
  );
  return buildPaginated(items, total, page, pageSize);
}

export async function listEventRegistrations(
  eventId: string,
  userId: string,
  role: Role,
  filters: ListEventRegistrationsQuery,
) {
  await assertHostOrAdmin(eventId, userId, role);
  const { page, pageSize, skip, limit } = applyPagination({
    page: filters.page,
    pageSize: filters.pageSize,
  });
  const where = { event: new Types.ObjectId(eventId) };
  const [rows, total] = await Promise.all([
    EventRegistration.find(where).sort({ createdAt: 1 }).skip(skip).limit(limit).lean(),
    EventRegistration.countDocuments(where),
  ]);
  const userIds = rows.map((r) => r.user);
  const users =
    userIds.length > 0
      ? await User.find({ _id: { $in: userIds } })
          .select('_id email role')
          .lean()
      : [];
  const userMap = new Map(users.map((u) => [String(u._id), u]));
  const items = rows.map((r) => {
    const u = userMap.get(String(r.user));
    return {
      ...r,
      id: String(r._id),
      user: u ? { id: String(u._id), email: String(u.email), role: String(u.role) } : null,
    };
  });
  return buildPaginated(items, total, page, pageSize);
}

export async function markAttended(
  actorUserId: string,
  role: Role,
  eventId: string,
  attendeeUserId: string,
) {
  await assertHostOrAdmin(eventId, actorUserId, role);
  const reg = await EventRegistration.findOne({ event: eventId, user: attendeeUserId });
  if (!reg) throw AppError.notFound('Registration not found');
  reg.attendedAt = new Date();
  await reg.save();
  await createNotification(
    attendeeUserId,
    'ANNOUNCEMENT',
    'Attendance marked',
    'Your attendance has been recorded for a recent event.',
    '/student/events/registrations',
  );
  return reg.toJSON();
}
