<script lang="ts">
  import { getFilesState } from '../../stores/files.svelte';
  import { readFile } from '../../bridge/commands';
  import { logger } from '../../logger';
  import X from '@lucide/svelte/icons/x';
  import Square from '@lucide/svelte/icons/square';
  import CheckSquare from '@lucide/svelte/icons/check-square';

  let {
    visible = false,
    onclose,
    onfileopen,
  }: {
    visible: boolean;
    onclose: () => void;
    onfileopen: (path: string) => void;
  } = $props();

  const files = getFilesState();

  type TaskItem = { text: string; checked: boolean; line: number };
  type FileGroup = { path: string; title: string; tasks: TaskItem[] };

  let groups = $state<FileGroup[]>([]);
  let filter = $state<'all' | 'todo' | 'done'>('all');
  let loading = $state(false);

  let filteredGroups = $derived(
    groups
      .map(g => ({
        ...g,
        tasks: g.tasks.filter(t =>
          filter === 'all' ? true : filter === 'todo' ? !t.checked : t.checked
        ),
      }))
      .filter(g => g.tasks.length > 0)
  );

  let totalCount = $derived(groups.reduce((n, g) => n + g.tasks.length, 0));
  let todoCount = $derived(groups.reduce((n, g) => n + g.tasks.filter(t => !t.checked).length, 0));
  let doneCount = $derived(groups.reduce((n, g) => n + g.tasks.filter(t => t.checked).length, 0));

  async function loadTasks() {
    loading = true;
    const result: FileGroup[] = [];
    const mdFiles = Array.from(files.fileMap.values()).filter(
      f => !f.is_directory && (f.extension === 'md' || f.extension === 'markdown')
    );

    for (const file of mdFiles) {
      try {
        const { content } = await readFile(file.path);
        const tasks: TaskItem[] = [];
        const lines = content.split('\n');
        for (let i = 0; i < lines.length; i++) {
          const checkedMatch = lines[i].match(/^[\s]*- \[x\]\s+(.*)/i);
          const uncheckedMatch = lines[i].match(/^[\s]*- \[ \]\s+(.*)/);
          if (checkedMatch) {
            tasks.push({ text: checkedMatch[1], checked: true, line: i });
          } else if (uncheckedMatch) {
            tasks.push({ text: uncheckedMatch[1], checked: false, line: i });
          }
        }
        if (tasks.length > 0) {
          result.push({ path: file.path, title: file.title || file.name, tasks });
        }
      } catch (err) {
        logger.warn(`Failed to read ${file.path} for tasks: ${err}`);
      }
    }

    groups = result.sort((a, b) => a.title.localeCompare(b.title));
    loading = false;
  }

  let wasVisible = false;
  $effect(() => {
    if (visible && !wasVisible) {
      filter = 'all';
      loadTasks();
    }
    wasVisible = visible;
  });

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape') { e.preventDefault(); onclose(); }
  }

  function handleBackdropClick(e: MouseEvent) {
    if (e.target === e.currentTarget) onclose();
  }
</script>

