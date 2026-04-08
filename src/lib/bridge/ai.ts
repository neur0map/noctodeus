import { invoke } from '@tauri-apps/api/core';
import type { AiProvider, ChatRequest } from '$lib/ai/types';

export async function aiChat(request: ChatRequest): Promise<string> {
  return invoke<string>('ai_chat', { request });
}

export async function aiChatCancel(): Promise<void> {
  return invoke('ai_chat_cancel');
}

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
