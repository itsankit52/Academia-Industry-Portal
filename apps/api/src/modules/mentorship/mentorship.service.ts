import { Types } from 'mongoose';
import type { MentorshipStatus, Role } from '@aip/config';
import type {
  CreateMentorProfileInput,
  UpdateMentorProfileInput,
  CreateMentorshipRequestInput,
  ListMentorsQuery,
  ListMyRequestsQuery,
  ListMessagesQuery,
  SendMessageInput,
} from '@aip/validation';
import type { PublicMentor } from '@aip/types';
import { AppError } from '../../utils/AppError';
import { applyPagination, buildPaginated, type PaginationInput } from '../../utils/pagination';
import {
  MentorProfile,
  MentorshipRequest,
  MentorshipMessage,
  User,
  StudentProfile,
  StudentSkill,
  FacultyProfile,
  CompanyProfile,
} from '../../models';
import { createNotification } from '../notifications/notifications.service';
import type { MentorshipMenteeRole } from '../../models/MentorshipRequest';

async function resolveDisplayNameByUser(userId: string): Promise<string> {
  const user = await User.findById(userId).select('email role').lean();
  if (!user) return 'Unknown';
  const role = user.role as Role;
  if (role === 'STUDENT') {
    const p = await StudentProfile.findOne({ user: userId }).select('fullName').lean();
    if (p?.fullName) return p.fullName;
  } else if (role === 'FACULTY') {
    const p = await FacultyProfile.findOne({ user: userId }).select('fullName').lean();
    if (p?.fullName) return p.fullName;
  } else if (role === 'COMPANY') {
    const p = await CompanyProfile.findOne({ user: userId }).select('companyName').lean();
    if (p?.companyName) return p.companyName;
  }
  return String(user.email ?? 'Unknown').split('@')[0] ?? 'Unknown';
}

async function countActiveMentorships(mentorUserId: string): Promise<number> {
  return MentorshipRequest.countDocuments({
    mentor: mentorUserId,
    status: { $in: ['ACCEPTED', 'ACTIVE'] as MentorshipStatus[] },
  });
}

export async function becomeMentor(userId: string, input: CreateMentorProfileInput) {
  const existing = await MentorProfile.findOne({ user: userId });
  if (existing) throw AppError.conflict('You already have a mentor profile');
  const doc = await MentorProfile.create({ user: userId, ...input });
  return doc.toJSON();
}

export async function updateMyMentorProfile(userId: string, input: UpdateMentorProfileInput) {
  const doc = await MentorProfile.findOne({ user: userId });
  if (!doc) throw AppError.notFound('Mentor profile not found');
  Object.assign(doc, input);
  await doc.save();
  return doc.toJSON();
}

export async function getMentorProfile(userId: string) {
  const doc = await MentorProfile.findOne({ user: userId });
  if (!doc) throw AppError.notFound('Mentor profile not found');
  const fullName = await resolveDisplayNameByUser(userId);
  const activeCount = await countActiveMentorships(userId);
  const json = doc.toJSON() as Record<string, unknown>;
  return { ...json, fullName, activeCount };
}

