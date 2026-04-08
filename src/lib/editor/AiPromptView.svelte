<script lang="ts">
  import type { Editor } from '@tiptap/core';
  import type { Node as ProseMirrorNode } from '@tiptap/pm/model';
  import { onMount, untrack } from 'svelte';
  import { fade, fly } from 'svelte/transition';
  import Sparkles from '@lucide/svelte/icons/sparkles';
  import ArrowUp from '@lucide/svelte/icons/arrow-up';
  import LoaderCircle from '@lucide/svelte/icons/loader-circle';
  import { aiChat, aiChatCancel } from '$lib/bridge/ai';
  import { ragContext } from '$lib/bridge/rag';
  import { parseMarkdown } from './serializer';
  import {
    buildInlineLoadingLabel,
    shouldUseInlineContext,
    tryGenerateInlineMarkdown,
  } from './inline-ai';
  import { errorMessage } from '$lib/utils/errors';
  import type { AiPromptRequestContext } from './extensions/ai-prompt';

  type PromptState = 'input' | 'loading' | 'preview';

  interface Props {
    node: ProseMirrorNode;
    editor: Editor;
    getPos: () => number | undefined;
    updateAttributes: (attrs: Record<string, unknown>) => void;
    getRequestContext: () => AiPromptRequestContext;
  }

  const INLINE_AI_SYSTEM_PROMPT = `You are the inline editor for Noctodeus. You generate content that will be inserted
directly into the user's note at their cursor position.

Rules:
- Output ONLY raw markdown. No greetings, no explanations, no "here you go".
- Never wrap output in a code fence unless the user explicitly asks for code.
- Match the tone and style of the surrounding note content when possible.
- For tables: use standard markdown table syntax.
- For lists: use - or 1. syntax.
- For code: use fenced code blocks with language identifier.
- For headings: match the heading level context when the surrounding note clearly implies one.
- Keep output focused and concise. Don't over-generate.`;

  let {
    node: initialNode,
    editor,
    getPos,
    updateAttributes,
    getRequestContext,
  }: Props = $props();

  let nodeState: ProseMirrorNode = $state(untrack(() => initialNode));
  let rootEl: HTMLDivElement | undefined = $state();
  let inputEl: HTMLInputElement | undefined = $state();
  let inputValue = $state(untrack(() => String(initialNode.attrs.prompt ?? '')));
  let errorText = $state('');
  let prefersReducedMotion = $state(false);
  let activeRequestId = $state(0);

  let promptState: PromptState = $derived((nodeState.attrs.state ?? 'input') as PromptState);
  let generatedHtml = $derived(String(nodeState.attrs.generatedHtml ?? ''));
  let loadingLabel = $derived(buildInlineLoadingLabel(String(nodeState.attrs.prompt ?? inputValue)));
  let canSubmit = $derived(inputValue.trim().length > 0);

  let headingHint: { level: number; text: string } | null = $derived(getHeadingHint(nodeState));

  export function sync(nextNode: ProseMirrorNode) {
    nodeState = nextNode;

    const prompt = String(nextNode.attrs.prompt ?? '');
    if (prompt) {
      inputValue = prompt;
    }
  }

  function getHeadingHint(currentNode: ProseMirrorNode) {
    const pos = getPos();
    if (typeof pos !== 'number') {
      return null;
    }

    let hint: { level: number; text: string } | null = null;

    editor.state.doc.descendants((descendant, descendantPos) => {
      if (descendantPos >= pos) {
        return false;
      }

      if (descendant.type.name === 'heading') {
        hint = {
          level: Number(descendant.attrs.level ?? 1),
          text: descendant.textContent.trim(),
        };
      }

      return true;
    });

    return hint;
  }

  function getPromptPosition() {
    const pos = getPos();

    if (typeof pos !== 'number') {
      throw new Error('The inline AI prompt is no longer attached to the document.');
    }

    return {
      from: pos,
      to: pos + nodeState.nodeSize,
    };
  }

  function getSurroundingExcerpt(limit = 1000) {
    const { from, to } = getPromptPosition();
    const start = Math.max(0, from - limit);
    const end = Math.min(editor.state.doc.content.size, to + limit);

    const before = editor.state.doc.textBetween(start, from, '\n', '\n').trim();
    const after = editor.state.doc.textBetween(to, end, '\n', '\n').trim();

    return { before, after };
  }

  async function buildSystemPrompt(prompt: string) {
    const requestContext = getRequestContext();
    const includeContext = shouldUseInlineContext(prompt);
    const { before, after } = includeContext
      ? getSurroundingExcerpt(420)
      : { before: '', after: '' };

    let noteContext = '';
    if (includeContext && (before || after)) {
      noteContext = [
        'Surrounding note content near the cursor:',
        before ? `Before cursor:\n${before}` : 'Before cursor:\n(start of note)',
        after ? `After cursor:\n${after}` : 'After cursor:\n(end of note)',
      ].join('\n\n');
    }

    let rag = '';
    if (includeContext && requestContext.corePath) {
      try {
        rag = await ragContext(prompt, requestContext.corePath, 600);
      } catch {
        rag = '';
      }
    }

    const sections = [
      INLINE_AI_SYSTEM_PROMPT,
      includeContext && requestContext.activeFilePath
        ? `Active note path: ${requestContext.activeFilePath}`
        : '',
      includeContext && headingHint
        ? `The last heading before the cursor is H${headingHint.level}${headingHint.text ? `: ${headingHint.text}` : ''}.`
        : '',
      noteContext,
      rag ? `Relevant vault context:\n${rag}` : '',
    ].filter(Boolean);

    return sections.join('\n\n');
  }

  async function submitPrompt() {
    const prompt = inputValue.trim();
    if (!prompt || promptState === 'loading') {
      return;
    }

    const requestContext = getRequestContext();
    if (!requestContext.provider) {
      errorText = 'Configure an AI provider in Settings > AI to use inline generation.';
      return;
    }

    errorText = '';
    const requestId = activeRequestId + 1;
    activeRequestId = requestId;

    const localMarkdown = tryGenerateInlineMarkdown(prompt);
    if (localMarkdown) {
      insertHtmlIntoEditor(parseMarkdown(localMarkdown).trim());
      return;
    }

    updateAttributes({
      prompt,
      state: 'loading',
      generatedHtml: '',
    });

    try {
      const systemPrompt = await buildSystemPrompt(prompt);
      const response = await aiChat({
        provider: requestContext.provider,
        messages: [{ role: 'user', content: prompt }],
        systemPrompt,
        maxTokens: 700,
      });

      if (requestId !== activeRequestId) {
        return;
      }

      const markdown = response.trim();
      if (!markdown) {
        throw new Error('The AI returned an empty response. Try a more specific prompt.');
      }

      const html = parseMarkdown(markdown).trim();
      if (!html) {
        throw new Error('The AI response could not be turned into editor content.');
      }

      insertHtmlIntoEditor(html);
    } catch (err) {
      if (requestId !== activeRequestId) {
        return;
      }

      errorText = errorMessage(err);
      updateAttributes({
        state: 'input',
      });
      requestAnimationFrame(() => inputEl?.focus());
    }
  }

  function restoreEmptyParagraph() {
    const { from, to } = getPromptPosition();

    editor
      .chain()
      .focus()
      .insertContentAt(
        { from, to },
        {
          type: 'paragraph',
        },
        { updateSelection: false },
      )
      .setTextSelection(from + 1)
      .run();
  }

  async function cancelPrompt() {
    activeRequestId += 1;

    if (promptState === 'loading') {
      try {
        await aiChatCancel();
      } catch {
        // ignore cancellation errors
      }
    }

    restoreEmptyParagraph();
  }

  function insertHtmlIntoEditor(html: string) {
    const { from, to } = getPromptPosition();

    editor
      .chain()
      .focus()
      .insertContentAt(
        { from, to },
        html,
        { updateSelection: true },
      )
      .scrollIntoView()
      .run();
  }

  function acceptGeneratedContent() {
    if (!generatedHtml) {
      return;
    }

    insertHtmlIntoEditor(generatedHtml);
  }

  function handleInputKeydown(event: KeyboardEvent) {
    if (event.key === 'Enter') {
      event.preventDefault();
      void submitPrompt();
      return;
    }

    if (event.key === 'Escape') {
      event.preventDefault();
      void cancelPrompt();
    }
  }


  onMount(() => {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    const setReducedMotion = () => {
      prefersReducedMotion = mediaQuery.matches;
    };

    setReducedMotion();
    mediaQuery.addEventListener('change', setReducedMotion);

    const handleDocumentPointerDown = (event: PointerEvent) => {
      if (promptState !== 'input') {
        return;
      }

      const target = event.target as globalThis.Node | null;
      if (rootEl && target && !rootEl.contains(target)) {
        void cancelPrompt();
      }
    };

    document.addEventListener('pointerdown', handleDocumentPointerDown, true);
    requestAnimationFrame(() => inputEl?.focus());

    return () => {
      document.removeEventListener('pointerdown', handleDocumentPointerDown, true);
      mediaQuery.removeEventListener('change', setReducedMotion);
    };
  });

  $effect(() => {
    if (promptState === 'input') {
      requestAnimationFrame(() => inputEl?.focus());
    }
  });
