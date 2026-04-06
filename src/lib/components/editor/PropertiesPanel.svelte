<script lang="ts">
  import ChevronRight from '@lucide/svelte/icons/chevron-right';
  import ChevronDown from '@lucide/svelte/icons/chevron-down';
  import Plus from '@lucide/svelte/icons/plus';
  import X from '@lucide/svelte/icons/x';

  let {
    content = '',
    onupdate,
  }: {
    content: string;
    onupdate: (newFrontmatter: string) => void;
  } = $props();

  type PropType = 'text' | 'number' | 'boolean' | 'tags' | 'date';
  type Property = { key: string; value: any; type: PropType };

  let expanded = $state(false);
  let properties = $state<Property[]>([]);
  let addingKey = $state(false);
  let newKeyValue = $state('');

  const FM_RE = /^---\r?\n([\s\S]*?)\r?\n---/;

  function detectType(value: any): PropType {
    if (typeof value === 'boolean') return 'boolean';
    if (typeof value === 'number') return 'number';
    if (Array.isArray(value)) return 'tags';
    if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) return 'date';
    return 'text';
  }

  function parseValue(raw: string): any {
    const trimmed = raw.trim();
    if (trimmed === 'true') return true;
    if (trimmed === 'false') return false;
    if (/^\d+$/.test(trimmed)) return parseInt(trimmed);
    if (/^\d+\.\d+$/.test(trimmed)) return parseFloat(trimmed);
    if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
      return trimmed.slice(1, -1).split(',').map(s => s.trim().replace(/^["']|["']$/g, '')).filter(Boolean);
    }
    return trimmed.replace(/^["']|["']$/g, '');
  }

  function parseFrontmatter(md: string): Property[] {
    const match = md.match(FM_RE);
    if (!match) return [];
    const yaml = match[1];
    const result: Property[] = [];
    for (const line of yaml.split('\n')) {
      const colonIdx = line.indexOf(':');
      if (colonIdx === -1) continue;
      const key = line.slice(0, colonIdx).trim();
      const rawVal = line.slice(colonIdx + 1).trim();
      if (!key) continue;
      const value = parseValue(rawVal);
      result.push({ key, value, type: detectType(value) });
    }
    return result;
  }

  function serializeFrontmatter(props: Property[]): string {
    if (props.length === 0) return '';
    const lines = props.map(p => {
      if (p.type === 'boolean') return `${p.key}: ${p.value}`;
      if (p.type === 'number') return `${p.key}: ${p.value}`;
      if (p.type === 'tags') {
        const arr = Array.isArray(p.value) ? p.value : [];
        return `${p.key}: [${arr.join(', ')}]`;
      }
      const val = String(p.value);
      if (val.includes(':') || val.includes('#') || val.startsWith('"')) {
        return `${p.key}: "${val.replace(/"/g, '\\"')}"`;
      }
      return `${p.key}: ${val}`;
    });
    return '---\n' + lines.join('\n') + '\n---\n';
  }

  // Parse when content changes
  let lastContent = '';
  $effect(() => {
    if (content !== lastContent) {
      lastContent = content;
      properties = parseFrontmatter(content);
    }
  });

  function emitUpdate() {
    onupdate(serializeFrontmatter(properties));
  }

  function updateProperty(index: number, newValue: any) {
    properties[index] = { ...properties[index], value: newValue };
    properties = [...properties];
    emitUpdate();
  }

  function removeProperty(index: number) {
    properties = properties.filter((_, i) => i !== index);
    emitUpdate();
  }

  function addProperty() {
    const key = newKeyValue.trim();
    if (!key || properties.some(p => p.key === key)) return;
    properties = [...properties, { key, value: '', type: 'text' }];
    newKeyValue = '';
    addingKey = false;
    emitUpdate();
  }

  function addTag(index: number, tag: string) {
    const p = properties[index];
    const arr = Array.isArray(p.value) ? [...p.value] : [];
    if (!arr.includes(tag)) arr.push(tag);
    updateProperty(index, arr);
  }

  function removeTag(index: number, tag: string) {
    const p = properties[index];
    const arr = Array.isArray(p.value) ? p.value.filter((t: string) => t !== tag) : [];
    updateProperty(index, arr);
  }

  let tagInputs: Record<number, string> = {};

  function handleTagKeydown(e: KeyboardEvent, index: number) {
    if (e.key === 'Enter') {
      e.preventDefault();
      const val = (tagInputs[index] ?? '').trim();
      if (val) { addTag(index, val); tagInputs[index] = ''; }
    }
  }
</script>

{#if properties.length > 0 || expanded}
  <div class="props" class:props--expanded={expanded}>
    <button class="props__toggle" onclick={() => expanded = !expanded}>
      {#if expanded}
        <ChevronDown size={12} />
      {:else}
        <ChevronRight size={12} />
      {/if}
      <span>Properties{properties.length > 0 ? ` (${properties.length})` : ''}</span>
    </button>

    {#if expanded}
      <div class="props__body">
        {#each properties as prop, i (prop.key)}
          <div class="props__row">
            <span class="props__key">{prop.key}</span>
            <div class="props__value">
              {#if prop.type === 'boolean'}
                <label class="props__checkbox">
                  <input type="checkbox" checked={prop.value} onchange={(e) => updateProperty(i, e.currentTarget.checked)} />
                  <span>{prop.value ? 'true' : 'false'}</span>
                </label>
              {:else if prop.type === 'number'}
                <input
                  class="props__input"
                  type="number"
                  value={prop.value}
                  onchange={(e) => updateProperty(i, Number(e.currentTarget.value))}
                />
              {:else if prop.type === 'tags'}
                <div class="props__tags">
                  {#each (Array.isArray(prop.value) ? prop.value : []) as tag}
                    <span class="props__tag">
                      {tag}
                      <button class="props__tag-remove" onclick={() => removeTag(i, tag)}>
                        <X size={10} />
                      </button>
                    </span>
                  {/each}
                  <input
                    class="props__tag-input"
                    type="text"
                    placeholder="add..."
                    bind:value={tagInputs[i]}
                    onkeydown={(e) => handleTagKeydown(e, i)}
                  />
                </div>
              {:else}
                <input
                  class="props__input"
                  type="text"
                  value={prop.value}
                  onchange={(e) => updateProperty(i, e.currentTarget.value)}
                />
              {/if}
            </div>
            <button class="props__remove" onclick={() => removeProperty(i)} title="Remove">
              <X size={10} />
            </button>
          </div>
        {/each}

        {#if addingKey}
          <div class="props__row">
            <input
              class="props__new-key"
              type="text"
              placeholder="property name"
              bind:value={newKeyValue}
              onkeydown={(e) => { if (e.key === 'Enter') addProperty(); if (e.key === 'Escape') addingKey = false; }}
              autofocus
            />
          </div>
        {:else}
          <button class="props__add" onclick={() => { addingKey = true; }}>
            <Plus size={11} /> Add property
          </button>
        {/if}
      </div>
    {/if}
  </div>
{/if}

<style>
  .props {
    padding: 0 28px;
    max-width: 780px;
    margin: 0 auto;
    width: 100%;
  }

  .props--expanded {
    border-bottom: 1px solid var(--color-border);
    padding-bottom: 12px;
    margin-bottom: 4px;
  }

  .props__toggle {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 6px 0;
    border: none;
    background: transparent;
    color: var(--color-placeholder);
    font-family: var(--font-mono);
    font-size: 11px;
    cursor: pointer;
    transition: color 150ms var(--ease-expo-out);
  }

  .props__toggle:hover {
    color: var(--color-muted-foreground);
  }

  .props__body {
    display: flex;
    flex-direction: column;
    gap: 4px;
    animation: props-in 250ms var(--ease-expo-out) both;
  }

  @keyframes props-in {
    from { opacity: 0; transform: translateY(-4px); }
    to { opacity: 1; transform: translateY(0); }
  }

  .props__row {
    display: flex;
    align-items: center;
    gap: 8px;
    min-height: 28px;
  }

  .props__key {
    font-family: var(--font-mono);
    font-size: 12px;
    color: var(--color-muted-foreground);
    min-width: 80px;
    text-align: right;
    flex-shrink: 0;
  }

  .props__value {
    flex: 1;
    min-width: 0;
  }

  .props__input {
    width: 100%;
    padding: 3px 6px;
    font-family: var(--font-mono);
    font-size: 12px;
    color: var(--color-foreground);
    background: transparent;
    border: 1px solid transparent;
    border-radius: 4px;
    outline: none;
    transition: border-color 150ms var(--ease-expo-out);
  }

  .props__input:focus {
    border-color: var(--color-accent);
  }

  .props__checkbox {
    display: flex;
    align-items: center;
    gap: 6px;
    font-family: var(--font-mono);
    font-size: 12px;
    color: var(--color-muted-foreground);
    cursor: pointer;
  }

  .props__tags {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
    align-items: center;
  }

  .props__tag {
    display: inline-flex;
    align-items: center;
    gap: 3px;
    padding: 2px 8px;
    font-family: var(--font-mono);
    font-size: 11px;
    color: var(--color-accent);
    background: rgba(122, 162, 247, 0.1);
    border-radius: 4px;
  }

  .props__tag-remove {
    display: flex;
    align-items: center;
    border: none;
    background: transparent;
    color: var(--color-accent);
    cursor: pointer;
    opacity: 0.5;
    padding: 0;
  }

  .props__tag-remove:hover {
    opacity: 1;
  }

  .props__tag-input {
    width: 60px;
    padding: 2px 4px;
    font-family: var(--font-mono);
    font-size: 11px;
    color: var(--color-foreground);
    background: transparent;
    border: none;
    outline: none;
  }

  .props__tag-input::placeholder {
    color: var(--color-placeholder);
  }

  .props__remove {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 18px;
    height: 18px;
    border: none;
    border-radius: 3px;
    background: transparent;
    color: var(--color-placeholder);
    cursor: pointer;
    opacity: 0;
    transition: opacity 150ms var(--ease-expo-out), color 150ms var(--ease-expo-out);
  }

  .props__row:hover .props__remove {
    opacity: 0.5;
  }

  .props__remove:hover {
    opacity: 1 !important;
    color: var(--color-destructive);
  }

  .props__add {
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 4px 0;
    border: none;
    background: transparent;
    color: var(--color-placeholder);
    font-family: var(--font-mono);
    font-size: 11px;
    cursor: pointer;
    transition: color 150ms var(--ease-expo-out);
  }

  .props__add:hover {
    color: var(--color-muted-foreground);
  }

  .props__new-key {
    flex: 1;
    padding: 3px 6px;
    font-family: var(--font-mono);
    font-size: 12px;
    color: var(--color-foreground);
    background: transparent;
    border: 1px solid var(--color-accent);
    border-radius: 4px;
    outline: none;
  }

  @media (prefers-reduced-motion: reduce) {
    .props__body { animation: none; }
  }
</style>
