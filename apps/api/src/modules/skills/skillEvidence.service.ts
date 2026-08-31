/**
 * Phase 15B — Skill Evidence Service
 *
 * Creates verifiable evidence of skill development from training completion.
 *
 * Philosophy:
 * - Completing a course does NOT automatically upgrade proficiency to EXPERT.
 * - Evidence is created as a record of training completion with covered skills.
 * - Students should reassess skills after training to demonstrate improvement.
 *
 * Evidence types:
 * - TRAINING_COMPLETED: training enrollment completion with covered skills
 * - EVENT_ATTENDED: event/workshop attendance
 *
 * Evidence is stored on the StudentSkill.evidenceUrl field or as metadata.
 */
import { Types } from 'mongoose';
import { AppError } from '../../utils/AppError';
import {
  Skill,
  StudentProfile,
  StudentSkill,
  TrainingEnrollment,
  TrainingProgram,
  EventRegistration,
  CollaborationEvent,
} from '../../models';

/**
 * Evidence record for a student's skill development.
 */
export interface SkillEvidenceRecord {
  skillId: string;
  skillName: string;
  evidenceType: 'TRAINING_COMPLETED' | 'EVENT_ATTENDED' | 'ASSESSMENT_PASSED';
  sourceId: string;
  sourceTitle: string;
  certificateId?: string;
  completedAt: string;
  hours?: number;
}

/**
 * Add training evidence to a student's skill profile.
 *
 * This is called when a student completes a training enrollment.
 * It records the training completion as evidence without changing proficiency.
 *
 * Does NOT auto-upgrade proficiency — only creates evidence.
 */
export async function addTrainingEvidenceToSkills(
  userId: string,
  enrollmentId: string,
): Promise<{ enrollmentId: string; evidenceRecords: SkillEvidenceRecord[] }> {
  const enrollment = await TrainingEnrollment.findById(enrollmentId)
    .populate('training')
    .populate({ path: 'student', select: 'user' });

  if (!enrollment) throw AppError.notFound('Enrollment not found');

  // Verify ownership
  const studentUserId = (enrollment.student as unknown as { user?: { _id?: unknown } })?.user?._id;
  if (String(studentUserId) !== userId) {
    throw AppError.forbidden('Not your enrollment');
  }

  if (enrollment.status !== 'COMPLETED') {
    throw AppError.badRequest('Enrollment is not completed');
  }

  const training = enrollment.training as unknown as {
    _id: unknown;
    title: string;
    skills: Array<{ _id: unknown; name: string }>;
    provider: string;
  };

  if (!training.skills || training.skills.length === 0) {
    return { enrollmentId: String(enrollment._id), evidenceRecords: [] };
  }

  const skillIds = training.skills.map((s) => String(s._id ?? s));
  const skillRows = await Skill.find({ _id: { $in: skillIds } })
    .select('name')
    .lean();
  const nameMap = new Map(skillRows.map((s) => [String(s._id), String(s.name)]));

  const studentId = enrollment.student as unknown as { _id: unknown };
  const evidenceRecords: SkillEvidenceRecord[] = [];

  for (const skillId of skillIds) {
    const skillName = nameMap.get(skillId) ?? skillId;

    // Update or create StudentSkill with evidence
    const existing = await StudentSkill.findOne({
      student: studentId._id,
      skill: new Types.ObjectId(skillId),
    });

    if (existing) {
      // Update evidenceUrl with training reference
      const evidenceUrl = `/training/${String(enrollment._id)}`;
      existing.evidenceUrl = evidenceUrl;
      await existing.save();
    }
    // If no existing skill, we don't auto-create it — student should add it manually

    evidenceRecords.push({
      skillId,
      skillName,
      evidenceType: 'TRAINING_COMPLETED',
      sourceId: String(enrollment._id),
      sourceTitle: training.title,
      certificateId: enrollment.certificateId ? String(enrollment.certificateId) : undefined,
      completedAt: String(enrollment.completedAt),
      hours: (training as { estimatedHours?: number }).estimatedHours,
    });
  }

  return { enrollmentId: String(enrollment._id), evidenceRecords };
}

/**
 * Add event attendance evidence to a student's skill profile.
 *
 * This is called when a student's event attendance is verified.
 * It records the event attendance as evidence without changing proficiency.
 */
