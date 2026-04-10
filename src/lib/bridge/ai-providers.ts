import { invoke } from '@tauri-apps/api/core';
import type { AiProvider } from '$lib/ai/types';

/**
 * Provider preset list surfaced by the Rust backend for the Settings > AI
 * dropdown. Chat completions themselves happen JS-side via the Vercel AI
 * SDK — this module only exposes the preset catalog and the /models
 * endpoint helper.
 */
export async function aiProviders(): Promise<AiProvider[]> {
  return invoke<AiProvider[]>('ai_providers');
}

export interface ModelInfo {
  id: string;
  ownedBy: string | null;
}

export async function aiModels(baseUrl: string, apiKey: string): Promise<ModelInfo[]> {
  return invoke<ModelInfo[]>('ai_models', { baseUrl, apiKey });
}
