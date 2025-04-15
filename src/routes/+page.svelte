<script lang="ts">
	import { onMount } from 'svelte';
	import * as d3 from 'd3';
	import type { Feature, FeatureCollection, Geometry } from 'geojson';
	import { feature, mesh } from 'topojson-client';
	import type { PageData } from './$types';

	// Import data from load function using Svelte 5 runes
	let { data }: { data: PageData } = $props();

	// Ensure cancerData exists with a default empty array
	const cancerData = data.cancerData ?? [];

	// States for the filters
	let filterState = $state({
		year: 1992,
		cancerType: 'Brain and nervous system',
		location: 'All',
		region: 'County'
	});

	let title = $state('Cancer Prediction Rates by County');

	// SVG dimensions
	let width = 960;
	let height = 600;

	// Create a container for the map
	let mapContainer: HTMLDivElement;
	let tooltipElement: HTMLDivElement; // Add this line for the tooltip div

	// Store zoom behavior to reference in zoom buttons
	let zoom: d3.ZoomBehavior<SVGSVGElement, unknown>;
	let svg: d3.Selection<SVGSVGElement, unknown, null, undefined>;
	let mapGroup: d3.Selection<SVGGElement, unknown, null, undefined>;

	// Get unique years and cancer types from data for filters
	const uniqueYears = [...new Set(cancerData.map((d) => d.year))].sort();
	const uniqueCancerTypes = [...new Set(cancerData.map((d) => d.cancerType))].sort();

	// Pre-compute county paths and only redraw colors
	let counties: FeatureCollection;
	let nation: Feature<Geometry>;
	let stateBorders: Geometry;
	let path: d3.GeoPath<any, d3.GeoPermissibleObjects>;
	let countyPaths: d3.Selection<SVGPathElement, any, SVGGElement, unknown>;
	let colorScale: d3.ScaleQuantize<string>;
	let predictionExtent: [number, number];
	let legendGroup: d3.Selection<SVGGElement, unknown, null, undefined>;

	// Function to get filtered data and calculate the prediction map
	function getFilteredData() {
		// Filter data based on selected filters
		const filteredData = cancerData.filter((d) => {
			return d.year === filterState.year && d.cancerType === filterState.cancerType;
		});

		// Create map of cancer data by county ID for easy lookup
		const cancerDataByCounty = new Map<string, number>();
		filteredData.forEach((d) => {
			cancerDataByCounty.set(d.fips, d.prediction);
		});

		// Find the domain for the color scale from the actual data
		predictionExtent = d3.extent(filteredData, (d) => d.prediction) as [number, number];

		// Create color scale using quantized Reds scheme
		colorScale = d3.scaleQuantize<string>().domain(predictionExtent).range(d3.schemeYlOrRd[9]);

		return { filteredData, cancerDataByCounty };
	}

	// Helper function to format numbers with appropriate decimal places
	function formatPrediction(value: number): string {
		const absValue = Math.abs(value);
		return absValue >= 100 && absValue < 1000 ? value.toFixed(1) : value.toFixed(2);
	}

	// Function to update map colors without redrawing
	function updateMapColors() {
		if (!countyPaths) return;

		const { cancerDataByCounty } = getFilteredData();

		// Update only the colors of the counties
		countyPaths.attr('fill', (d: any) => {
			const prediction = cancerDataByCounty.get(d.id);
			return prediction !== undefined ? colorScale(prediction) : '#ccc';
		});

		// Update the tooltip data
		countyPaths.on('mouseover', function (event, d: any) {
			if (!tooltipElement) return;
			const prediction = cancerDataByCounty.get(d.id);
			const tooltipText =
				prediction !== undefined
					? `FIPS: ${d.id}\nRate: ${formatPrediction(prediction)}`
					: `FIPS: ${d.id}\nNo data`;

			tooltipElement.textContent = tooltipText;
			tooltipElement.classList.remove('hidden');
			d3.select(this).style('opacity', 0.7); // Highlight path
		});

		updateLegend();
	}

	// Update just the legend without redrawing the entire map
	function updateLegend() {
		if (!legendGroup) return;

		// Clear previous legend content
		legendGroup.selectAll('*').remove();

		const legendWidth = 300;
		const numColors = d3.schemeYlOrRd[9].length;
		const step = (predictionExtent[1] - predictionExtent[0]) / numColors;
		const thresholds = Array.from({ length: numColors }, (_, i) => predictionExtent[0] + i * step);

		// Add legend title
		legendGroup
			.append('text')
			.attr('class', 'legend-title')
			.attr('fill', 'currentColor')
			.attr('font-weight', 'medium')
			.attr('x', 0)
			.attr('y', 0)
			.text('Deaths per 100,000');

		// Add color rectangles, ticks, and labels for each threshold
		thresholds.forEach((tick, i) => {
			const xPosition = i * (legendWidth / numColors);
			const yPosition = 10;

			// --- Draw Color Rectangle ---
			legendGroup
				.append('rect')
				.attr('fill', colorScale(tick))
				.attr('x', xPosition)
				.attr('y', yPosition)
				.attr('height', 10)
				.attr('width', legendWidth / numColors);

			// --- Draw Tick Line ---
			legendGroup
				.append('line')
				.attr('stroke', 'currentColor')
				.attr('x1', xPosition)
				.attr('x2', xPosition)
				.attr('y1', yPosition)
				.attr('y2', yPosition + 20);

			// --- Draw Tick Label ---
			legendGroup
				.append('text')
				.attr('fill', 'currentColor')
				.attr('text-anchor', 'middle')
				.attr('dominant-baseline', 'middle')
				.attr('x', xPosition)
				.attr('y', yPosition + 35)
				.attr('font-size', '12px')
				.text(formatPrediction(tick));
		});

		// --- Add Final Tick and Label for Maximum Value ---
		const finalXPosition = legendWidth;
		const finalYPosition = 10;
		const maxValue = predictionExtent[1];

		// Add final tick line
		legendGroup
			.append('line')
			.attr('stroke', 'currentColor')
			.attr('x1', finalXPosition)
			.attr('x2', finalXPosition)
			.attr('y1', finalYPosition)
			.attr('y2', finalYPosition + 20);

		// Add final tick label
		legendGroup
			.append('text')
			.attr('fill', 'currentColor')
			.attr('text-anchor', 'middle')
			.attr('dominant-baseline', 'middle')
			.attr('x', finalXPosition)
			.attr('y', finalYPosition + 35)
			.attr('font-size', '12px')
			.text(formatPrediction(maxValue));
	}

	// Initialize the map - only runs once
	function initializeMap() {
		if (!mapContainer) return;

		// Clear any existing content
		d3.select(mapContainer).selectAll('*').remove();

		// Get container dimensions
		const containerRect = mapContainer.getBoundingClientRect();
		const containerWidth = containerRect.width;
		const containerHeight = containerRect.height;

		// Adjust dimensions based on container
		width = containerWidth || 960;
		height = containerHeight || 600;

		// Extract GeoJSON from TopoJSON - do this only once
		counties = feature(
			data.countyGeoData,
			data.countyGeoData.objects.counties
		) as unknown as FeatureCollection;

		nation = feature(
			data.countyGeoData,
			data.countyGeoData.objects.nation
		) as unknown as Feature<Geometry>;

		stateBorders = mesh(
			data.countyGeoData,
			data.countyGeoData.objects.states,
			(a, b) => a !== b
		) as unknown as Geometry;

		// Get filtered data and color scale
		const { cancerDataByCounty } = getFilteredData();

		// Create projection for the map
		const projection = d3
			.geoAlbersUsa()
			.fitSize([width - 80, height - 80], nation)
			.translate([width / 2, height / 2]);

		// Path generator
		path = d3.geoPath().projection(projection);

		// Create SVG
		svg = d3
			.select(mapContainer)
			.append('svg')
			.attr('width', '100%')
			.attr('height', '100%')
			.attr('viewBox', [0, 0, width, height])
			.attr('preserveAspectRatio', 'xMidYMid meet')
			.attr('class', 'max-w-full h-auto mx-auto');

		// Create a group for all map elements that will be zoomed
		mapGroup = svg.append('g');

		// Draw counties - store selection for later updates
		countyPaths = mapGroup
			.append('g')
			.attr('class', 'counties')
			.selectAll<SVGPathElement, any>('path')
			.data(counties.features)
			.join('path')
			.attr('fill', (d: any) => {
				const prediction = cancerDataByCounty.get(d.id);
				return prediction !== undefined ? colorScale(prediction) : '#ccc';
			})
			.attr('d', path)
			.attr('class', 'county-path')
			.on('mouseover', function (event, d: any) {
				if (!tooltipElement) return;
				const prediction = cancerDataByCounty.get(d.id);
				const tooltipText =
					prediction !== undefined
						? `FIPS: ${d.id}\nRate: ${formatPrediction(prediction)}`
						: `FIPS: ${d.id}\nNo data`;

				tooltipElement.textContent = tooltipText;
				tooltipElement.classList.remove('hidden');
				d3.select(this).style('opacity', 0.7);
			})
			.on('mousemove', function (event) {
				if (!tooltipElement) return;
				tooltipElement.style.left = `${event.pageX + 15}px`;
				tooltipElement.style.top = `${event.pageY + 10}px`;
			})
			.on('mouseout', function () {
				if (!tooltipElement) return;
				tooltipElement.classList.add('hidden');
				d3.select(this).style('opacity', 1);
			});

		// Draw state borders
		mapGroup
			.append('path')
			.datum(stateBorders)
			.attr('fill', 'none')
			.attr('stroke', 'white')
			.attr('stroke-width', '0.5')
			.attr('stroke-linejoin', 'round')
			.attr('class', 'state-borders')
			.attr('d', path);

		// Add zoom behavior
		zoom = d3
			.zoom<SVGSVGElement, unknown>()
			.scaleExtent([1, 8])
			.translateExtent([
				[-width / 2, -height / 2],
				[width * 1.5, height * 1.5]
			])
			.on('zoom', (event) => {
				mapGroup.attr('transform', event.transform);
			});

		// Initialize the zoom
		svg.call(zoom);

		// Create legend group - we'll update its contents when filters change
		legendGroup = svg
			.append('g')
			.attr('class', 'legend')
			.attr('transform', `translate(${(width - 300) / 2}, 20)`);

		// Initial legend creation
		updateLegend();
	}

	// Initialize the map when component mounts
	onMount(() => {
		initializeMap();
	});

	// Watch for filter changes and update only what's needed
	$effect(() => {
		// Re-render just the colors when filters change
		if (countyPaths) {
			updateMapColors();
		}
	});

	// Zoom functions remain the same
	function zoomIn() {
		if (svg && zoom) {
			svg.transition().duration(300).call(zoom.scaleBy, 1.5);
		}
	}

	function zoomOut() {
		if (svg && zoom) {
			svg.transition().duration(300).call(zoom.scaleBy, 0.75);
		}
	}

	function resetZoom() {
		if (svg && zoom) {
			svg.transition().duration(300).call(zoom.transform, d3.zoomIdentity);
		}
	}