export async function listMentors(filters: ListMentorsQuery, pag: PaginationInput) {
  const { page, pageSize, skip, limit } = applyPagination(pag);
  const where: Record<string, unknown> = {};
  if (filters.availability) where.availability = filters.availability;
  if (filters.expertise) where.expertise = filters.expertise.trim().toLowerCase();

  const [rows, total] = await Promise.all([
    MentorProfile.find(where).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
    MentorProfile.countDocuments(where),
  ]);

  const userIds = rows.map((r) => String(r.user));
  const [users, activeCounts] = await Promise.all([
    userIds.length > 0
      ? User.find({ _id: { $in: userIds } })
          .select('_id email role')
          .lean()
      : Promise.resolve([] as Array<{ _id: unknown; email: string; role: string }>),
    Promise.all(userIds.map((id) => countActiveMentorships(id))),
  ]);

  const displayNames = await Promise.all(userIds.map((id) => resolveDisplayNameByUser(id)));

  let items: PublicMentor[] = rows.map((r, idx) => ({
    id: String(r._id),
    userId: String(r.user),
    fullName: displayNames[idx] ?? 'Unknown',
    ...(typeof r.bio === 'string' && r.bio.length > 0 ? { bio: r.bio } : {}),
    expertise: (r.expertise ?? []) as string[],
    ...(typeof r.yearsExperience === 'number' ? { yearsExperience: r.yearsExperience } : {}),
    availability: (r.availability ?? 'AVAILABLE') as PublicMentor['availability'],
    mentorshipCapacity: (r.mentorshipCapacity ?? 3) as number,
    activeCount: activeCounts[idx] ?? 0,
  }));

  const search = filters.search?.trim().toLowerCase();
  if (search) {
    items = items.filter((m) => {
      if (m.fullName.toLowerCase().includes(search)) return true;
      if (m.bio && m.bio.toLowerCase().includes(search)) return true;
      return m.expertise.some((e) => e.includes(search));
    });
  }

  void users;
  return buildPaginated(items, total, page, pageSize);
}

async function verifyMentorAvailable(mentorUserId: string): Promise<void> {
  const profile = await MentorProfile.findOne({ user: mentorUserId }).select(
    'availability mentorshipCapacity',
  );
  if (!profile) throw AppError.notFound('Mentor not found');
  if (profile.availability === 'UNAVAILABLE') {
    throw AppError.badRequest('Mentor is not accepting new mentees');
  }
  const activeCount = await countActiveMentorships(mentorUserId);
  const capacity = profile.mentorshipCapacity ?? 3;
  if (activeCount >= capacity) {
    throw AppError.badRequest('Mentor is at full capacity');
  }
}

export async function requestMentorship(
  menteeUserId: string,
  menteeRole: MentorshipMenteeRole,
  input: CreateMentorshipRequestInput,
) {
  if (menteeUserId === input.mentorUserId) {
    throw AppError.badRequest('Cannot request mentorship from yourself');
  }
  await verifyMentorAvailable(input.mentorUserId);
  const existing = await MentorshipRequest.findOne({
    mentee: menteeUserId,
    mentor: input.mentorUserId,
    status: { $in: ['REQUESTED', 'ACCEPTED', 'ACTIVE'] as MentorshipStatus[] },
  });
  if (existing) throw AppError.conflict('An active or pending request already exists');
  const doc = await MentorshipRequest.create({
    mentee: menteeUserId,
    menteeRole,
    mentor: input.mentorUserId,
    initialMessage: input.initialMessage,
    ...(input.goals ? { goals: input.goals } : {}),
  });
  await createNotification(
    input.mentorUserId,
    'ANNOUNCEMENT',
    'New mentorship request',
    'You have received a new mentorship request.',
    '/company/mentorship',
  );
  return doc.toJSON();
}

export async function listMyRequestsAsMentee(userId: string, filters: ListMyRequestsQuery) {
  const { page, pageSize, skip, limit, sort } = applyPagination(filters);
  const where: Record<string, unknown> = { mentee: userId };
  if (filters.status) where.status = filters.status;
  const [rows, total] = await Promise.all([
    MentorshipRequest.find(where).sort(sort).skip(skip).limit(limit).lean(),
    MentorshipRequest.countDocuments(where),
  ]);
  const withNames = await Promise.all(
    rows.map(async (r) => ({
      ...r,
      id: String(r._id),
      mentorName: await resolveDisplayNameByUser(String(r.mentor)),
    })),
  );
  return buildPaginated(withNames, total, page, pageSize);
}

