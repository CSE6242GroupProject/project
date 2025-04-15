import type { CancerDataEntry } from '$lib/types';
import type { PageLoad } from './$types';

const CANCER_FILES = [
	'brain_cancer_predictions.json',
	'colon_cancer_predictions.json',
	'kidney_cancer_predictions.json',
	'leukemia_cancer_predictions.json',
	'lung_cancer_predictions.json',
	'neoplasm_cancer_predictions.json',
	'non-hodgkin_lymphoma_cancer_predictions.json',
	'pancreatic_cancer_predictions.json',
	'prostate_cancer_predictions.json'
];

export const load: PageLoad = async ({ fetch: fetchSvelte }) => {
	try {
		// Load US county GeoJSON data
		const countyGeoData = await fetch(
			'https://cdn.jsdelivr.net/npm/us-atlas@3/counties-10m.json'
		).then((res) => res.json());

		// Load all cancer prediction data files
		const cancerDataPromises = CANCER_FILES.map((filename) =>
			fetchSvelte(`/${filename}`).then((res) => res.json())
		);

		// Wait for all files to load and combine their data
		const allCancerData = await Promise.all(cancerDataPromises);
		const cancerData: CancerDataEntry[] = allCancerData.flat();

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
