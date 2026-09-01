import type { PublicPortfolio } from '@aip/types';
import {
  Application,
  CompanyProfile,
  DocumentModel,
  Institution,
  Internship,
  Skill,
  StudentProfile,
  StudentProject,
  StudentSkill,
  User,
} from '../../models';
import { AppError } from '../../utils/AppError';

export async function getPublicPortfolio(studentId: string): Promise<PublicPortfolio> {
  const profile = await StudentProfile.findById(studentId).lean();
  if (!profile) throw AppError.notFound('Student not found');

  const [institution, studentSkillsRaw, verifiedDocsRaw, completedInternships, customProjects] =
    await Promise.all([
      profile.institution
        ? Institution.findById(profile.institution).select('name code').lean()
        : Promise.resolve(null),
      StudentSkill.find({ student: profile._id }).lean(),
      DocumentModel.find({ user: profile.user, verificationStatus: 'VERIFIED' })
        .sort({ verifiedAt: -1 })
        .lean(),
      // Phase 5B: Pull completed internships for the portfolio
      Application.find({
        student: profile._id,
        opportunityType: 'INTERNSHIP',
        status: { $in: ['ONGOING', 'COMPLETED'] },
      })
        .populate({ path: 'opportunity', populate: { path: 'company', select: 'companyName' } })
        .sort({ completedAt: -1, startedAt: -1 })
        .lean(),
      // Student-managed dedicated projects (separate collection, portfolio-editable)
      StudentProject.find({ student: profile._id, isPublic: true }).sort({ createdAt: -1 }).lean(),
    ]);

  const skillIds = studentSkillsRaw.map((s) => s.skill);
  const skillDocs = skillIds.length
    ? await Skill.find({ _id: { $in: skillIds } })
        .select('name category')
        .lean()
    : [];
  const skillMap = new Map(skillDocs.map((s) => [String(s._id), s]));

  const verifierIds = Array.from(
    new Set(
      verifiedDocsRaw
        .map((d) => (d.verifiedBy ? String(d.verifiedBy) : null))
        .filter(Boolean) as string[],
    ),
  );
  const verifiers = verifierIds.length
    ? await User.find({ _id: { $in: verifierIds } })
        .select('email role')
        .lean()
    : [];
  const verifierMap = new Map(verifiers.map((u) => [String(u._id), u]));

  // Phase 5B: Build internship experience entries
  const internshipExperience = completedInternships
    .filter((app) => {
      const opp = app.opportunity as unknown as { title?: string } | null;
      return Boolean(opp && opp.title);
    })
    .map((app) => {
      const opp = app.opportunity as unknown as {
        _id?: unknown;
        title?: string;
        durationMonths?: number;
        company?: { _id?: unknown; companyName?: string };
        requiredSkills?: unknown[];
      };
      return {
        id: String(app._id),
        title: opp.title ?? 'Internship',
        organization: opp.company?.companyName ?? 'Company',
        startDate: app.startDate ? String(app.startDate) : String(app.startedAt ?? ''),
        endDate: app.completedAt
          ? String(app.completedAt)
          : app.expectedEndDate
            ? String(app.expectedEndDate)
            : undefined,
        status: app.status as string,
        completedAt: app.completedAt ? String(app.completedAt) : undefined,
        durationMonths: opp.durationMonths,
        companyId: opp.company?._id ? String(opp.company._id) : undefined,
        skills: ((opp.requiredSkills ?? []) as unknown[]).map(String),
        description: app.completedAt
          ? `Completed internship: ${opp.title}`
          : `Ongoing internship: ${opp.title}`,
      };
    });

  return {
    student: {
      fullName: profile.fullName as string,
      ...(institution
        ? { institution: { name: institution.name as string, code: institution.code as string } }
        : {}),
      ...(profile.degree ? { degree: profile.degree as string } : {}),
      ...(profile.branch ? { branch: profile.branch as string } : {}),
      ...(typeof profile.graduationYear === 'number'
        ? { graduationYear: profile.graduationYear }
        : {}),
      ...(typeof profile.cgpa === 'number' ? { cgpa: profile.cgpa } : {}),
      ...(profile.bio ? { bio: profile.bio as string } : {}),
      ...(profile.city ? { city: profile.city as string } : {}),
      ...(profile.state ? { state: profile.state as string } : {}),
      ...(profile.college ? { college: profile.college as string } : {}),
      ...(profile.university ? { university: profile.university as string } : {}),
      ...(profile.linkedinUrl ? { linkedinUrl: profile.linkedinUrl as string } : {}),
      ...(profile.githubUrl ? { githubUrl: profile.githubUrl as string } : {}),
      ...(profile.portfolioUrl ? { portfolioUrl: profile.portfolioUrl as string } : {}),
      ...(profile.twitterUrl ? { twitterUrl: profile.twitterUrl as string } : {}),
      ...(profile.careerInterests ? { careerInterests: profile.careerInterests as string } : {}),
      preferredRoles: (profile.preferredRoles ?? []) as string[],
      preferredLocations: (profile.preferredLocations ?? []) as string[],
      softSkills: (profile.softSkills ?? []) as string[],
      education: (profile.education ?? []).map((e) => ({
        institution: e.institution as string,
        degree: e.degree as string,
        ...(e.field ? { field: e.field as string } : {}),
        ...(typeof e.startYear === 'number' ? { startYear: e.startYear } : {}),
        ...(typeof e.endYear === 'number' ? { endYear: e.endYear } : {}),
        ...(e.grade ? { grade: e.grade as string } : {}),
        ...(e.description ? { description: e.description as string } : {}),
      })),
      languages: (profile.languages ?? []).map((l) => ({
        name: l.name as string,
        ...(l.proficiency ? { proficiency: l.proficiency as string } : {}),
      })),
      experience: (profile.experience ?? []).map((e) => ({
        title: e.title as string,
        organization: e.organization as string,
        ...(e.startDate ? { startDate: String(e.startDate) } : {}),
        ...(e.endDate ? { endDate: String(e.endDate) } : {}),
        ...(e.description ? { description: e.description as string } : {}),
      })),
    },
    skills: studentSkillsRaw
      .map((ss) => {
        const sk = skillMap.get(String(ss.skill));
        return {
          name: (sk?.name as string) ?? '',
          proficiency: ss.proficiency as string,
          category: (sk?.category as string) ?? 'OTHER',
        };
      })
      .filter((s) => s.name),
    projects: [
      // Student-managed dedicated projects first (most recent)
      ...customProjects.map((p) => ({
        title: p.title as string,
        description: p.description as string,
        ...(p.role ? { role: p.role as string } : {}),
        ...(p.technologies && (p.technologies as string[]).length > 0
          ? { technologies: p.technologies as string[] }
          : {}),
        ...(p.links && (p.links as Array<{ label?: string; url?: string }>).length > 0
          ? {
              links: (p.links as Array<{ label?: string; url?: string }>).map((l) => ({
                label: l.label ?? '',
                url: l.url ?? '',
              })),
            }
          : {}),
        ...(p.completedAt ? { completedAt: String(p.completedAt) } : {}),
        source: 'student-managed',
      })),
      // Then profile-embedded projects
      ...(profile.projects ?? []).map((p) => ({
        title: p.title as string,
        description: (p.description as string) ?? '',
        ...(p.link ? { link: p.link as string } : {}),
        source: 'profile',
      })),
    ],
    certifications: (profile.certifications ?? []).map((c) => ({
      title: c.title as string,
      issuer: c.issuer as string,
      ...(c.issuedAt ? { verifiedAt: (c.issuedAt as Date).toISOString() } : {}),
    })),
    achievements: (profile.achievements ?? []).map((a) => ({
      title: a.title as string,
      ...(a.description ? { description: a.description as string } : {}),
      ...(a.date ? { date: (a.date as Date).toISOString() } : {}),
    })),
    verifiedDocuments: verifiedDocsRaw.map((d) => {
      const verifier = d.verifiedBy ? verifierMap.get(String(d.verifiedBy)) : undefined;
      return {
        documentType:
          d.documentType as PublicPortfolio['verifiedDocuments'][number]['documentType'],
        ...(d.title ? { title: d.title as string } : {}),
        ...(d.issuer ? { issuer: d.issuer as string } : {}),
        ...(d.verifiedAt ? { verifiedAt: (d.verifiedAt as Date).toISOString() } : {}),
        ...(verifier ? { verifiedBy: (verifier.email as string) ?? String(verifier._id) } : {}),
      };
    }),
    experience: (profile.experience ?? []).map((e) => ({
      title: e.title as string,
      organization: e.organization as string,
      ...(e.startDate ? { startDate: String(e.startDate) } : {}),
      ...(e.endDate ? { endDate: String(e.endDate) } : {}),
      ...(e.description ? { description: e.description as string } : {}),
    })),
    // Phase 5B: completed/ongoing internships as a separate section
    internships: internshipExperience,
  } as PublicPortfolio;
}