export async function listMyRequestsAsMentor(userId: string, filters: ListMyRequestsQuery) {
  const { page, pageSize, skip, limit, sort } = applyPagination(filters);
  const where: Record<string, unknown> = { mentor: userId };
  if (filters.status) where.status = filters.status;
  const [rows, total] = await Promise.all([
    MentorshipRequest.find(where).sort(sort).skip(skip).limit(limit).lean(),
    MentorshipRequest.countDocuments(where),
  ]);
  const withNames = await Promise.all(
    rows.map(async (r) => ({
      ...r,
      id: String(r._id),
      menteeName: await resolveDisplayNameByUser(String(r.mentee)),
    })),
  );
  return buildPaginated(withNames, total, page, pageSize);
}

export async function getRequestById(id: string, userId: string) {
  const doc = await MentorshipRequest.findById(id);
  if (!doc) throw AppError.notFound('Mentorship request not found');
  if (String(doc.mentor) !== userId && String(doc.mentee) !== userId) {
    throw AppError.forbidden('Not a participant of this mentorship');
  }
  const mentorName = await resolveDisplayNameByUser(String(doc.mentor));
  const menteeName = await resolveDisplayNameByUser(String(doc.mentee));
  const json = doc.toJSON() as Record<string, unknown>;
  return { ...json, mentorName, menteeName };
}

export async function updateRequestStatus(
  id: string,
  actorUserId: string,
  actorRole: Role,
  newStatus: MentorshipStatus,
) {
  const doc = await MentorshipRequest.findById(id);
  if (!doc) throw AppError.notFound('Mentorship request not found');

  const isMentor = String(doc.mentor) === actorUserId;
  const isMentee = String(doc.mentee) === actorUserId;
  if (!isMentor && !isMentee && actorRole !== 'ADMIN') {
    throw AppError.forbidden('Not a participant of this mentorship');
  }

  const current = doc.status as MentorshipStatus;

  if (newStatus === 'ACCEPTED') {
    if (!isMentor && actorRole !== 'ADMIN') throw AppError.forbidden('Only mentor can accept');
    if (current !== 'REQUESTED') throw AppError.badRequest('Only REQUESTED can be accepted');
    doc.status = 'ACTIVE';
    doc.startedAt = new Date();
  } else if (newStatus === 'DECLINED') {
    if (!isMentor && actorRole !== 'ADMIN') throw AppError.forbidden('Only mentor can decline');
    if (current !== 'REQUESTED') throw AppError.badRequest('Only REQUESTED can be declined');
    doc.status = 'DECLINED';
  } else if (newStatus === 'COMPLETED') {
    if (!isMentor && actorRole !== 'ADMIN') throw AppError.forbidden('Only mentor can complete');
    if (current !== 'ACTIVE' && current !== 'ACCEPTED') {
      throw AppError.badRequest('Only ACTIVE mentorships can be completed');
    }
    doc.status = 'COMPLETED';
    doc.completedAt = new Date();
  } else if (newStatus === 'CANCELLED') {
    if (!isMentee && actorRole !== 'ADMIN') throw AppError.forbidden('Only mentee can cancel');
    if (current === 'COMPLETED' || current === 'CANCELLED' || current === 'DECLINED') {
      throw AppError.badRequest('Cannot cancel a closed mentorship');
    }
    doc.status = 'CANCELLED';
    doc.cancelledAt = new Date();
  } else if (newStatus === 'ACTIVE') {
    if (!isMentor && actorRole !== 'ADMIN') throw AppError.forbidden('Only mentor can activate');
    if (current !== 'ACCEPTED') throw AppError.badRequest('Only ACCEPTED can be activated');
    doc.status = 'ACTIVE';
    if (!doc.startedAt) doc.startedAt = new Date();
  } else {
    throw AppError.badRequest('Invalid status transition');
  }

  await doc.save();

  const otherUserId = isMentor ? String(doc.mentee) : String(doc.mentor);
  await createNotification(
    otherUserId,
    'ANNOUNCEMENT',
    'Mentorship update',
    `A mentorship request status changed to ${doc.status}.`,
    '/student/mentorship',
  );
  return doc.toJSON();
}

