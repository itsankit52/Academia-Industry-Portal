import type { Request, Response } from 'express';
import { asyncHandler } from '../../utils/asyncHandler';
import { ok } from '../../utils/apiResponse';
import type { ChatInput, JobMatchExplainInput, ResumeAnalyzeInput } from '@aip/validation';
import { analyzeResumeText, chatOnce, explainJobMatch } from './ai.service';

export const analyzeResume = asyncHandler(async (req: Request, res: Response) => {
  const { text } = req.body as ResumeAnalyzeInput;
  const result = await analyzeResumeText(text);
  ok(res, result);
});

export const jobMatch = asyncHandler(async (req: Request, res: Response) => {
  const input = req.body as JobMatchExplainInput;
  const result = await explainJobMatch(req.user!.id, input);
  ok(res, result);
});

export const chat = asyncHandler(async (req: Request, res: Response) => {
  const { message } = req.body as ChatInput;
  const result = await chatOnce(message);
  ok(res, result);
});
