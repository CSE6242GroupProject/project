import type { PageLoad } from './$types';

// Define the type for our cancer data entries
interface CancerDataEntry {
	year: number;
	state_fips_code: number;
	county_fips_code: number;
	cancer_type: string;
	prediction: number;
}

export const load: PageLoad = async () => {
	try {
		// Load US county GeoJSON data
		const countyGeoData = await fetch(
			'https://cdn.jsdelivr.net/npm/us-atlas@3/counties-10m.json'
		).then((res) => res.json());

		// Load cancer prediction data from our static JSON file
		const cancerData: CancerDataEntry[] = await fetch('/cancer_data.json').then((res) =>
			res.json()
		);

		return {
			countyGeoData,
			cancerData
		};
	} catch (error) {
		console.error('Failed to load data:', error);
		return {
			error: 'Failed to load data'
		};
	}
};
