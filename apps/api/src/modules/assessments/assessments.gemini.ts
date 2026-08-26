import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import type { AssessmentAnswer, AssessmentQuestion } from '@aip/types';
import { getModel } from '../../config/gemini';
import { AppError } from '../../utils/AppError';
import { logger } from '../../utils/logger';

const rawQuestionSchema = z.object({
  text: z.string().min(1),
  targetSkills: z.array(z.string()).default([]),
  expectedConcepts: z.array(z.string()).default([]),
  maxMarks: z.number().min(1).max(100).default(10),
});

const rawGenerationSchema = z.object({
  questions: z.array(rawQuestionSchema).min(1),
});

const rawPerQuestionSchema = z.object({
  questionId: z.string().min(1),
  score: z.number().min(0),
  feedback: z.string().default(''),
});

const rawEvaluationSchema = z.object({
  perQuestion: z.array(rawPerQuestionSchema),
  overallFeedback: z.string().default(''),
  strengths: z.string().default(''),
  weaknesses: z.string().default(''),
});

export function buildGenerationPrompt(skillNames: string[], questionCount: number): string {
  const skillList = skillNames.length > 0 ? skillNames.join(', ') : 'general software engineering';
  return `You are creating a technical skill assessment for a student.

Skills to assess: ${skillList}

Generate exactly ${questionCount} short-answer questions (each answerable in 2-4 sentences) that test the student's understanding of these skills. Vary difficulty from easy to hard. Each question should focus on one or two of the given skills.

Return ONLY valid JSON matching this schema, with no markdown fences, no prose:
{
  "questions": [
    {
      "text": "The question prompt (1-3 sentences)",
      "targetSkills": ["skill1"],
      "expectedConcepts": ["concept1", "concept2", "concept3"],
      "maxMarks": 10
    }
  ]
}`;
}

export function buildEvaluationPrompt(
  questions: AssessmentQuestion[],
  answers: AssessmentAnswer[],
): string {
  const answerMap = new Map<string, string>();
  for (const a of answers) answerMap.set(a.questionId, a.text ?? '');

  const blocks = questions
    .map((q, idx) => {
      const answer = answerMap.get(q.id);
      const answerText = answer && answer.trim().length > 0 ? answer : '(no answer provided)';
      const skills = q.targetSkills.length > 0 ? q.targetSkills.join(', ') : 'general';
      const concepts = q.expectedConcepts.length > 0 ? q.expectedConcepts.join(', ') : 'general understanding';
      return `Q${idx + 1} [id: ${q.id}] [maxMarks: ${q.maxMarks}] [skills: ${skills}] [expected concepts: ${concepts}]
Question: ${q.text}
Answer: ${answerText}
---`;
    })
    .join('\n');

  return `You are an expert evaluator scoring a student's short-answer assessment.

For each Q&A pair, evaluate the student's answer on:
- Correctness: does it match the expected concepts?
- Relevance: does it address the question?
- Understanding: does it show conceptual grasp?
- Completeness: does it cover the key points?

Award a score from 0 to maxMarks per question. Then provide an overall summary.

Return ONLY valid JSON, no markdown fences, no prose:
{
  "perQuestion": [
    { "questionId": "the exact ID from the Q", "score": integer, "feedback": "1-2 sentence feedback" }
  ],
  "overallFeedback": "1-2 sentence summary",
  "strengths": "1-2 sentences on what the student did well",
  "weaknesses": "1-2 sentences on what to improve"
}

Assessments:

${blocks}`;
}

function extractJson(text: string): string {
  const stripped = text
    .replace(/^\s*```(?:json)?\s*/i, '')
    .replace(/\s*```\s*$/i, '')
    .trim();
  const firstBrace = stripped.indexOf('{');
  const lastBrace = stripped.lastIndexOf('}');
  if (firstBrace === -1 || lastBrace === -1 || lastBrace <= firstBrace) {
    throw new Error('No JSON object found in Gemini response');
  }
  return stripped.slice(firstBrace, lastBrace + 1);
}

async function callGemini(prompt: string): Promise<string> {
  const model = getModel();
  const result = await model.generateContent(prompt);
  return result.response.text();
}

export async function generateQuestions(
  skillNames: string[],
  questionCount: number,
): Promise<AssessmentQuestion[]> {
  const prompt = buildGenerationPrompt(skillNames, questionCount);
  try {
    const raw = await callGemini(prompt);
    const jsonText = extractJson(raw);
    const parsed = JSON.parse(jsonText) as unknown;
    const validated = rawGenerationSchema.parse(parsed);
    return validated.questions.map((q) => ({
      id: randomUUID(),
      text: q.text,
      targetSkills: q.targetSkills,
      expectedConcepts: q.expectedConcepts,
      maxMarks: q.maxMarks,
    }));
  } catch (err) {
    logger.error({ err }, 'Gemini question generation failed');
    throw AppError.internal('AI service returned an invalid response');
  }
}

export interface EvaluationResult {
  perQuestion: Array<{ questionId: string; score: number; feedback: string }>;
  overallFeedback: string;
  strengths: string;
  weaknesses: string;
}

export async function evaluateAnswers(
  questions: AssessmentQuestion[],
  answers: AssessmentAnswer[],
): Promise<EvaluationResult> {
  const prompt = buildEvaluationPrompt(questions, answers);
  try {
    const raw = await callGemini(prompt);
    const jsonText = extractJson(raw);
    const parsed = JSON.parse(jsonText) as unknown;
    const validated = rawEvaluationSchema.parse(parsed);
    const knownIds = new Set(questions.map((q) => q.id));
    const perQuestion = validated.perQuestion
      .filter((pq) => knownIds.has(pq.questionId))
      .map((pq) => {
        const question = questions.find((q) => q.id === pq.questionId);
        const cap = question?.maxMarks ?? pq.score;
        return {
          questionId: pq.questionId,
          score: Math.max(0, Math.min(cap, pq.score)),
          feedback: pq.feedback,
        };
      });
    return {
      perQuestion,
      overallFeedback: validated.overallFeedback,
      strengths: validated.strengths,
      weaknesses: validated.weaknesses,
    };
  } catch (err) {
    logger.error({ err }, 'Gemini answer evaluation failed');
    throw AppError.internal('AI service returned an invalid response');
  }
}
