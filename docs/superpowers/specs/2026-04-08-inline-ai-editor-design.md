# Inline AI Editor — Design Spec

## Goal

Press Space on an empty line to open an inline AI prompt. Type a request, the AI generates markdown content that replaces the line. User approves or discards. No AI text leaks — the prompt bar and generated content are isolated until accepted.

## Trigger

- **Space** on a completely empty paragraph (no text, no whitespace)
- Only fires if an AI provider is configured in settings
- Only one `aiPrompt` node can exist at a time
- If no provider: Space types a space normally

The empty paragraph is replaced by a custom TipTap `aiPrompt` node. This node IS the document — not a floating overlay.

### Trigger Animation
- Empty paragraph fades out (150ms)
- Prompt bar fades in with slight translateY (200ms ease-out, from 4px below)
- Input auto-focuses

### Cancel
- Escape or clicking outside: prompt node fades out (200ms), original empty paragraph restored
- No content generated, no state change

## Prompt Bar (aiPrompt Node)

A custom TipTap Node that renders as an inline input bar:

- Full editor width
- Small sparkle icon on the left (muted, var(--color-placeholder))
- Placeholder text: "Ask the nocturnal mind..."
- Cursor inside the input, ready to type
- Enter sends the prompt
- Escape cancels
- The input is styled to match the editor's font and spacing — it should feel like part of the document, not a foreign widget

## Loading State

After Enter is pressed:

1. Input text fades out (200ms ease)
2. Node transforms to loading state:
   - Subtle pulse animation on the border (accent glow, breathing rhythm, ~3s cycle)
   - Height breathes ±2px
   - Loading phrases cycle with slow crossfade (400ms fade-in, 1.2s hold, 400ms fade-out):
     - "Conjuring..."
     - "The mind stirs..."
     - "Weaving thoughts..."
     - "From the depths..."
     - "Nocturnal vision..."
3. `prefers-reduced-motion`: static "Conjuring..." with no animation
4. AI generates in the background (single-shot, no streaming to UI)

## Reveal + Approval

When generation completes:

1. Loading node fades out (300ms ease-out, slight scale to 0.98)
2. Brief pause (150ms)
3. Generated content fades in from below (400ms ease-out, translateY 8→0, opacity 0→1)
4. Approval bar appears below content (200ms delay, slides up 4px)

### Approval Bar

Thin compact strip flush below the generated block:

- Left: small AI icon + "Noctodeus" in muted text
- Right: Accept (checkmark, accent color) + Discard (undo arrow, muted)
- The generated block has a 2px left border (accent color at 30%) to distinguish from user content
- Hover brightens the border slightly

### Accept (checkmark or Enter)
- Approval bar fades out (200ms)
- Left accent border fades out (300ms)
- Content becomes permanent normal editor content
- Cursor moves to end of inserted content
- The aiPrompt node is removed from the document, replaced by the generated nodes

### Discard (undo or Escape)
- Entire block (content + bar) fades out and collapses (300ms, height→0)
- Original empty paragraph restored
- Cursor returns to that line

### While Pending
- Generated content is read-only (not editable until accepted)
- Rest of the document remains editable

## AI Skillset (Inline-Specific)

The inline AI uses a different system prompt than the sidebar chat. It outputs raw markdown only.

```
You are the inline editor for Noctodeus. You generate content that will be inserted
directly into the user's note at their cursor position.

Rules:
- Output ONLY raw markdown. No greetings, no explanations, no "here you go".
- Never wrap output in a code fence unless the user explicitly asks for code.
- Match the tone and style of the surrounding note content when possible.
- For tables: use standard markdown table syntax.
- For lists: use - or 1. syntax.
- For code: use fenced code blocks with language identifier.
- For headings: match the heading level context (if inside an H2 section, start with H3).
- Keep output focused and concise. Don't over-generate.
```

### Context Sent With Each Prompt
- Current note content (~2000 chars around cursor position)
- The user's typed prompt
- RAG context from memvid (relevant note chunks based on the prompt)

### Separate Code Path
- Not a conversation — single-shot generation, no message history
- Uses `aiChat` bridge with a fresh message array each time
- Different system prompt from sidebar chat
- The response is parsed as markdown and converted to TipTap JSON for insertion

## Technical Architecture

### TipTap Extension: `ai-prompt`

A custom Node extension:

```
Node.create({
  name: 'aiPrompt',
  group: 'block',
  atom: true,        // non-editable as a whole
  selectable: true,
  draggable: false,

  addAttributes() {
    return {
      prompt: { default: '' },
      state: { default: 'input' },    // 'input' | 'loading' | 'preview'
      content: { default: '' },        // generated markdown
    }
  },

  addNodeView() {
    // Svelte component: AiPromptView
  },

  addKeyboardShortcuts() {
    return {
      'Space': ({ editor }) => {
        // Check if current line is empty paragraph
        // If yes, replace with aiPrompt node
        // Return true to consume the event
      }
    }
  }
})
```

### Node View Component: `AiPromptView.svelte`

A Svelte component rendered by TipTap's NodeView. Manages three states:

1. **input**: renders the prompt input bar
2. **loading**: renders the nocturnal loading animation
3. **preview**: renders the generated content + approval bar

### Content Insertion Flow

1. User types prompt, presses Enter
2. Component calls `aiChat` with inline system prompt + note context + user prompt
3. Wait for full response (no streaming to UI)
4. Parse response markdown → TipTap JSON via the existing `from-markdown` serializer
5. Store the TipTap JSON in the node's `content` attribute
6. Switch state to 'preview'
7. On Accept: delete the aiPrompt node, insert the stored TipTap JSON at that position
8. On Discard: delete the aiPrompt node, insert an empty paragraph

### Files

New:
- `src/lib/editor/extensions/ai-prompt.ts` — the TipTap Node extension
- `src/lib/editor/AiPromptView.svelte` — the node view component (input + loading + preview states)

Modified:
- `src/lib/editor/extensions/index.ts` — register the ai-prompt extension
- `src/lib/editor/Editor.svelte` — pass AI provider config to the extension

### Animation Timings Summary

| Transition | Duration | Easing | Delay |
|-----------|----------|--------|-------|
| Empty line → prompt bar | 200ms | ease-out | 0 |
| Input → loading | 200ms fade | ease | 0 |
| Loading pulse cycle | 3s | ease-in-out | infinite |
| Loading phrase crossfade | 400ms in, 1.2s hold, 400ms out | ease | 0 |
| Loading → content reveal | 300ms out + 150ms pause + 400ms in | ease-out | staggered |
| Approval bar appear | 200ms | ease-out | 200ms after content |
| Accept: bar fade | 200ms | ease | 0 |
| Accept: border fade | 300ms | ease | 0 |
| Discard: collapse | 300ms | ease-in | 0 |
| `prefers-reduced-motion` | all instant, no animation | — | — |
