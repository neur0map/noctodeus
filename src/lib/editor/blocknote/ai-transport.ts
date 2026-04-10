import type { ChatTransport, UIMessage, UIMessageChunk } from 'ai';
import { convertToModelMessages, streamText } from 'ai';
import {
  injectDocumentStateMessages,
  toolDefinitionsToToolSet,
} from '@blocknote/xl-ai/server';
import { getAIModel, getMaxTokens } from '$lib/ai/client';

/**
 * In-process ChatTransport for @blocknote/xl-ai. Runs streamText locally
 * so there's no backend endpoint — the LLM call happens directly from the
 * WebView using the user's configured provider from Settings > AI.
 *
 * This mirrors xl-ai's own `ClientSideTransport` (internal) so we get the
 * full document-edit protocol: xl-ai sends tool definitions + current
 * document state in the request body, we convert them with xl-ai's
 * server-side helpers, then call streamText with the resulting ToolSet.
 * The LLM emits structured tool calls (add/update/delete block) that
 * xl-ai renders as inline diffs for accept/reject review.
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

      // xl-ai sends its tool definitions (serializable JSON-Schema shape)
      // in the request body. We must convert them into a real ToolSet
      // via xl-ai's own helper before handing off to streamText.
      const toolDefinitions = (body as { toolDefinitions?: any })?.toolDefinitions;
      const tools = toolDefinitions ? toolDefinitionsToToolSet(toolDefinitions) : undefined;

      // xl-ai injects the current document HTML as part of the messages
      // so the LLM has full context about what it's editing. Without this
      // the AI would have no idea what document it's editing.
      const modelMessages = await convertToModelMessages(
        injectDocumentStateMessages(messages),
      );

      const result = streamText({
        model,
        messages: modelMessages,
        tools,
        toolChoice: tools ? 'required' : 'auto',
        maxOutputTokens: getMaxTokens(),
        abortSignal,
      });

      return result.toUIMessageStream() as unknown as ReadableStream<UIMessageChunk>;
    },

    async reconnectToStream() {
      // In-process transports don't persist state across reloads.
      return null;
    },
  };
}
