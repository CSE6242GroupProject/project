<script lang="ts">
	import { onMount } from 'svelte';
	import * as d3 from 'd3';
	import type { Feature, FeatureCollection, Geometry } from 'geojson';
	import { feature, mesh } from 'topojson-client';
	import type { PageProps } from './$types';

	// Define the PesticideData type
	type PesticideData = {
		countyId: string;
		pesticideType: string;
		pesticideUsage: number;
		cancerRate: number;
		year: number;
	};

	// Import data from load function using Svelte 5 runes
	let { data }: PageProps = $props();

	// States for the filters
	let filterState = $state({
		indicator: 'Pesticide Impact',
		location: 'All',
		region: 'County',
		year: 2022,
		pesticideType: 'All',
		sex: 'Both'
	});

	// Title derived from state
	let title = $state(`Impact of Pesticides on Cancer Rates by County (${filterState.year})`);

	// Update title when year changes
	$effect(() => {
		title = `Impact of Pesticides on Cancer Rates by County (${filterState.year})`;
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

	// Year control handlers
	function decrementYear() {
		filterState.year = Math.max(2015, filterState.year - 1);
	}

	function incrementYear() {
		filterState.year = Math.min(2022, filterState.year + 1);
	}

	function renderMap() {
		// Clear previous map if it exists
		if (mapContainer) {
			// Use D3 to clear the container instead of direct DOM manipulation
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
		const filteredData =
			data.pesticidesData?.filter((d: PesticideData) => {
				return (
					(filterState.pesticideType === 'All' || d.pesticideType === filterState.pesticideType) &&
					d.year === filterState.year
				);
			}) || [];

		// Create map of pesticide data by county ID for easy lookup
		const pesticidesDataByCounty = new Map<string, PesticideData>();
		filteredData.forEach((d: PesticideData) => {
			pesticidesDataByCounty.set(d.countyId, d);
		});

		// Create color scale - using RdYlBu but reversed as in the image
		const colorScale = d3.scaleSequential(d3.interpolateRdYlBu).domain([0.6, 0]); // Higher values (more cancer) are red, lower are blue

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
		mapGroup = svg.append('g') as d3.Selection<SVGGElement, unknown, null, undefined>;

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
				const countyData = pesticidesDataByCounty.get(d.id);
				return countyData ? colorScale(countyData.cancerRate) : '#ccc';
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

		// Create legend - keep legend outside of the zoom group
		const legendWidth = 400;
		const legendHeight = 20;

		// Create legend scale
		const legendX = d3.scaleLinear().domain([0, 0.6]).range([0, legendWidth]);
		const legendAxis = d3.axisBottom(legendX).tickSize(13).ticks(8);

		// Position legend with more space from the bottom
		const legend = svg
			.append('g')
			.attr('transform', `translate(${(width - legendWidth) / 2}, ${height - 30})`);

		// Create gradient for legend
		const defs = svg.append('defs');
		const linearGradient = defs
			.append('linearGradient')
			.attr('id', 'legend-gradient')
			.attr('x1', '0%')
			.attr('y1', '0%')
			.attr('x2', '100%')
			.attr('y2', '0%');

		// Add color stops to gradient
		const stops = d3.range(0, 1.01, 0.1);
		stops.forEach((stop) => {
			linearGradient
				.append('stop')
				.attr('offset', `${stop * 100}%`)
				.attr('stop-color', colorScale(0.6 * (1 - stop)));
		});

		// Draw colored rectangle using gradient
		legend
			.append('rect')
			.attr('x', 0)
			.attr('y', 0)
			.attr('width', legendWidth)
			.attr('height', legendHeight)
			.style('fill', 'url(#legend-gradient)');

		// Add axis to legend
		legend
			.append('g')
			.call(legendAxis)
			.selectAll('text')
			.style('text-anchor', 'middle')
			.attr('dy', '10px');
	}

	// Zoom in function
	function zoomIn() {
		if (svg && zoom) {
			svg.transition().duration(300).call(zoom.scaleBy, 1.5);
		}
	}

	// Zoom out function
	function zoomOut() {
		if (svg && zoom) {
			svg.transition().duration(300).call(zoom.scaleBy, 0.75);
		}
	}

	// Reset zoom function
	function resetZoom() {
		if (svg && zoom) {
			svg.transition().duration(300).call(zoom.transform, d3.zoomIdentity);
		}
	}
</script>

<div class="container mx-auto px-4 py-8">
	<h1 class="mb-6 text-3xl font-bold">{title}</h1>

	<!-- Filter controls -->
	<div class="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6">
		<div>
			<label for="indicator-select" class="mb-1 block text-sm font-medium">Indicator</label>
			<select
				id="indicator-select"
				bind:value={filterState.indicator}
				class="w-full rounded border p-2"
			>
				<option>Pesticide Impact</option>
			</select>
		</div>

		<div>
			<label for="location-select" class="mb-1 block text-sm font-medium">Locations</label>
			<select
				id="location-select"
				bind:value={filterState.location}
				class="w-full rounded border p-2"
			>
				<option>All</option>
				<option>Add/Remove...</option>
			</select>
		</div>

		<div>
			<label for="region-select" class="mb-1 block text-sm font-medium">Region</label>
			<select id="region-select" bind:value={filterState.region} class="w-full rounded border p-2">
				<option>County</option>
				<option>State</option>
			</select>
		</div>

		<div>
			<label for="year-range" class="mb-1 block text-sm font-medium">Year</label>
			<div class="flex items-center">
				<button class="rounded-l border p-1" onclick={decrementYear}>◀</button>
				<input
					id="year-range"
					type="range"
					min="2015"
					max="2022"
					bind:value={filterState.year}
					class="w-full"
				/>
				<button class="rounded-r border p-1" onclick={incrementYear}>▶</button>
				<span class="ml-2">{filterState.year}</span>
			</div>
		</div>

		<div>
			<label for="pesticide-select" class="mb-1 block text-sm font-medium">Pesticide Type</label>
			<select
				id="pesticide-select"
				bind:value={filterState.pesticideType}
				class="w-full rounded border p-2"
			>
				<option>All</option>
				<option>Herbicides</option>
				<option>Insecticides</option>
				<option>Fungicides</option>
				<option>Rodenticides</option>
			</select>
		</div>

		<div>
			<label for="sex-select" class="mb-1 block text-sm font-medium">Sex</label>
			<select id="sex-select" bind:value={filterState.sex} class="w-full rounded border p-2">
				<option>Both</option>
				<option>Male</option>
				<option>Female</option>
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
