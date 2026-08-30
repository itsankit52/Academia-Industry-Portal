/**
 * Phase 10 — Placement Controller
 *
 * Exposes the placement-readiness, outcome aggregation, intervention, and
 * skill-outcome intelligence endpoints following existing module conventions.
 *
 * All student endpoints require authentication and resolve the student
 * server-side (no studentId from client). Institution endpoints use the
 * existing resolveInstitutionId helper from institution-analytics.
 *
 * RBAC:
 *   STUDENT    → own readiness + outcomes only
 *   INSTITUTION → own students only
 *   ADMIN       → cross-institution (via institutionId param)
 *   COMPANY/FACULTY → not permitted
 */

import type { Request, Response } from 'express';
import { asyncHandler } from '../../utils/asyncHandler';
import { ok } from '../../utils/apiResponse';
import { AppError } from '../../utils/AppError';
import { buildPlacementReadiness } from './placement-readiness.service';
import { getStudentOutcomes } from './placement-outcomes.service';
import { getInstitutionInterventions } from './intervention.service';
import { getSkillOutcomeAnalytics } from './skill-outcomes.service';
import {
  resolveInstitutionId,
} from '../institution-analytics/institution-analytics.service';
import { buildInstitutionReadiness } from './placement-readiness.service';
import { getInstitutionOutcomes } from './placement-outcomes.service';
import type { InstitutionPlacementReadiness, ReadinessLevelCount } from '@aip/types';
import { PLACEMENT_READINESS_BANDS } from '@aip/types';

/* ─── Student endpoints ─────────────────────────────────────────────── */

export const placementReadinessForMe = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const userId = req.user!.id;
    if (!userId) throw AppError.unauthorized('Authentication required');
    const result = await buildPlacementReadiness({ studentUserId: userId });
    ok(res, result);
  },
);

export const placementOutcomesForMe = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const userId = req.user!.id;
    if (!userId) throw AppError.unauthorized('Authentication required');
    const result = await getStudentOutcomes({ studentUserId: userId });
    ok(res, result);
  },
);

/* ─── Institution endpoints ─────────────────────────────────────────── */

export const institutionPlacementReadiness = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const { institutionId: qId } = req.query as { institutionId?: string };
    const institutionId = await resolveInstitutionId(req.user!.id, req.user!.role, qId);

    // Build readiness for every student in the institution.
    const readiness = await buildInstitutionReadiness({ institutionId });

    // Aggregate distribution by readiness level.
    const levelCounts = new Map<string, number>();
    for (const band of PLACEMENT_READINESS_BANDS) {
      levelCounts.set(band.level, 0);
    }
    for (const s of readiness.perStudent) {
      levelCounts.set(s.level, (levelCounts.get(s.level) ?? 0) + 1);
    }
    const total = readiness.perStudent.length;
    const readinessDistribution: ReadinessLevelCount[] = PLACEMENT_READINESS_BANDS.map((band) => {
      const count = levelCounts.get(band.level) ?? 0;
      return {
        level: band.level,
        count,
        percentage: total > 0 ? Math.round((count / total) * 1000) / 10 : 0,
      };
    });

    const allScores = readiness.perStudent.map((s) => s.score);
    const avgScore =
      allScores.length > 0
        ? Math.round(allScores.reduce((a, b) => a + b, 0) / allScores.length)
        : 0;

    const placementReadyCount =
      (levelCounts.get('PLACEMENT_READY') ?? 0) + (levelCounts.get('NEARLY_READY') ?? 0);
    const needsInterventionCount =
      (levelCounts.get('NEEDS_IMPROVEMENT') ?? 0) + (levelCounts.get('NOT_READY') ?? 0);

    // Fetch institution outcomes.
    const outcomes = await getInstitutionOutcomes(institutionId);

    const response: InstitutionPlacementReadiness = {
      institutionId: String(institutionId),
      totalStudents: total,
      readinessDistribution,
      placementReadyCount,
      nearlyReadyCount: levelCounts.get('NEARLY_READY') ?? 0,
      needsInterventionCount,
      averageScore: avgScore,
      byBranch: readiness.perBranch.map((b) => ({
        branch: b.branch,
        total: b.total,
        averageScore: b.score,
        byLevel: Object.fromEntries(
          PLACEMENT_READINESS_BANDS.map((band) => [band.level, 0]),
        ) as Record<import('@aip/types').PlacementReadinessLevel, number>,
      })),
      outcomes,
      generatedAt: new Date().toISOString(),
      insufficientData: total === 0,
    };

    ok(res, response);
  },
);

export const institutionInterventions = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const { institutionId: qId } = req.query as { institutionId?: string };
    const institutionId = await resolveInstitutionId(req.user!.id, req.user!.role, qId);
    const result = await getInstitutionInterventions({ institutionId });
    ok(res, result);
  },
);

export const skillOutcomeAnalytics = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const { institutionId: qId } = req.query as { institutionId?: string };
    const institutionId = await resolveInstitutionId(req.user!.id, req.user!.role, qId);
    const result = await getSkillOutcomeAnalytics({ institutionId });
    ok(res, result);
  },
);
