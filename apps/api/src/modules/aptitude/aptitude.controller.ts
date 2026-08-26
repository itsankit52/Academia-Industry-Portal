import type { Request, Response } from 'express';
import type {
  CreateAptitudeQuestionInput,
  ListAptitudeQuestionsQuery,
  ListMyAptitudeTestsQuery,
  SaveAptitudeAnswerInput,
  StartAptitudeTestInput,
  UpdateAptitudeQuestionInput,
} from '@aip/validation';
import { asyncHandler } from '../../utils/asyncHandler';
import { ok, created, noContent } from '../../utils/apiResponse';
import * as service from './aptitude.service';

function num(v: unknown): number | undefined {
  if (v === undefined || v === null || v === '') return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
}

function str(v: unknown): string | undefined {
  return typeof v === 'string' && v.length > 0 ? v : undefined;
}

export const listCategories = asyncHandler(async (_req: Request, res: Response) => {
  const data = await service.listCategoriesWithCounts();
  return ok(res, data);
});

export const startTest = asyncHandler(async (req: Request, res: Response) => {
  const body = req.body as StartAptitudeTestInput;
  const test = await service.startTest(req.user!.id, body.category, body.questionCount);
  return created(res, test);
});

export const listMyTests = asyncHandler(async (req: Request, res: Response) => {
  const q = req.query as Record<string, unknown>;
  const data = await service.listMyTests(
    req.user!.id,
    {
      page: num(q.page),
      pageSize: num(q.pageSize),
      sortBy: str(q.sortBy),
      sortDir: q.sortDir === 'asc' ? 'asc' : 'desc',
    },
    {
      page: 1,
      pageSize: 12,
      sortDir: 'desc',
      ...(str(q.category) ? { category: str(q.category) as ListMyAptitudeTestsQuery['category'] } : {}),
      ...(str(q.status) ? { status: str(q.status) as ListMyAptitudeTestsQuery['status'] } : {}),
    } as ListMyAptitudeTestsQuery,
  );
  return ok(res, data);
});

export const getMyTest = asyncHandler(async (req: Request, res: Response) => {
  const data = await service.getMyTest(req.params.id!, req.user!.id);
  return ok(res, data);
});

export const saveAnswer = asyncHandler(async (req: Request, res: Response) => {
  const body = req.body as SaveAptitudeAnswerInput;
  const data = await service.saveAnswer(req.params.id!, req.user!.id, body.questionId, body.chosenIndex);
  return ok(res, data);
});

export const submitTest = asyncHandler(async (req: Request, res: Response) => {
  const data = await service.submitTest(req.params.id!, req.user!.id);
  return ok(res, data);
});

export const listQuestions = asyncHandler(async (req: Request, res: Response) => {
  const q = req.query as Record<string, unknown>;
  const data = await service.listQuestions(
    {
      page: num(q.page),
      pageSize: num(q.pageSize),
      sortBy: str(q.sortBy),
      sortDir: q.sortDir === 'asc' ? 'asc' : 'desc',
    },
    {
      page: 1,
      pageSize: 12,
      sortDir: 'desc',
      ...(str(q.category) ? { category: str(q.category) as ListAptitudeQuestionsQuery['category'] } : {}),
      ...(str(q.difficulty)
        ? { difficulty: str(q.difficulty) as ListAptitudeQuestionsQuery['difficulty'] }
        : {}),
      ...(str(q.status) ? { status: str(q.status) as ListAptitudeQuestionsQuery['status'] } : {}),
      ...(str(q.search) ? { search: str(q.search) } : {}),
    } as ListAptitudeQuestionsQuery,
  );
  return ok(res, data);
});

export const createQuestion = asyncHandler(async (req: Request, res: Response) => {
  const data = await service.createQuestion(req.body as CreateAptitudeQuestionInput);
  return created(res, data);
});

export const updateQuestion = asyncHandler(async (req: Request, res: Response) => {
  const data = await service.updateQuestion(
    req.params.id!,
    req.body as UpdateAptitudeQuestionInput,
  );
  return ok(res, data);
});

export const archiveQuestion = asyncHandler(async (req: Request, res: Response) => {
  await service.archiveQuestion(req.params.id!);
  return noContent(res);
});
