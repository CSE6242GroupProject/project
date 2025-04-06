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
	let title = $state(`Cancer Prediction Rates by County (${filterState.year})`);

	// Update title when year changes
	$effect(() => {
		title = `Cancer Prediction Rates by County (${filterState.year})`;
	});

	// SVG dimensions
	let width = 960;
	let height = 600;

	// Create a container for the map
	let mapContainer: HTMLDivElement;

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

	// Year control handlers
	function decrementYear() {
		const currentIndex = uniqueYears.indexOf(filterState.year);
		if (currentIndex > 0) {
			filterState.year = uniqueYears[currentIndex - 1];
		}
	}

	function incrementYear() {
		const currentIndex = uniqueYears.indexOf(filterState.year);
		if (currentIndex < uniqueYears.length - 1) {
			filterState.year = uniqueYears[currentIndex + 1];
		}
	}

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

		// Create color scale - using RdYlBu but reversed for cancer rates
		const colorScale = d3
			.scaleSequential(d3.interpolateRdYlBu)
			.domain([predictionExtent[1], predictionExtent[0]]); // Higher values (more cancer) are red

		// Create projection for the map with padding
		const projection = d3
			.geoAlbersUsa()
			.fitSize([width - 80, height - 80], nation)
			.translate([width / 2, height / 2]);

		const path = d3.geoPath().projection(projection);

		// Create SVG
		svg = d3
			.select(mapContainer)
			.append('svg')
			.attr('width', '100%')
			.attr('height', '100%')
			.attr('viewBox', [0, 0, width, height])
			.attr('preserveAspectRatio', 'xMidYMid meet')
			.attr('class', 'max-w-full h-auto');

		// Create a group for all map elements that will be zoomed
		mapGroup = svg.append('g');

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

		// Draw counties
		const countyPaths = mapGroup
			.append('g')
			.selectAll('path')
			.data(counties.features)
			.join('path')
			.attr('fill', (d: any) => {
				const prediction = cancerDataByCounty.get(d.id);
				return prediction ? colorScale(prediction) : '#ccc';
			})
			.attr('d', path as any)
			.attr('stroke', '#fff')
			.attr('stroke-width', 0.1);

		// Draw state borders
		mapGroup
			.append('path')
			.datum(stateBorders)
			.attr('fill', 'none')
			.attr('stroke', '#000')
			.attr('stroke-width', 0.5)
			.attr('d', path);

		// Create legend
		const legendWidth = 300;
		const legendHeight = 40;
		const numColors = 10; // Number of color steps
		const step = (predictionExtent[1] - predictionExtent[0]) / numColors;
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
			.attr('font-weight', 'bold')
			.attr('x', 0)
			.attr('y', 0)
			.text('Cancer Prediction Rate');

		// Add color rectangles and labels
		thresholds.forEach((tick, i) => {
			const xPosition = i * (legendWidth / numColors);
			const yPosition = 10;

			// Add color rectangle
			legend
				.append('rect')
				.attr('fill', colorScale(tick))
				.attr('x', xPosition)
				.attr('y', yPosition)
				.attr('height', 10)
				.attr('width', legendWidth / numColors);

			// Add tick line and label (skip first threshold)
			if (i !== 0) {
				// Add tick line
				legend
					.append('line')
					.attr('stroke', 'currentColor')
					.attr('x1', xPosition)
					.attr('x2', xPosition)
					.attr('y1', yPosition)
					.attr('y2', yPosition + 20);

				// Add tick label
				legend
					.append('text')
					.attr('fill', 'currentColor')
					.attr('text-anchor', 'middle')
					.attr('dominant-baseline', 'middle')
					.attr('x', xPosition)
					.attr('y', yPosition + 30)
					.text(tick.toFixed(2));
			}
		});
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
	<h1 class="mb-6 text-3xl font-bold">{title}</h1>

	<!-- Filter controls -->
	<div class="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3">
		<div>
			<label for="year-range" class="mb-1 block text-sm font-medium">Year</label>
			<div class="flex items-center">
				<button class="rounded-l border p-1" onclick={decrementYear}>◀</button>
				<select id="year-select" bind:value={filterState.year} class="w-full rounded border p-2">
					{#each uniqueYears as year}
						<option value={year}>{year}</option>
					{/each}
				</select>
				<button class="rounded-r border p-1" onclick={incrementYear}>▶</button>
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

		<div>
			<label for="region-select" class="mb-1 block text-sm font-medium">Region</label>
			<select id="region-select" bind:value={filterState.region} class="w-full rounded border p-2">
				<option>County</option>
				<option>State</option>
			</select>
		</div>
	</div>

	<!-- Map container -->
	<div class="relative rounded border bg-gray-50 p-4">
		<div
			bind:this={mapContainer}
			class="h-[600px] w-full cursor-grab overflow-hidden active:cursor-grabbing"
		></div>

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
</div>
