<script lang="ts">
	/**
	 * @typedef {Object} Props
	 * @property {any} colorScale - receive color scale as prop.
	 * @property {number[]} domain - receive domain as prop.
	 * @property {string} title - receive title as prop.
	 */

	/** @type {Props} */
	let { colorScale, domain, title } = $props();

	// Determine thresholds based on the scale's range and number of colors
	const numColors = colorScale.range().length;
	const [minVal, maxVal] = domain;
	const step = (maxVal - minVal) / numColors;
	let thresholds = Array.from({ length: numColors }, (_, i) => minVal + i * step);

	// Use scale's actual thresholds if available and appropriate (scaleQuantize doesn't always expose them easily)
	// If scaleQuantize provided thresholds, use them, otherwise use calculated ones.
	// Note: D3's scaleQuantize thresholds are internal divisions, not the start of each range.
	// We might need a different scale (like scaleQuantile or scaleThreshold) for precise legend ticks
	// or calculate ticks based on the domain and range.
	// For simplicity, we'll calculate based on domain and number of colors.
</script>

<g class="legend">
	<!-- Add the title of the legend. -->
	<text class="legend-title" fill="currentColor" font-weight="bold" x="610" y="20">
		{title}
	</text>

	<!-- Loop through each of the thresholds. -->
	{#each thresholds as tick, i}
		{@const xPosition = 610 + i * 30}
		{@const yPosition = 30}

		<!-- Add a square for each threshold in its respective color. -->
		<rect fill={colorScale(tick)} x={xPosition} y={yPosition} height="10" width="30" />

		<!-- Skip the first threshold, but for the rest... -->
		{#if i !== 0}
			<!-- ...add a vertical tick line, -->
			<line
				stroke="currentColor"
				x1={xPosition}
				x2={xPosition}
				y1={yPosition}
				y2={yPosition + 20}
			/>

			<!-- ...and a tick label. -->
			<text
				fill="currentColor"
				text-anchor="middle"
				dominant-baseline="middle"
				x={xPosition}
				y={yPosition + 30}
			>
				{tick.toFixed(2)}
			</text>
		{/if}
	{/each}
</g>