{#if visible}
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div class="tasks-backdrop" onclick={handleBackdropClick} onkeydown={handleKeydown}>
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div class="tasks-modal" onkeydown={handleKeydown}>
      <div class="tasks-modal__header">
        <h2 class="tasks-modal__title">Tasks</h2>
        <button class="tasks-modal__close" onclick={onclose}><X size={14} /></button>
      </div>

      <div class="tasks-modal__filters">
        <button
          class="tasks-modal__filter"
          class:tasks-modal__filter--active={filter === 'all'}
          onclick={() => filter = 'all'}
        >All <span class="tasks-modal__badge">{totalCount}</span></button>
        <button
          class="tasks-modal__filter"
          class:tasks-modal__filter--active={filter === 'todo'}
          onclick={() => filter = 'todo'}
        >Todo <span class="tasks-modal__badge">{todoCount}</span></button>
        <button
          class="tasks-modal__filter"
          class:tasks-modal__filter--active={filter === 'done'}
          onclick={() => filter = 'done'}
        >Done <span class="tasks-modal__badge">{doneCount}</span></button>
      </div>

      <div class="tasks-modal__body">
        {#if loading}
          <div class="tasks-modal__loading">Scanning files...</div>
        {:else if filteredGroups.length === 0}
          <div class="tasks-modal__empty">No tasks found</div>
        {:else}
          {#each filteredGroups as group (group.path)}
            <div class="tasks-modal__group">
              <button class="tasks-modal__group-header" onclick={() => { onfileopen(group.path); }}>
                {group.title}
              </button>
              {#each group.tasks as task (task.line)}
                <div class="tasks-modal__task" class:tasks-modal__task--done={task.checked}>
                  {#if task.checked}
                    <CheckSquare size={14} />
                  {:else}
                    <Square size={14} />
                  {/if}
                  <span class="tasks-modal__task-text">{task.text}</span>
                </div>
              {/each}
            </div>
          {/each}
        {/if}
      </div>
    </div>
  </div>
{/if}

<style>
  .tasks-backdrop {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.5);
    backdrop-filter: blur(8px);
    z-index: 500;
    display: flex;
    align-items: center;
    justify-content: center;
    animation: tasks-backdrop-in 300ms var(--ease-expo-out) both;
  }

  @keyframes tasks-backdrop-in {
    from { opacity: 0; }
    to { opacity: 1; }
  }

  .tasks-modal {
    display: flex;
    flex-direction: column;
    width: min(640px, 90vw);
    max-height: min(520px, 80vh);
    background: var(--color-popover);
    border: 1px solid var(--color-border);
    border-radius: 12px;
    box-shadow: var(--shadow-float);
    overflow: hidden;
    animation: tasks-modal-in 450ms var(--ease-expo-out) both;
  }

  @keyframes tasks-modal-in {
    from { opacity: 0; transform: scale(0.95) translateY(8px); }
    to { opacity: 1; transform: scale(1) translateY(0); }
  }

  .tasks-modal__header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 16px 20px 0;
  }

  .tasks-modal__title {
    font-family: var(--font-sans);
    font-size: 16px;
    font-weight: 600;
    color: var(--color-foreground);
  }

  .tasks-modal__close {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 28px;
    border: none;
    border-radius: 6px;
    background: transparent;
    color: var(--color-placeholder);
    cursor: pointer;
    transition: color 150ms var(--ease-expo-out), background 150ms var(--ease-expo-out);
  }

  .tasks-modal__close:hover {
    color: var(--color-foreground);
    background: var(--color-hover);
  }

  .tasks-modal__filters {
    display: flex;
    gap: 6px;
    padding: 12px 20px;
  }

  .tasks-modal__filter {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 5px 12px;
    font-family: var(--font-mono);
    font-size: 12px;
    color: var(--color-muted-foreground);
    background: transparent;
    border: 1px solid var(--color-border);
    border-radius: 6px;
    cursor: pointer;
    transition: all 150ms var(--ease-expo-out);
  }

  .tasks-modal__filter:hover {
    border-color: var(--color-muted-foreground);
    color: var(--color-foreground);
  }

  .tasks-modal__filter--active {
    background: rgba(99, 102, 241, 0.12);
    border-color: var(--color-accent);
    color: var(--color-accent);
  }

  .tasks-modal__badge {
    font-size: 10px;
    opacity: 0.6;
  }

  .tasks-modal__body {
    flex: 1;
    overflow-y: auto;
    padding: 0 20px 16px;
    scrollbar-width: thin;
  }

  .tasks-modal__loading,
  .tasks-modal__empty {
    padding: 24px 0;
    text-align: center;
    font-family: var(--font-mono);
    font-size: 12px;
    color: var(--color-placeholder);
  }

  .tasks-modal__group {
    margin-bottom: 16px;
  }

  .tasks-modal__group-header {
    display: block;
    width: 100%;
    padding: 4px 0;
    font-family: var(--font-mono);
    font-size: 10px;
    color: var(--color-placeholder);
    text-transform: uppercase;
    letter-spacing: 0.04em;
    border: none;
    background: transparent;
    text-align: left;
    cursor: pointer;
    transition: color 150ms var(--ease-expo-out);
  }

  .tasks-modal__group-header:hover {
    color: var(--color-accent);
  }

  .tasks-modal__task {
    display: flex;
    align-items: flex-start;
    gap: 8px;
    padding: 5px 8px;
    border-radius: 4px;
    color: var(--color-foreground);
    transition: background 150ms var(--ease-expo-out);
  }

  .tasks-modal__task:hover {
    background: var(--color-hover);
  }

  .tasks-modal__task--done {
    color: var(--color-placeholder);
  }

  .tasks-modal__task--done .tasks-modal__task-text {
    text-decoration: line-through;
  }

  .tasks-modal__task-text {
    font-family: var(--font-mono);
    font-size: 13px;
    line-height: 1.4;
  }

  @media (prefers-reduced-motion: reduce) {
    .tasks-backdrop, .tasks-modal { animation: none; }
  }
</style>