</script>

<div class="container mx-auto px-4 py-8">
	<h1 class="mb-6 text-3xl">{title}</h1>

	<!-- Filter controls -->
	<div class="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
		<div>
			<label for="year-range" class="mb-1 block text-sm font-medium">Year</label>
			<div class="flex items-center">
				<select id="year-select" bind:value={filterState.year} class="w-full rounded border p-2">
					{#each uniqueYears as year}
						<option value={year}>{year}</option>
					{/each}
				</select>
			</div>
		</div>

		<div>
			<label for="cancer-type-select" class="mb-1 block text-sm font-medium">Cancer Type</label>
			<select
				id="cancer-type-select"
				bind:value={filterState.cancerType}
				class="w-full rounded border p-2"
			>
				{#each uniqueCancerTypes as cancerType}
					<option value={cancerType}>{cancerType[0].toUpperCase() + cancerType.slice(1)}</option>
				{/each}
			</select>
		</div>
	</div>

	<!-- Map container -->
	<div class="relative rounded border bg-gray-50 p-4">
		<div bind:this={mapContainer} class="h-[600px] w-full overflow-hidden"></div>

		<!-- Zoom controls -->
		<div class="absolute top-4 left-4 z-10 flex flex-col gap-2 rounded bg-white p-1 shadow">
			<button class="rounded border p-1 hover:bg-gray-100" aria-label="Zoom in" onclick={zoomIn}
				>+</button
			>
			<button class="rounded border p-1 hover:bg-gray-100" aria-label="Zoom out" onclick={zoomOut}
				>-</button
			>
			<button
				class="rounded border p-1 hover:bg-gray-100"
				aria-label="Reset view"
				onclick={resetZoom}>⟳</button
			>
		</div>
	</div>

	<!-- Tooltip Element -->
	<div
		bind:this={tooltipElement}
		class="tooltip bg-opacity-75 absolute z-20 hidden rounded bg-black px-2 py-1 text-sm whitespace-pre text-white shadow-md"
		style="pointer-events: none;"
	></div>
</div>

<style>
	:global(.county-path) {
		stroke: #fff; /* Optional: stroke for counties */
		stroke-width: 0.1; /* Thin stroke */
		transition: opacity 0.1s; /* Smooth hover effect */
	}

	:global(.county-path:hover) {
		opacity: 0.8; /* Slightly fade on hover */
	}

	:global(.state-borders) {
		pointer-events: none; /* Prevent borders from interfering with county hover */
	}
</style>
