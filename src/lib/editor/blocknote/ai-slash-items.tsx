import React from 'react';
import type { BlockNoteEditor } from '@blocknote/core';
import { FABRIC_PATTERNS, type FabricPattern } from '$lib/ai/fabric-patterns';
import { PatternIcon } from './pattern-icons';

/**
 * Pending pattern invocation — what the BlockNote wrapper needs to render
 * the PatternExecutor overlay after the user picks a slash menu item.
 */
export interface PendingPattern {
  pattern: FabricPattern;
  anchorBlockId: string;
  selectionText: string;
}

interface AiSlashItem {
  title: string;
  subtext: string;
  aliases: string[];
  group: string;
  icon: React.ReactElement;
  onItemClick: () => void;
}

/**
 * Build slash menu items for every Fabric pattern. Picking an item stores the
 * pending pattern on the wrapper so it can render `<PatternExecutor>`.
 */
export function createAiSlashItems(
  editor: BlockNoteEditor<any, any, any>,
  onInvoke: (pending: PendingPattern) => void,
): AiSlashItem[] {
  return FABRIC_PATTERNS.map((pattern) => ({
    title: pattern.name,
    subtext: pattern.description,
    aliases: buildAliases(pattern),
    group: 'AI',
    icon: (
      <span className="bn-ai-slash-icon" aria-hidden="true">
        <PatternIcon name={pattern.icon} size={18} />
      </span>
    ),
    onItemClick: () => {
      const cursor = editor.getTextCursorPosition();
      const anchorBlockId = cursor.block.id;
      const selectionText = editor.getSelectedText() ?? '';
      onInvoke({ pattern, anchorBlockId, selectionText });
    },
  }));
}

function buildAliases(pattern: FabricPattern): string[] {
  const base = [
    pattern.id,
    pattern.id.replace(/-/g, ' '),
    pattern.name.toLowerCase(),
    `ai ${pattern.id.replace(/-/g, ' ')}`,
  ];
  // Contextual aliases so users don't have to remember exact names
  const extras: Record<string, string[]> = {
    summarize: ['tldr', 'condense'],
    'improve-writing': ['rewrite', 'polish', 'edit'],
    'fix-typos': ['proofread', 'grammar', 'spelling'],
    'extract-wisdom': ['insights', 'key points'],
    'create-tags': ['tag', 'keywords'],
    'create-outline': ['structure', 'toc'],
    'create-flashcards': ['study', 'cards', 'quiz'],
    'explain-terms': ['glossary', 'definitions'],
    'find-actions': ['todo', 'tasks', 'action items'],
    translate: ['traducir', 'language'],
  };
  return [...base, ...(extras[pattern.id] ?? [])];
}
