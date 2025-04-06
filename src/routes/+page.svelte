<script lang="ts">
	import { onMount } from 'svelte';
	import * as d3 from 'd3';
	import type { Feature, FeatureCollection, Geometry } from 'geojson';
	import { feature, mesh } from 'topojson-client';
	import type { PageProps } from './$types';

	// Define the CancerData type to match your JSON structure
	type CancerData = {
		year: number;
		state_fips_code: number;
		county_fips_code: number;
		cancer_type: string;
		prediction: number;
	};

	// Import data from load function using Svelte 5 runes
	let { data }: PageProps = $props();

	// Ensure cancerData exists with a default empty array
	const cancerData = data.cancerData ?? [];

	// States for the filters
	let filterState = $state({
		year: 1992, // Updated to match your data's starting year
		cancer_type: 'Brain and nervous system cancer', // Updated to match your data
		location: 'All',
		region: 'County'
	});

	// Title derived from state
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

	// Watch for filter changes and update map
	$effect(() => {
		if (mapContainer) {
			renderMap();
		}
	});

	onMount(() => {
		renderMap();
	});

	// Get unique years and cancer types from data for filters
	const uniqueYears = [...new Set(cancerData.map((d: CancerData) => d.year))].sort();
	const uniqueCancerTypes = [...new Set(cancerData.map((d: CancerData) => d.cancer_type))].sort();

	function renderMap() {
		// Clear previous map if it exists
		if (mapContainer) {
			d3.select(mapContainer).selectAll('*').remove();
		}

		// Get container dimensions
		const containerRect = mapContainer.getBoundingClientRect();
		const containerWidth = containerRect.width;
		const containerHeight = containerRect.height;

		// Adjust dimensions based on container
		width = containerWidth || 960;
		height = containerHeight || 600;

		// Extract GeoJSON from TopoJSON
		const counties = feature(
			data.countyGeoData,
			data.countyGeoData.objects.counties
		) as unknown as FeatureCollection;

		const nation = feature(
			data.countyGeoData,
			data.countyGeoData.objects.nation
		) as unknown as Feature<Geometry>;

		const stateBorders = mesh(
			data.countyGeoData,
			data.countyGeoData.objects.states,
			(a, b) => a !== b
		) as unknown as Geometry;

		// Filter data based on selected filters
		const filteredData = cancerData.filter((d: CancerData) => {
			return d.year === filterState.year && d.cancer_type === filterState.cancer_type;
		});

		// Create map of cancer data by county ID for easy lookup
		const cancerDataByCounty = new Map<string, number>();
		filteredData.forEach((d: CancerData) => {
			const fips = `${d.state_fips_code.toString().padStart(2, '0')}${d.county_fips_code.toString().padStart(3, '0')}`;
			cancerDataByCounty.set(fips, d.prediction);
		});

		// Find the domain for the color scale from the actual data
		const predictionExtent = d3.extent(filteredData, (d) => d.prediction) as [number, number];

		// Create color scale using quantized Reds scheme, specifying string output type
		const colorScale = d3
			.scaleQuantize<string>() // Specify <string> output type
			.domain(predictionExtent)
			.range(d3.schemeYlOrRd[9]); // Using 9 color steps

		// Create projection for the map with padding
		const projection = d3
			.geoAlbersUsa()
			.fitSize([width - 80, height - 80], nation)
			.translate([width / 2, height / 2]);

		// Ensure the path generator uses the projection
		const path = d3.geoPath().projection(projection);

		// Create SVG
		svg = d3
			.select(mapContainer)
			.append('svg')
			.attr('width', '100%')
			.attr('height', '100%')
			.attr('viewBox', [0, 0, width, height])
			.attr('preserveAspectRatio', 'xMidYMid meet')
			.attr('class', 'max-w-full h-auto mx-auto'); // Added mx-auto for centering if needed

		// Create a group for all map elements that will be zoomed
		mapGroup = svg.append('g');

		// Draw counties with improved styling and interactivity + tooltips
		mapGroup
			.append('g')
			.attr('class', 'counties') // Group counties
			.selectAll('path')
			.data(counties.features)
			.join('path')
			.attr('fill', (d: any) => {
				const prediction = cancerDataByCounty.get(d.id);
				return prediction !== undefined ? colorScale(prediction) : '#ccc';
			})
			.attr('d', path) // Use the path generator with projection
			.attr('class', 'county-path') // Add class for styling/hover
			.on('mouseover', function (event, d: any) {
				if (!tooltipElement) return;
				const prediction = cancerDataByCounty.get(d.id);
				const tooltipText =
					prediction !== undefined
						? `FIPS: ${d.id}\nRate: ${prediction.toFixed(2)}`
						: `FIPS: ${d.id}\nNo data`;

				tooltipElement.textContent = tooltipText;
				tooltipElement.classList.remove('hidden');
				d3.select(this).style('opacity', 0.7); // Highlight path
			})
			.on('mousemove', function (event) {
				if (!tooltipElement) return;
				// Position tooltip near cursor
				tooltipElement.style.left = `${event.pageX + 15}px`;
				tooltipElement.style.top = `${event.pageY + 10}px`;
			})
			.on('mouseout', function () {
				if (!tooltipElement) return;
				tooltipElement.classList.add('hidden');
				d3.select(this).style('opacity', 1); // Remove highlight
			});

		// Draw state borders with improved styling
		mapGroup
			.append('path')
			.datum(stateBorders)
			.attr('fill', 'none')
			.attr('stroke', 'white') // Use white for contrast on darker reds
			.attr('stroke-width', '0.5')
			.attr('stroke-linejoin', 'round')
			.attr('class', 'state-borders') // Add class for styling
			.attr('d', path); // Use the path generator with projection

		// Add zoom behavior (remains the same)
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

		// Initialize the zoom (remains the same)
		svg.call(zoom);

		// Create legend
		const legendWidth = 300;
		const numColors = d3.schemeYlOrRd[9].length; // Use the actual length of the color scheme array
		const step = (predictionExtent[1] - predictionExtent[0]) / numColors;
		// Thresholds represent the START value for each color block
		const thresholds = Array.from({ length: numColors }, (_, i) => predictionExtent[0] + i * step);

		// Create legend group
		const legend = svg
			.append('g')
			.attr('class', 'legend')
			.attr('transform', `translate(${(width - legendWidth) / 2}, 20)`);

		// Add legend title
		legend
			.append('text')
			.attr('class', 'legend-title')
			.attr('fill', 'currentColor')
			.attr('font-weight', 'medium') // Keep updated font weight
			.attr('x', 0)
			.attr('y', 0)
			.text('Cancer Prediction Rate');

		// Add color rectangles, ticks, and labels for each threshold
		thresholds.forEach((tick, i) => {
			const xPosition = i * (legendWidth / numColors);
			const yPosition = 10; // Y position for the color rects

			// --- Draw Color Rectangle ---
			legend
				.append('rect')
				.attr('fill', colorScale(tick)) // Color corresponds to the range starting at 'tick'
				.attr('x', xPosition)
				.attr('y', yPosition)
				.attr('height', 10)
				.attr('width', legendWidth / numColors);

			// --- Draw Tick Line ---
			// Draw tick line for all thresholds, including the first one
			legend
				.append('line')
				.attr('stroke', 'currentColor')
				.attr('x1', xPosition)
				.attr('x2', xPosition)
				.attr('y1', yPosition) // Start line at the bottom of the rect
				.attr('y2', yPosition + 20); // Extend line downwards

			// --- Draw Tick Label ---
			// Draw label for all thresholds, including the first one
			legend
				.append('text')
				.attr('fill', 'currentColor')
				.attr('text-anchor', 'middle')
				.attr('dominant-baseline', 'middle')
				.attr('x', xPosition)
				.attr('y', yPosition + 35) // Use updated Y position for labels
				.attr('font-size', '12px') // Keep updated font size
				.text(tick.toFixed(2));
		});

		// --- Add Final Tick and Label for Maximum Value ---
		const finalXPosition = legendWidth; // Position at the very end of the legend bar
		const finalYPosition = 10;
		const maxValue = predictionExtent[1];

		// Add final tick line
		legend
			.append('line')
			.attr('stroke', 'currentColor')
			.attr('x1', finalXPosition)
			.attr('x2', finalXPosition)
			.attr('y1', finalYPosition)
			.attr('y2', finalYPosition + 20);

		// Add final tick label
		legend
			.append('text')
			.attr('fill', 'currentColor')
			.attr('text-anchor', 'middle')
			.attr('dominant-baseline', 'middle')
			.attr('x', finalXPosition)
			.attr('y', finalYPosition + 35) // Use updated Y position
			.attr('font-size', '12px') // Keep updated font size
			.text(maxValue.toFixed(2));
	}

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
				bind:value={filterState.cancer_type}
				class="w-full rounded border p-2"
			>
				{#each uniqueCancerTypes as cancerType}
					<option value={cancerType}>{cancerType}</option>
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
		/* stroke: #333; /* Optional: darker stroke on hover */
		/* stroke-width: 0.3; */
	}

	:global(.state-borders) {
		pointer-events: none; /* Prevent borders from interfering with county hover */
	}
</style>
