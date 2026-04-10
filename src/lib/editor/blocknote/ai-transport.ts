import type { ChatTransport, UIMessage, UIMessageChunk } from 'ai';
import { convertToModelMessages, streamText } from 'ai';
import { getAIModel, getMaxTokens } from '$lib/ai/client';

/**
 * In-process ChatTransport for @blocknote/xl-ai. Runs streamText locally
 * so there's no backend endpoint — the LLM call happens directly from the
 * WebView using the user's configured provider from Settings > AI.
 *
 * xl-ai injects its tool definitions and system prompt via the `body`
 * field on each sendMessages call. We forward those into streamText so
 * the LLM receives BlockNote's block-level document-edit tools, which
 * is what drives the inline diff editing.
 */
export function noctodeusAITransport(): ChatTransport<UIMessage> {
  return {
    async sendMessages({ messages, abortSignal, body }) {
      const model = getAIModel();
      if (!model) {
        throw new Error(
          'AI provider not configured. Open Settings → AI to add a provider and API key.',
        );
      }

      // xl-ai sends tool definitions through the request body as part of
      // its document-edit protocol. Forward them verbatim into streamText
      // so the LLM can emit structured block-level tool calls.
      const tools = (body as { toolDefinitions?: unknown })?.toolDefinitions as
        | Parameters<typeof streamText>[0]['tools']
        | undefined;

      const system = (body as { systemPrompt?: string })?.systemPrompt;

      const modelMessages = await convertToModelMessages(messages);
      const result = streamText({
        model,
        system,
        messages: modelMessages,
        tools,
        toolChoice: tools ? 'required' : 'auto',
        maxOutputTokens: getMaxTokens(),
        abortSignal,
      });

      // `toUIMessageStream()` produces the UIMessageChunk stream xl-ai
      // expects. This bridges the `ai` package output into the format
      // xl-ai parses for its user-reviewing / diff state.
      return result.toUIMessageStream() as unknown as ReadableStream<UIMessageChunk>;
    },

    async reconnectToStream() {
      // In-process transports don't persist state across reloads.
      // xl-ai will fall back to a fresh invoke on retry.
      return null;
    },
  };
}
