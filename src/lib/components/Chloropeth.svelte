<script lang="ts">
	//import * as d3 from 'd3';
	import { scaleQuantize } from 'd3-scale';
	import { geoPath, type GeoPath } from 'd3-geo';
	import { schemeReds } from 'd3-scale-chromatic';
	import * as topojson from 'topojson-client';
	import type { Topology, Objects } from 'topojson-specification';
	import type { FeatureCollection, Feature, Geometry, GeoJsonProperties } from 'geojson';
	import us from './us.json';
	import Legend from './Legend.svelte';

	type CancerDataPoint = {
		id: string; // County FIPS id
		rate: number;
	};

	type UsTopology = Topology<{
		counties: {
			type: 'GeometryCollection';
			geometries: any[];
		};
		states: {
			type: 'GeometryCollection';
			geometries: any[];
		};
		nation: {
			type: 'GeometryCollection';
			geometries: any[];
		};
	}>;

	let {
		data,
		minRate,
		maxRate,
		width = 975,
		height = 610,
		title = ''
	}: {
		data: CancerDataPoint[];
		minRate: number;
		maxRate: number;
		width?: number;
		height?: number;
		title?: string;
	} = $props();

	const usTyped = us as unknown as UsTopology;

	const colorScale = scaleQuantize([minRate, maxRate], schemeReds[9]);

	const path: GeoPath = geoPath();

	const valuemap = new Map(data.map((d: CancerDataPoint) => [d.id, d.rate]));

	const counties = topojson.feature(
		usTyped,
		usTyped.objects.counties
	) as unknown as FeatureCollection;
	const states = topojson.feature(usTyped, usTyped.objects.states) as unknown as FeatureCollection;
	const statemap = new Map(states.features.map((d: Feature) => [d.id, d]));

	const statemesh = topojson.mesh(usTyped, usTyped.objects.states, (a, b) => a !== b) as Geometry;

	const formatRate = (rate: number) => rate.toFixed(2);
</script>

<div class="relative w-full">
	<svg
		{width}
		{height}
		viewBox="0 0 {width} {height}"
		style:max-width="100%"
		style:height="auto"
		class="mx-auto"
	>
		<!-- Counties layer -->
		<g class="counties">
			{#each counties.features as county}
				{@const rate = valuemap.get(county.id as string) ?? 0}
				<path
					fill={colorScale(rate)}
					d={path(county)}
					class="county-path"
					data-tooltip={`Rate: ${formatRate(rate)}`}
				/>
			{/each}
		</g>

		<!-- State borders -->
		<path
			fill="none"
			stroke="white"
			stroke-width="0.5"
			stroke-linejoin="round"
			d={path(statemesh)}
			class="state-borders"
		/>

		<!-- Legend -->
		<Legend {colorScale} domain={[minRate, maxRate]} {title} />
	</svg>
</div>

<style>
	.county-path {
		stroke: #fff;
		stroke-width: 0.1;
		transition: opacity 0.2s;
	}

	.county-path:hover {
		opacity: 0.8;
		stroke-width: 0.3;
	}

	.state-borders {
		pointer-events: none;
	}
</style>
