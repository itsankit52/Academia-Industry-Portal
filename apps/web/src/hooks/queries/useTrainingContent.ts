/**
 * Phase 15B — Training Content Hooks
 *
 * Hooks for browsing training modules/lessons and marking lessons as complete.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { apiGet, apiPost } from '@/lib/api';

// ---------------------------------------------------------------------------
// Types — mirror TrainingContentView from trainingContent.service.ts
// ---------------------------------------------------------------------------

export interface TrainingContentLesson {
  id: string;
  title: string;
  type: string;
  durationMinutes: number;
  order: number;
}

export interface TrainingContentModule {
  id: string;
  title: string;
  description?: string;
  order: number;
  lessons: TrainingContentLesson[];
}

export interface TrainingContentView {
  training: { id: string; title: string; contentType?: string; difficulty?: string };
  modules: TrainingContentModule[];
  totalLessons: number;
}

export interface ReassessmentRecommendation {
  enrollmentId: string;
  trainingTitle: string;
  coveredSkills: Array<{ id: string; name: string }>;
  message: string;
}

// ---------------------------------------------------------------------------
// Training content queries
// ---------------------------------------------------------------------------

export function useTrainingContent(trainingId: string) {
  return useQuery({
    queryKey: ['training-content', trainingId],
    queryFn: () => apiGet<TrainingContentView>(`/training/${trainingId}/content`),
    enabled: !!trainingId,
  });
}

// ---------------------------------------------------------------------------
// Lesson completion mutation
// ---------------------------------------------------------------------------

export interface CompleteLessonResult {
  enrollment: unknown;
  lesson: { id: string; title: string };
  totalLessons: number;
  completedCount: number;
  progress: number;
}

export function useCompleteLesson(trainingId: string, enrollmentId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (lessonId: string) =>
      apiPost<CompleteLessonResult>(`/training/${trainingId}/lessons/complete`, { lessonId }),
    onSuccess: (result) => {
      qc.invalidateQueries({ queryKey: ['training-content', trainingId] });
      qc.invalidateQueries({ queryKey: ['training', 'enrollment', enrollmentId] });
      qc.invalidateQueries({ queryKey: ['training', 'enrollments'] });
      toast.success(`"${result.lesson.title}" marked complete. Progress: ${result.progress}%`);
    },
    onError: (err: Error) => {
      toast.error(err.message ?? 'Failed to mark lesson complete.');
    },
  });
}

// ---------------------------------------------------------------------------
// Reassessment recommendation
// ---------------------------------------------------------------------------

export function useReassessmentRecommendation(enrollmentId: string) {
  return useQuery({
    queryKey: ['training-reassess', enrollmentId],
    queryFn: () =>
      apiGet<ReassessmentRecommendation>(`/training/enrollments/${enrollmentId}/reassess`),
    enabled: !!enrollmentId,
  });
}