</script>

<div
  class="ai-prompt"
  bind:this={rootEl}
  contenteditable="false"
  role="group"
>
  {#if promptState === 'input'}
    <div class="ai-prompt__bar" in:fly={{ y: 3, duration: 150 }} out:fade={{ duration: 100 }}>
      <div class="ai-prompt__chip" aria-hidden="true">
        <Sparkles size={16} />
      </div>

      <input
        bind:this={inputEl}
        class="ai-prompt__input"
        placeholder="Draft a list, table, or next paragraph..."
        value={inputValue}
        oninput={(event) => {
          inputValue = event.currentTarget.value;
          if (errorText) {
            errorText = '';
          }
        }}
        onkeydown={handleInputKeydown}
      />

      <button
        class="ai-prompt__send"
        class:ai-prompt__send--ready={canSubmit}
        onclick={() => void submitPrompt()}
        disabled={!canSubmit}
        aria-label="Generate"
      >
        <ArrowUp size={14} strokeWidth={2.5} />
      </button>
    </div>

    {#if errorText}
      <p class="ai-prompt__error" in:fade={{ duration: 120 }} out:fade={{ duration: 80 }}>
        {errorText}
      </p>
    {/if}
  {:else if promptState === 'loading'}
    <div class="ai-prompt__bar ai-prompt__bar--loading" in:fade={{ duration: 120 }} out:fade={{ duration: 100 }}>
      <div class="ai-prompt__chip ai-prompt__chip--spin" aria-hidden="true">
        <LoaderCircle size={16} />
      </div>

      <p class="ai-prompt__loading-text">{loadingLabel}</p>

      <button
        class="ai-prompt__send"
        disabled
        aria-label="Generating"
      >
        <ArrowUp size={14} strokeWidth={2.5} />
      </button>
    </div>
  {/if}
</div>

<style lang="scss">
  .ai-prompt {
    position: relative;
    width: 100%;
    margin: 6px 0 10px;
  }

  /* ── Bar ── */

  .ai-prompt__bar {
    display: flex;
    align-items: center;
    gap: 10px;
    height: 50px;
    padding: 0 8px;
    border-radius: 12px;
    background: var(--surface-1, var(--color-card));
    border: none;
  }

  /* ── Icon chip ── */

  .ai-prompt__chip {
    flex-shrink: 0;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 34px;
    height: 34px;
    border-radius: 50%;
    background: color-mix(in srgb, var(--text-primary, var(--color-foreground)) 11%, transparent);
    color: var(--text-secondary, var(--color-foreground));
  }

  .ai-prompt__chip--spin {
    color: var(--text-muted, var(--color-placeholder));
  }

  .ai-prompt__chip--spin :global(svg) {
    animation: ai-prompt-spin 1s linear infinite;
  }

  /* ── Input ── */

  .ai-prompt__input,
  .ai-prompt__loading-text {
    flex: 1;
    min-width: 0;
    border: none !important;
    border-width: 0 !important;
    outline: none !important;
    box-shadow: none !important;
    -webkit-appearance: none;
    appearance: none;
    background: transparent;
    padding: 0;
    font-family: var(--font-content);
    font-size: 0.925rem;
    font-weight: 400;
    color: var(--text-primary, var(--color-foreground));
    caret-color: var(--text-secondary, var(--color-foreground));
  }

  .ai-prompt__input::placeholder {
    color: var(--text-muted, var(--color-placeholder));
  }

  .ai-prompt__loading-text {
    margin: 0;
    color: var(--text-muted, var(--color-placeholder));
  }

  /* ── Send button ── */

  .ai-prompt__send {
    flex-shrink: 0;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 30px;
    height: 30px;
    border-radius: 50%;
    border: none;
    cursor: pointer;
    background: color-mix(in srgb, var(--text-primary, var(--color-foreground)) 10%, transparent);
    color: var(--text-muted, var(--color-placeholder));
    transition:
      background 140ms ease,
      color 140ms ease;
  }

  .ai-prompt__send:disabled {
    cursor: default;
    opacity: 0.6;
  }

  .ai-prompt__send--ready {
    background: color-mix(in srgb, var(--text-primary, var(--color-foreground)) 16%, transparent);
    color: var(--text-secondary, var(--color-foreground));
    opacity: 1;
  }

  .ai-prompt__send--ready:hover {
    background: color-mix(in srgb, var(--text-primary, var(--color-foreground)) 22%, transparent);
  }

  /* ── Error ── */

  .ai-prompt__error {
    margin: 5px 0 0 14px;
    color: var(--accent-red, #f7768e);
    font-size: 12px;
    line-height: 1.4;
  }

  .ai-prompt :global(p:last-child) {
    margin-bottom: 0;
  }

  @keyframes ai-prompt-spin {
    to {
      transform: rotate(360deg);
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .ai-prompt__chip--spin :global(svg) {
      animation: none;
    }
  }
</style>
