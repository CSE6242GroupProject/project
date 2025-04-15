// Define the type for our cancer data entries
export interface CancerDataEntry {
	year: number;
	fips: string;
	cancerType: string;
	prediction: number;
}
