export interface AiProvider {
  id: string;
  name: string;
  baseUrl: string;
  apiKey: string;
  model: string;
}

export interface AiMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  toolCallId?: string;
  toolCalls?: unknown;
  /** Frontend-only: epoch ms when the message was created */
  timestamp?: number;
  /** Frontend-only: true while the assistant message is still streaming */
  streaming?: boolean;
}

export interface ChatRequest {
  provider: AiProvider;
  messages: AiMessage[];
  systemPrompt?: string;
  temperature?: number;
  maxTokens?: number;
}

export interface StreamToken {
  delta: string;
  done: boolean;
}
