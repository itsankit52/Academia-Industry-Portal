/**
 * Phase 15C — Event Attendance → Skill Development Pipeline
 *
 * When a student is marked as attended at a collaboration event, the system
 * can record the event's associated skills as evidence of skill development.
 * The mechanism is deliberately conservative:
 *
 * - Skills are added at BEGINNER proficiency (never EXPERT).
 * - A skill already recorded at INTERMEDIATE or higher is NOT downgraded.
 * - The registration's `skillsProcessed` set tracks which skills have been
 *   processed for that registration, so duplicate attendance calls do not
 *   create duplicate evidence (idempotency).
 * - The system never inflates proficiency past the existing level.
 * - Only students benefit from this pipeline; other roles do not gain skills.
 *
 * This module is intentionally side-effect-safe: if a step fails (e.g. the
 * student profile is missing), we log and continue rather than rolling back
 * the attendance itself.
 */

import { Types } from 'mongoose';
import type { Role } from '@aip/config';
import {
  CollaborationEvent,
  EventRegistration,
  Skill,
  StudentProfile,
  StudentSkill,
  User,
} from '../../models';
import { AppError } from '../../utils/AppError';

export interface ProcessEventSkillsResult {
  registrationId: string;
  processed: number;
  skipped: number;
  /** Skill IDs that were newly added at BEGINNER proficiency. */
  added: string[];
  /** Skill IDs already on the profile (no change). */
  alreadyPresent: string[];
}

/**
 * Process the skills attached to an event registration for skill development.
 *
 * Idempotency: when called multiple times, only skills not yet in
 * `registration.skillsProcessed` will be processed. Re-calling after a
 * successful run is a no-op.
 *
 * Returns counts so the calling endpoint can surface them in a response or
 * notification.
 */
export async function processEventSkillsForRegistration(
  registrationId: string,
): Promise<ProcessEventSkillsResult> {
  if (!Types.ObjectId.isValid(registrationId)) {
    throw AppError.notFound('Registration not found');
  }

  const reg = await EventRegistration.findById(registrationId);
  if (!reg) throw AppError.notFound('Registration not found');

  if (!reg.attendedAt) {
    throw AppError.badRequest('Student must be marked attended before processing skills');
  }

  const event = await CollaborationEvent.findById(reg.event).select('skills');
  if (!event) throw AppError.notFound('Event not found');

  const eventSkills = (event.skills ?? []) as Types.ObjectId[];
  if (eventSkills.length === 0) {
    return {
      registrationId,
      processed: 0,
      skipped: 0,
      added: [],
      alreadyPresent: [],
    };
  }

  const alreadyProcessed = new Set<string>(
    ((reg.skillsProcessed ?? []) as Types.ObjectId[]).map((id) => String(id)),
  );

  // Filter out skills already processed.
  const skillsToProcess = eventSkills.filter((id) => !alreadyProcessed.has(String(id)));
  if (skillsToProcess.length === 0) {
    return {
      registrationId,
      processed: 0,
      skipped: eventSkills.length,
      added: [],
      alreadyPresent: [],
    };
  }

  // Resolve user → student profile. Only students get skill evidence.
  const user = await User.findById(reg.user).select('role').lean();
  if (!user || user.role !== 'STUDENT') {
    // Non-student registrations are valid but they never create skill evidence.
    return {
      registrationId,
      processed: 0,
      skipped: skillsToProcess.length,
      added: [],
      alreadyPresent: [],
    };
  }
  const student = await StudentProfile.findOne({ user: reg.user }).select('_id').lean();
  if (!student) {
    return {
      registrationId,
      processed: 0,
      skipped: skillsToProcess.length,
      added: [],
      alreadyPresent: [],
    };
  }

  // Verify the skills exist before writing.
  const validSkillDocs = await Skill.find({ _id: { $in: skillsToProcess } })
    .select('_id')
    .lean();
  const validSkillIds = validSkillDocs.map((s) => s._id as Types.ObjectId);

  if (validSkillIds.length === 0) {
    // Mark them as processed so we don't retry next time.
    reg.skillsProcessed = Array.from(
      new Set([
        ...((reg.skillsProcessed ?? []) as Types.ObjectId[]).map(String),
        ...skillsToProcess.map(String),
      ]),
    ).map((s) => new Types.ObjectId(s));
    await reg.save();
    return {
      registrationId,
      processed: 0,
      skipped: skillsToProcess.length,
      added: [],
      alreadyPresent: [],
    };
  }

  // Look up existing StudentSkill rows for this student.
  const existing = await StudentSkill.find({
    student: student._id,
    skill: { $in: validSkillIds },
  })
    .select('skill proficiency')
    .lean();
  const existingMap = new Map(
    existing.map((e) => [String(e.skill), String(e.proficiency)] as const),
  );

  const added: string[] = [];
  const alreadyPresent: string[] = [];

  for (const skillId of validSkillIds) {
    const sid = String(skillId);
    if (existingMap.has(sid)) {
      alreadyPresent.push(sid);
      continue;
    }
    // Add at BEGINNER — never inflate past what the system has measured.
    await StudentSkill.create({
      student: student._id,
      skill: skillId,
      proficiency: 'BEGINNER',
    });
    added.push(sid);
  }

  // Persist idempotency marker. This MUST be done even if some skills were
  // skipped, so subsequent calls won't re-process them.
  const newProcessed = [
    ...((reg.skillsProcessed ?? []) as Types.ObjectId[]).map(String),
    ...validSkillIds.map(String),
    ...skillsToProcess
      .filter((s) => !validSkillIds.some((v) => String(v) === String(s)))
      .map(String),
  ];
  reg.skillsProcessed = Array.from(new Set(newProcessed)).map((s) => new Types.ObjectId(s));
  await reg.save();

  return {
    registrationId,
    processed: added.length,
    skipped: alreadyPresent.length + (skillsToProcess.length - validSkillIds.length),
    added,
    alreadyPresent,
  };
}

/**
 * Helper to be called from a host's markAttended action. Does not throw
 * if processing fails; returns a result so the caller can attach it to the
 * response.
 */
export async function tryProcessEventSkills(
  registrationId: string,
  actorUserId: string,
  role: Role,
): Promise<ProcessEventSkillsResult | null> {
  try {
    // Only hosts/admins should be able to trigger this. Validate the actor
    // is allowed to mark attendance on this event.
    const reg = await EventRegistration.findById(registrationId).select('event user');
    if (!reg) return null;
    const event = await CollaborationEvent.findById(reg.event).select('host hostType postedBy');
    if (!event) return null;
    if (role !== 'ADMIN' && String(event.postedBy) !== actorUserId) {
      return null;
    }
    return processEventSkillsForRegistration(registrationId);
  } catch {
    return null;
  }
}
