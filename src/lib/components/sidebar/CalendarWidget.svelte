<script lang="ts">
  import ChevronLeft from '@lucide/svelte/icons/chevron-left';
  import ChevronRight from '@lucide/svelte/icons/chevron-right';

  let {
    existingDates = new Set<string>(),
    onselect,
  }: {
    existingDates: Set<string>;
    onselect: (dateStr: string) => void;
  } = $props();

  let viewDate = $state(new Date());

  const DAYS = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'];

  function todayStr(): string {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }

  function formatMonth(d: Date): string {
    return d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  }

  function prevMonth() {
    const d = new Date(viewDate);
    d.setMonth(d.getMonth() - 1);
    viewDate = d;
  }

  function nextMonth() {
    const d = new Date(viewDate);
    d.setMonth(d.getMonth() + 1);
    viewDate = d;
  }

  function goToday() {
    viewDate = new Date();
  }

  interface DayCell {
    day: number;
    dateStr: string;
    isCurrentMonth: boolean;
    isToday: boolean;
    hasNote: boolean;
  }

  let cells = $derived.by(() => {
    const year = viewDate.getFullYear();
    const month = viewDate.getMonth();
    const today = todayStr();

    const firstDay = new Date(year, month, 1);
    // Monday=0 ... Sunday=6
    let startOffset = firstDay.getDay() - 1;
    if (startOffset < 0) startOffset = 6;

    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const daysInPrevMonth = new Date(year, month, 0).getDate();

    const result: DayCell[] = [];

    // Previous month trailing days
    for (let i = startOffset - 1; i >= 0; i--) {
      const day = daysInPrevMonth - i;
      const prevMonth = month === 0 ? 12 : month;
      const prevYear = month === 0 ? year - 1 : year;
      const ds = `${prevYear}-${String(prevMonth).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      result.push({ day, dateStr: ds, isCurrentMonth: false, isToday: ds === today, hasNote: existingDates.has(ds) });
    }

    // Current month days
    for (let day = 1; day <= daysInMonth; day++) {
      const ds = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      result.push({ day, dateStr: ds, isCurrentMonth: true, isToday: ds === today, hasNote: existingDates.has(ds) });
    }

    // Next month leading days (fill to 42 cells = 6 rows)
    const remaining = 42 - result.length;
    for (let day = 1; day <= remaining; day++) {
      const nextM = month + 2;
      const nextY = nextM > 12 ? year + 1 : year;
      const nm = nextM > 12 ? 1 : nextM;
      const ds = `${nextY}-${String(nm).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      result.push({ day, dateStr: ds, isCurrentMonth: false, isToday: ds === today, hasNote: existingDates.has(ds) });
    }

    return result;
  });
</script>

<div class="cal">
  <div class="cal__header">
    <button class="cal__nav" onclick={prevMonth} title="Previous month">
      <ChevronLeft size={14} />
    </button>
    <span class="cal__month">{formatMonth(viewDate)}</span>
    <button class="cal__nav" onclick={nextMonth} title="Next month">
      <ChevronRight size={14} />
    </button>
    <button class="cal__today" onclick={goToday}>Today</button>
  </div>

  <div class="cal__days">
    {#each DAYS as day}
      <span class="cal__day-label">{day}</span>
    {/each}
  </div>

  <div class="cal__grid">
    {#each cells as cell (cell.dateStr)}
      <button
        class="cal__cell"
        class:cal__cell--other={!cell.isCurrentMonth}
        class:cal__cell--today={cell.isToday}
        class:cal__cell--has-note={cell.hasNote}
        onclick={() => onselect(cell.dateStr)}
        title={cell.dateStr}
      >
        {cell.day}
      </button>
    {/each}
  </div>
</div>

<style>
  .cal {
    padding: 8px 12px;
    border-bottom: 1px solid var(--color-border);
  }

  .cal__header {
    display: flex;
    align-items: center;
    gap: 4px;
    margin-bottom: 6px;
  }

  .cal__nav {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 22px;
    height: 22px;
    border: none;
    border-radius: 4px;
    background: transparent;
    color: var(--color-placeholder);
    cursor: pointer;
    transition: color 150ms var(--ease-expo-out), background 150ms var(--ease-expo-out);
  }

  .cal__nav:hover {
    color: var(--color-foreground);
    background: var(--color-hover);
  }

  .cal__month {
    flex: 1;
    font-family: var(--font-sans);
    font-size: 12px;
    font-weight: 500;
    color: var(--color-foreground);
    text-align: center;
  }

  .cal__today {
    padding: 2px 8px;
    font-family: var(--font-mono);
    font-size: 10px;
    color: var(--color-accent);
    background: transparent;
    border: 1px solid var(--color-accent);
    border-radius: 4px;
    cursor: pointer;
    transition: background 150ms var(--ease-expo-out);
  }

  .cal__today:hover {
    background: rgba(99, 102, 241, 0.1);
  }

  .cal__days {
    display: grid;
    grid-template-columns: repeat(7, 1fr);
    gap: 1px;
    margin-bottom: 2px;
  }

  .cal__day-label {
    font-family: var(--font-mono);
    font-size: 9px;
    color: var(--color-placeholder);
    text-align: center;
    padding: 2px 0;
    text-transform: uppercase;
    letter-spacing: 0.02em;
  }

  .cal__grid {
    display: grid;
    grid-template-columns: repeat(7, 1fr);
    gap: 1px;
  }

  .cal__cell {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 100%;
    aspect-ratio: 1;
    max-height: 28px;
    font-family: var(--font-mono);
    font-size: 11px;
    color: var(--color-foreground);
    background: transparent;
    border: none;
    border-radius: 6px;
    cursor: pointer;
    position: relative;
    transition: background 150ms var(--ease-expo-out), color 150ms var(--ease-expo-out);
  }

  .cal__cell:hover {
    background: var(--color-hover);
  }

  .cal__cell--other {
    color: var(--color-placeholder);
    opacity: 0.4;
  }

  .cal__cell--today {
    background: var(--color-accent);
    color: #fff;
    font-weight: 600;
  }

  .cal__cell--today:hover {
    background: var(--color-accent-hover);
  }

  .cal__cell--has-note::after {
    content: '';
    position: absolute;
    bottom: 2px;
    left: 50%;
    transform: translateX(-50%);
    width: 4px;
    height: 4px;
    border-radius: 50%;
    background: var(--color-accent);
  }

  .cal__cell--today.cal__cell--has-note::after {
    background: rgba(255, 255, 255, 0.7);
  }
</style>
