import type { Request, Response } from 'express';
import { asyncHandler } from '../../utils/asyncHandler';
import { ok } from '../../utils/apiResponse';
import { AppError } from '../../utils/AppError';
import type { OpportunityType } from '@aip/config';
import {
  computeSkillsGap,
  recommendInternships,
  recommendJobs,
  recommendLearning,
  recommendTrainings,
  type LearningRecommendationsParams,
} from './recommendations.service';
import {
  getPersonalizedRecommendations,
  enrichPersonalizedRecommendations,
} from './personalization.service';
import { analyzeFullMatch, type FullMatchAnalysis } from '../matching/fullMatch.service';
import {
  getCareerPathAnalysis,
  getCareerActionPlan,
  getCareerBenchmark,
  getReadinessProgression,
  type CareerPathInput,
  type CareerActionPlanInput,
  type CareerInsightsInput,
  buildCareerInsights,
} from './careerAnalysis.service';

function requireUserId(req: Request): string {
  const id = req.user?.id;
  if (!id) throw AppError.unauthorized('Authentication required');
  return id;
}

function pageParams(req: Request): { page?: number; pageSize?: number } {
  const q = req.query as Record<string, unknown>;
  return {
    page: q.page ? Number(q.page) : undefined,
    pageSize: q.pageSize ? Number(q.pageSize) : undefined,
  };
}

export const jobsForMe = asyncHandler(async (req: Request, res: Response) => {
  const userId = requireUserId(req);
  const result = await recommendJobs(userId, pageParams(req));
  ok(res, result);
});

export const internshipsForMe = asyncHandler(async (req: Request, res: Response) => {
  const userId = requireUserId(req);
  const result = await recommendInternships(userId, pageParams(req));
  ok(res, result);
});

export const trainingsForMe = asyncHandler(async (req: Request, res: Response) => {
  const userId = requireUserId(req);
  const result = await recommendTrainings(userId, pageParams(req));
  ok(res, result);
});

export const skillsGap = asyncHandler(async (req: Request, res: Response) => {
  const userId = requireUserId(req);
  const result = await computeSkillsGap(userId);
  ok(res, result);
});

export const learningForMe = asyncHandler(async (req: Request, res: Response) => {
  const userId = requireUserId(req);
  const q = req.query as Record<string, unknown>;
  const params: LearningRecommendationsParams = {
    ...pageParams(req),
    targetOpportunityId:
      typeof q.targetOpportunityId === 'string' ? q.targetOpportunityId : undefined,
    targetOpportunityType:
      q.targetOpportunityType === 'JOB' || q.targetOpportunityType === 'INTERNSHIP'
        ? (q.targetOpportunityType as OpportunityType)
        : undefined,
  };
  const result = await recommendLearning(userId, params);
  ok(res, result);
});

/**
 * Phase 9A — Unified personalized dashboard payload.
 *
 * Resolves the authenticated user server-side; the client never sends a
 * student id. Composes existing recommendation/matching services so the math
 * stays in one place.
 */
export const personalizedForMe = asyncHandler(async (req: Request, res: Response) => {
  const userId = requireUserId(req);
  const result = await getPersonalizedRecommendations(userId);
  ok(res, result);
});

/**
 * Returns the full multi-dimensional match analysis between the calling student
 * and a specific opportunity (job or internship). Reuses `analyzeFullMatch` —
 * no new business logic, just an HTTP surface for the existing deterministic
 * engine. Phase 4: makes the per-opportunity breakdown (skill match %,
 * proficiency gaps, career alignment, eligibility, industry demand) available
 * to the student UI without re-implementing the math.
 */
export const fullMatchForMe = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const userId = requireUserId(req);
  const { type, id } = req.params as { type?: string; id?: string };
  if (type !== 'JOB' && type !== 'INTERNSHIP') {
    throw AppError.badRequest("type must be either 'JOB' or 'INTERNSHIP'");
  }
  if (!id || !/^[a-fA-F0-9]{24}$/.test(id)) {
    throw AppError.badRequest('id must be a 24-character ObjectId');
  }
  const result: FullMatchAnalysis = await analyzeFullMatch(userId, type as OpportunityType, id);
  ok(res, result);
});

