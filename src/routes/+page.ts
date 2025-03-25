import type { PageLoad } from './$types';

// Function to generate mock data for pesticide impact on cancer rates
function generateMockPesticidesData() {
	const data = [];
	const pesticideTypes = ['Herbicides', 'Insecticides', 'Fungicides', 'Rodenticides'];
	const years = Array.from({ length: 8 }, (_, i) => 2015 + i);

	// Create a pattern where some regions have higher pesticide usage
	// This will create clusters of high and low values on the map
	const regionalPatterns: Record<number, number> = {};

	// Generate about 3000 county entries (rough number of US counties)
	for (let fips = 1001; fips < 57000; fips++) {
		// Only include valid-ish FIPS codes
		if (fips % 1000 <= 200) {
			// First 2 digits are state code
			const stateCode = Math.floor(fips / 1000);

			// Create regional patterns - states with similar pesticide usage patterns
			if (!regionalPatterns[stateCode]) {
				regionalPatterns[stateCode] = Math.random();
			}

			// Generate data for each year
			for (const year of years) {
				// Base pesticide usage on regional pattern with some random variation
				const pesticideUsage = regionalPatterns[stateCode] * 70 + Math.random() * 30;

				// Add some year-over-year trends
				const yearTrend = (year - 2015) * 0.5; // Slight increase over time

				// Create mock cancer rate with some correlation to pesticide usage
				// Higher pesticide usage correlates with higher cancer rates
				const cancerRate = 0.15 + pesticideUsage / 200 + Math.random() * 0.1 + yearTrend / 100;

				// Randomly assign pesticide type for this county-year
				const pesticideType = pesticideTypes[Math.floor(Math.random() * pesticideTypes.length)];

				data.push({
					countyId: String(fips).padStart(5, '0'), // Format as FIPS code
					pesticideType,
					pesticideUsage,
					cancerRate: Math.min(0.6, cancerRate), // Cap at 0.6 (60%)
					year
				});
			}
		}
	}

	return data;
}

export const load: PageLoad = async () => {
	try {
		// Load US county GeoJSON data
		const countyGeoData = await fetch(
			'https://cdn.jsdelivr.net/npm/us-atlas@3/counties-10m.json'
		).then((res) => res.json());

		// Generate mock data for pesticide impact
		const pesticidesData = generateMockPesticidesData();

		return {
			countyGeoData,
			pesticidesData
		};
	} catch (error) {
		console.error('Failed to load data:', error);
		return {
			error: 'Failed to load data'
		};
	}
};