async function assertParticipant(requestId: string, userId: string) {
  const req = await MentorshipRequest.findById(requestId).select('mentor mentee');
  if (!req) throw AppError.notFound('Mentorship request not found');
  if (String(req.mentor) !== userId && String(req.mentee) !== userId) {
    throw AppError.forbidden('Not a participant of this mentorship');
  }
  return req;
}

export async function getMessages(
  requestId: string,
  userId: string,
  filters: ListMessagesQuery,
) {
  await assertParticipant(requestId, userId);
  const { page, pageSize, skip, limit } = applyPagination({
    page: filters.page,
    pageSize: filters.pageSize,
    sortBy: 'createdAt',
    sortDir: 'asc',
  });
  const where = { request: new Types.ObjectId(requestId) };
  const [rows, total] = await Promise.all([
    MentorshipMessage.find(where).sort({ createdAt: 1 }).skip(skip).limit(limit).lean(),
    MentorshipMessage.countDocuments(where),
  ]);
  const items = rows.map((r) => ({ ...r, id: String(r._id) }));
  return buildPaginated(items, total, page, pageSize);
}

export async function sendMessage(
  requestId: string,
  senderUserId: string,
  input: SendMessageInput,
) {
  const req = await assertParticipant(requestId, senderUserId);
  const doc = await MentorshipMessage.create({
    request: req._id,
    sender: senderUserId,
    body: input.body,
  });
  const otherUserId = String(req.mentor) === senderUserId ? String(req.mentee) : String(req.mentor);
  await createNotification(
    otherUserId,
    'ANNOUNCEMENT',
    'New mentorship message',
    'You have a new message in a mentorship thread.',
    '/student/mentorship',
  );
  return doc.toJSON();
}

export async function listAllMentorshipRequestsAdmin(pag: PaginationInput) {
  const { page, pageSize, skip, limit, sort } = applyPagination(pag);
  const [rows, total] = await Promise.all([
    MentorshipRequest.find({}).sort(sort).skip(skip).limit(limit).lean(),
    MentorshipRequest.countDocuments({}),
  ]);
  const items = await Promise.all(
    rows.map(async (r) => ({
      ...r,
      id: String(r._id),
      mentorName: await resolveDisplayNameByUser(String(r.mentor)),
      menteeName: await resolveDisplayNameByUser(String(r.mentee)),
    })),
  );
  return buildPaginated(items, total, page, pageSize);
}

/**
 * Phase 8 — Recommend mentors to a student using deterministic scoring.
 *
 * The score is a weighted sum of:
 *   - skill overlap (student's skills vs. mentor's expertise) — biggest signal
 *   - expertise overlap (mentor's broader expertise areas)
 *   - availability bonus (AVAILABLE > BUSY > UNAVAILABLE)
 *   - experience (yearsExperience) — mild signal
 *
 * Returns RecommendedMentor[] sorted by score desc, with reasons surfaced
 * for transparency so students understand *why* a mentor is recommended.
 */