export async function addEventEvidenceToSkills(
  userId: string,
  registrationId: string,
  skillIds: string[],
): Promise<{ registrationId: string; evidenceRecords: SkillEvidenceRecord[] }> {
  const registration = await EventRegistration.findById(registrationId)
    .populate('event')
    .populate('user');

  if (!registration) throw AppError.notFound('Registration not found');

  // Verify ownership
  const registrationUserId = (registration.user as unknown as { _id?: unknown })._id;
  if (String(registrationUserId) !== userId) {
    throw AppError.forbidden('Not your registration');
  }

  if (!registration.attendedAt) {
    throw AppError.badRequest('Attendance not verified yet');
  }

  const event = registration.event as unknown as {
    _id: unknown;
    title: string;
    eventType: string;
  };

  const validSkillIds = skillIds.filter((id) => Types.ObjectId.isValid(id));
  if (validSkillIds.length === 0) {
    return { registrationId: String(registration._id), evidenceRecords: [] };
  }

  const skillRows = await Skill.find({ _id: { $in: validSkillIds } })
    .select('name')
    .lean();
  const nameMap = new Map(skillRows.map((s) => [String(s._id), String(s.name)]));

  const evidenceRecords: SkillEvidenceRecord[] = [];

  for (const skillId of validSkillIds) {
    const skillName = nameMap.get(skillId) ?? skillId;

    evidenceRecords.push({
      skillId,
      skillName,
      evidenceType: 'EVENT_ATTENDED',
      sourceId: String(registration._id),
      sourceTitle: event.title,
      completedAt: String(registration.attendedAt),
    });
  }

  return { registrationId: String(registration._id), evidenceRecords };
}

/**
 * Get skill development evidence for a student.
 *
 * Returns evidence from training completions and event attendances.
 */
export async function getSkillEvidence(
  userId: string,
): Promise<{ trainings: SkillEvidenceRecord[]; events: SkillEvidenceRecord[] }> {
  const profile = await StudentProfile.findOne({ user: new Types.ObjectId(userId) });
  if (!profile) throw AppError.notFound('Student profile not found');

  // Get completed training enrollments
  const enrollments = await TrainingEnrollment.find({
    student: profile._id,
    status: 'COMPLETED',
  })
    .populate('training', 'title skills provider estimatedHours')
    .lean();

  const trainings: SkillEvidenceRecord[] = [];
  for (const enrollment of enrollments) {
    const training = enrollment.training as unknown as {
      _id: unknown;
      title: string;
      skills: Array<{ _id: unknown; name: string }>;
      provider: string;
      estimatedHours?: number;
    };
    if (!training?.skills) continue;

    for (const skill of training.skills) {
      trainings.push({
        skillId: String(skill._id),
        skillName: skill.name,
        evidenceType: 'TRAINING_COMPLETED',
        sourceId: String(enrollment._id),
        sourceTitle: training.title,
        certificateId: enrollment.certificateId ? String(enrollment.certificateId) : undefined,
        completedAt: enrollment.completedAt
          ? String(enrollment.completedAt)
          : String(enrollment.updatedAt),
        hours: training.estimatedHours,
      });
    }
  }

  // Get verified event registrations
  const registrations = await EventRegistration.find({
    user: new Types.ObjectId(userId),
    attendedAt: { $exists: true, $ne: null },
  })
    .populate('event', 'title eventType')
    .lean();

  const events: SkillEvidenceRecord[] = [];
  for (const reg of registrations) {
    const event = reg.event as unknown as {
      _id: unknown;
      title: string;
      eventType: string;
    };
    if (!event) continue;

    events.push({
      skillId: '', // Events don't have specific skills in this simple implementation
      skillName: event.eventType,
      evidenceType: 'EVENT_ATTENDED',
      sourceId: String(reg._id),
      sourceTitle: event.title,
      completedAt: String(reg.attendedAt),
    });
  }

  return { trainings, events };
}

/**
 * Get training completion recommendations for skill improvement.
 *
 * Returns the list of skills covered by completed trainings
 * that the student should reassess to potentially upgrade proficiency.
 */
export async function getSkillsToReassess(userId: string): Promise<{
  skills: Array<{
    id: string;
    name: string;
    trainingTitle: string;
    completedAt: string;
    hasEvidence: boolean;
  }>;
  message: string;
}> {
  const profile = await StudentProfile.findOne({ user: new Types.ObjectId(userId) });
  if (!profile) throw AppError.notFound('Student profile not found');

  // Get completed training enrollments with skills
  const enrollments = await TrainingEnrollment.find({
    student: profile._id,
    status: 'COMPLETED',
  })
    .populate('training', 'title skills')
    .lean();

  const skills: Array<{
    id: string;
    name: string;
    trainingTitle: string;
    completedAt: string;
    hasEvidence: boolean;
  }> = [];

  const seenSkills = new Set<string>();

  for (const enrollment of enrollments) {
    const training = enrollment.training as unknown as {
      _id: unknown;
      title: string;
      skills: Array<{ _id: unknown; name: string }>;
    };
    if (!training?.skills) continue;

    for (const skill of training.skills) {
      const skillId = String(skill._id);
      if (seenSkills.has(skillId)) continue;
      seenSkills.add(skillId);

      // Check if student has this skill in their profile
      const studentSkill = await StudentSkill.findOne({
        student: profile._id,
        skill: new Types.ObjectId(skillId),
      });

      skills.push({
        id: skillId,
        name: skill.name,
        trainingTitle: training.title,
        completedAt: enrollment.completedAt
          ? String(enrollment.completedAt)
          : String(enrollment.updatedAt),
        hasEvidence: Boolean(studentSkill?.evidenceUrl),
      });
    }
  }

  return {
    skills,
    message:
      skills.length > 0
        ? 'Complete a skill reassessment to update your proficiency based on training evidence.'
        : 'No training evidence available for skill reassessment.',
  };
}
