<script lang="ts">
  /**
   * Soft Eye icon (Variant 3) — used as the AI brand mark across the app.
   * Replaces generic sparkle/star icons.
   */
  let {
    size = 16,
  }: {
    size?: number;
  } = $props();
</script>

<svg
  width={size}
  height={size}
  viewBox="0 0 24 24"
  fill="none"
  stroke="currentColor"
  stroke-width="1.5"
  stroke-linecap="round"
  stroke-linejoin="round"
  aria-hidden="true"
>
  <path d="M2 12c2.5-4.5 6-7 10-7s7.5 2.5 10 7" />
  <path d="M2 12c2.5 4.5 6 7 10 7s7.5-2.5 10-7" />
  <circle cx="12" cy="12" r="3" />
  <circle cx="12" cy="12" r="1" fill="currentColor" stroke="none" />
</svg>