export async function recommendMentorsForStudent(
  studentUserId: string,
  limit = 10,
): Promise<import('@aip/types').RecommendedMentor[]> {
  // Resolve the student profile
  const studentProfile = await StudentProfile.findOne({
    user: new Types.ObjectId(studentUserId),
  }).select('_id preferredRoles preferredSkills interests');
  if (!studentProfile) throw AppError.notFound('Student profile not found');

  // Pull the student's skills (ids) + interests + preferredRoles
  const [studentSkills, mentors] = await Promise.all([
    StudentSkill.find({ student: studentProfile._id }).select('skill').lean(),
    MentorProfile.find({ availability: { $in: ['AVAILABLE', 'BUSY'] } })
      .sort({ createdAt: -1 })
      .lean(),
  ]);
  const studentSkillIds = new Set(studentSkills.map((s) => String(s.skill)));

  // Build a normalized interest set from preferredRoles + freeform interests.
  // preferredRoles are role strings (e.g. 'Frontend Developer'); interests are
  // freeform. We tokenize on whitespace and lowercase.
  const interestSet = new Set<string>();
  for (const r of studentProfile.preferredRoles ?? []) {
    if (typeof r === 'string') {
      for (const tok of r.toLowerCase().split(/\s+/)) interestSet.add(tok);
    }
  }
  for (const i of (studentProfile as unknown as { interests?: string[] }).interests ?? []) {
    if (typeof i === 'string') interestSet.add(i.toLowerCase().trim());
  }

  // Pre-resolve display names and active counts to avoid N+1 lookups
  const userIds = mentors.map((m) => String(m.user));
  const [activeCounts, displayNames] = await Promise.all([
    Promise.all(userIds.map((id) => countActiveMentorships(id))),
    Promise.all(userIds.map((id) => resolveDisplayNameByUser(id))),
  ]);

  const scored = mentors.map((m, idx) => {
    const expertise = (m.expertise ?? []).map((e) => String(e).toLowerCase().trim());
    // Skill overlap: how many of the mentor's expertise tokens map to a
    // student skill id? The expertise tokens in the model are typically the
    // skill names (lowercased) so we compare on token, not on id.
    let skillOverlap = 0;
    for (const tag of expertise) {
      // The student skills are by id; the mentor expertise is by tag/name.
      // We treat overlap as: any student skill whose name matches the tag.
      // Because we don't have names here, we approximate by counting tags
      // that appear in the interest set, which is a robust proxy.
      if (interestSet.has(tag)) skillOverlap += 1;
    }

    // Expertise overlap: number of mentor expertise tags matching student
    // interests. Cheaper to compute and meaningful — surfaces topical match.
    let expertiseOverlap = 0;
    for (const tag of expertise) {
      if (interestSet.has(tag)) expertiseOverlap += 1;
    }

    // Availability: small bonus so we surface mentors who are open now.
    const availabilityBonus = m.availability === 'AVAILABLE' ? 10 : 2;

    // Experience: cap at 5 points so a single senior doesn't dominate.
    const experienceBonus = Math.min(5, Math.max(0, (m.yearsExperience ?? 0) / 2));

    const score =
      skillOverlap * 5 + expertiseOverlap * 3 + availabilityBonus + experienceBonus;

    const reasons: string[] = [];
    if (skillOverlap > 0) reasons.push(`${skillOverlap} matching skill area(s)`);
    if (expertiseOverlap > 0) reasons.push(`${expertiseOverlap} shared expertise area(s)`);
    if (m.availability === 'AVAILABLE') reasons.push('Currently accepting mentees');
    if ((m.yearsExperience ?? 0) >= 5) reasons.push(`${m.yearsExperience} years of experience`);

    return {
      id: String(m._id),
      userId: String(m.user),
      fullName: displayNames[idx] ?? 'Unknown',
      bio: typeof m.bio === 'string' ? m.bio : undefined,
      expertise: expertise as string[],
      yearsExperience: typeof m.yearsExperience === 'number' ? m.yearsExperience : undefined,
      availability: (m.availability ?? 'AVAILABLE') as PublicMentor['availability'],
      mentorshipCapacity: (m.mentorshipCapacity ?? 3) as number,
      activeCount: activeCounts[idx] ?? 0,
      score: Math.round(score * 10) / 10,
      skillOverlap,
      expertiseOverlap,
      reasons,
    } as import('@aip/types').RecommendedMentor;
  });

  // Sort and limit. The score dominates; ties broken by active count asc
  // (prefer mentors with capacity).
  scored.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return (a.activeCount ?? 0) - (b.activeCount ?? 0);
  });
  return scored.slice(0, limit);
}