/* ─── Phase 9B — Career Decision Support ─────────────────────────── */

/**
 * Phase 9B — Career path analysis for a target opportunity.
 *
 * GET /api/recommendations/me/career-path/:type/:id
 *
 * Reuses the fullMatch engine for readiness math and composes Phase 9A
 * pieces (training + mentor recommendations) for the action list.
 * Validates the opportunity type and id server-side.
 */
export const careerPathForMe = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const userId = requireUserId(req);
    const { type, id } = req.params as { type?: string; id?: string };
    if (type !== 'JOB' && type !== 'INTERNSHIP') {
      throw AppError.badRequest("type must be either 'JOB' or 'INTERNSHIP'");
    }
    if (!id || !/^[a-fA-F0-9]{24}$/.test(id)) {
      throw AppError.badRequest('id must be a 24-character ObjectId');
    }
    const input: CareerPathInput = {
      studentUserId: userId,
      opportunityType: type as OpportunityType,
      opportunityId: id,
    };
    const result = await getCareerPathAnalysis(input);
    ok(res, result);
  },
);

/**
 * Phase 9B — Personalized career action plan.
 *
 * GET /api/recommendations/me/action-plan
 * GET /api/recommendations/me/action-plan?opportunityId=...&opportunityType=...
 *
 * Returns a prioritized list of actions. When opportunityId is provided,
 * the plan focuses on closing gaps for that specific opportunity.
 */
export const actionPlanForMe = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const userId = requireUserId(req);
  const q = req.query as Record<string, unknown>;
  const oppId = typeof q.opportunityId === 'string' ? q.opportunityId.trim() : '';
  const oppType =
    q.opportunityType === 'JOB' || q.opportunityType === 'INTERNSHIP'
      ? (q.opportunityType as OpportunityType)
      : undefined;
  const input: CareerActionPlanInput = {
    studentUserId: userId,
    opportunityId: oppId || undefined,
    opportunityType: oppType,
  };
  const result = await getCareerActionPlan(input);
  ok(res, result);
});

/**
 * Phase 9B — Privacy-safe peer benchmark.
 *
 * GET /api/recommendations/me/benchmark
 *
 * Returns aggregate-only data. available is false when the peer sample
 * is insufficient. Never exposes individual student data.
 */
export const benchmarkForMe = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const userId = requireUserId(req);
  const result = await getCareerBenchmark(userId);
  ok(res, result);
});

/**
 * Phase 9B — Career readiness progression.
 *
 * GET /api/recommendations/me/progression?currentScore=...
 *
 * The currentScore is optional; when omitted it is inferred from the
 * unified recommendations payload the caller already holds.
 */
export const progressionForMe = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const userId = requireUserId(req);
  const q = req.query as Record<string, unknown>;
  const currentScore =
    typeof q.currentScore === 'string' && !isNaN(Number(q.currentScore))
      ? Number(q.currentScore)
      : 0;
  const result = await getReadinessProgression({ studentUserId: userId, currentScore });
  ok(res, result);
});

/**
 * Phase 9B — Enrich Phase 9A personalized recommendations with deep insights.
 *
 * PATCH /api/recommendations/me/insights
 *
 * Used internally by the enrich step; not a public route.
 * Returns only the new Phase 9B fields (careerInsights, benchmark, progression).
 */
export const enrichInsights = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const userId = requireUserId(req);
    const q = req.query as Record<string, unknown>;
    const currentScore =
      typeof q.currentScore === 'string' && !isNaN(Number(q.currentScore))
        ? Number(q.currentScore)
        : 0;
    const [benchmark, progression] = await Promise.all([
      getCareerBenchmark(userId),
      getReadinessProgression({ studentUserId: userId, currentScore }),
    ]);
    ok(res, { benchmark, progression });
  },
);

