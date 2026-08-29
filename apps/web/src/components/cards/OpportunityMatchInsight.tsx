import { FiCheckCircle, FiAlertCircle, FiTrendingUp } from 'react-icons/fi';
import type { Proficiency } from '@aip/config';
import type { OpportunityMatchInsight } from '@/hooks/queries/useRecommendations';

interface OpportunityMatchInsightProps {
  insight: OpportunityMatchInsight;
  eligible: boolean;
  /** Optional skill ratio string like "8/10 required skills" */
  skillRatio?: string;
  /**
   * Phase 4: optional list of proficiency gaps. Each gap says the student has
   * the skill but at a lower level than required. When provided, these are
   * surfaced as actionable "level up" warnings below the missing-skills line.
   */
  proficiencyGaps?: ProficiencyGapItem[];
}

export interface ProficiencyGapItem {
  id: string;
  name: string;
  requiredLevel: Proficiency;
  studentLevel: Proficiency | null;
  gapLevels: number;
  missing: boolean;
}

const PROFICIENCY_LABEL: Record<Proficiency, string> = {
  BEGINNER: 'Beginner',
  INTERMEDIATE: 'Intermediate',
  ADVANCED: 'Advanced',
  EXPERT: 'Expert',
};

export default function OpportunityMatchInsight({
  insight,
  eligible,
  skillRatio,
  proficiencyGaps,
}: OpportunityMatchInsightProps) {
  // Only show up to 2 proficiency gaps to keep the card compact.
  const visibleGaps = (proficiencyGaps ?? []).slice(0, 2);
  return (
    <div className="pt-3 border-t border-slate-100 dark:border-slate-800 space-y-1.5">
      <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">
        Why this matches you
      </p>

      {/* One-line summary from the API */}
      {insight.summary && (
        <p className="text-xs text-slate-600 dark:text-slate-300">{insight.summary}</p>
      )}

      {/* Skill ratio badge */}
      {skillRatio && (
        <div className="flex items-center gap-1.5 text-xs text-emerald-700 dark:text-emerald-400">
          <FiCheckCircle className="w-3.5 h-3.5 shrink-0" />
          <span>{skillRatio}</span>
        </div>
      )}

      {/* Career interest match */}
      {insight.careerInterestsMatch.length > 0 && (
        <div className="flex items-center gap-1.5 text-xs text-emerald-700 dark:text-emerald-400">
          <FiCheckCircle className="w-3.5 h-3.5 shrink-0" />
          <span>Matches your career interest: {insight.careerInterestsMatch[0]}</span>
        </div>
      )}

      {/* Eligibility */}
      {eligible ? (
        <div className="flex items-center gap-1.5 text-xs text-emerald-700 dark:text-emerald-400">
          <FiCheckCircle className="w-3.5 h-3.5 shrink-0" />
          <span>You&apos;re eligible for this role</span>
        </div>
      ) : (
        <div className="flex items-center gap-1.5 text-xs text-amber-700 dark:text-amber-400">
          <FiAlertCircle className="w-3.5 h-3.5 shrink-0" />
          <span>Check eligibility requirements</span>
        </div>
      )}

      {/* Missing skills warnings */}
      {insight.topMissingSkills.length > 0 && (
        <div className="flex items-start gap-1.5 text-xs text-amber-700 dark:text-amber-400">
          <FiAlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
          <span>Improve {insight.topMissingSkills.join(' & ')}</span>
        </div>
      )}

      {/* Phase 4: per-skill proficiency gaps — student has it, just below the
          required level. Compact, two-line max. */}
      {visibleGaps.length > 0 && (
        <div className="flex items-start gap-1.5 text-xs text-indigo-700 dark:text-indigo-400">
          <FiTrendingUp className="w-3.5 h-3.5 shrink-0 mt-0.5" />
          <span>
            Level up:{' '}
            {visibleGaps
              .map((g) =>
                g.missing
                  ? `add ${g.name}`
                  : `${g.name} (${PROFICIENCY_LABEL[g.studentLevel ?? 'BEGINNER']} → ${PROFICIENCY_LABEL[g.requiredLevel]})`,
              )
              .join(', ')}
          </span>
        </div>
      )}
    </div>
  );
}
