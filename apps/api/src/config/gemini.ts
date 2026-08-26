import { GoogleGenerativeAI, type GenerativeModel } from '@google/generative-ai';
import { env } from './env';
import { AppError } from '../utils/AppError';

let client: GoogleGenerativeAI | null = null;

export function isGeminiConfigured(): boolean {
  return Boolean(env.GEMINI_API_KEY);
}

export function getGeminiClient(): GoogleGenerativeAI {
  if (!isGeminiConfigured()) {
    throw AppError.serviceUnavailable('AI is not configured');
  }
  if (!client) {
    client = new GoogleGenerativeAI(env.GEMINI_API_KEY);
  }
  return client;
}

export function getModel(): GenerativeModel {
  return getGeminiClient().getGenerativeModel({ model: env.GEMINI_MODEL });
}

export function getModelName(): string {
  return env.GEMINI_MODEL;
}
