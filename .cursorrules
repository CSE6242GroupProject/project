# Project Guidelines for Claude

Lint each file you update or create to ensure correctness of syntax.

Review the Svelte 5 syntax at https://svelte.dev/docs/svelte.

# Product Requirements Document for Cancer Rate Visualization App

## Overview

This web application is a single-page app that visualizes predicted cancer rates due to pesticide exposure across U.S. counties using an interactive chloropleth map. The map is segmented by county, with each segment’s color intensity reflecting the predicted cancer rate. Users can filter the map by year and cancer type to explore trends and patterns in the data. Developed for a course on Data Visualizations and Analytics, the application leverages modern web technologies to deliver an effective data visualization experience.

## Functional Requirements

- **Chloropleth Map:** Display a map of the United States segmented by counties, with each county colored according to the predicted cancer rate due to pesticide exposure.
- **Color Scale:** Implement a sequential color scale where higher predicted cancer rates correspond to darker colors.
- **Filters:** Provide interactive controls for users to select a specific year and cancer type.
- **Dynamic Updates:** Update the map visualization in real-time when users apply or change filters, without requiring a page reload.
- **Data Integration:** Load and process data from a CSV file containing the following columns:
  - `year`
  - `state_fips_code`
  - `county_fips_code`
  - `cancer_type`
  - `predictions`
- **Data Mapping:** Use state and county FIPS codes to accurately associate prediction data with the corresponding counties on the map.
- **Dynamic Filters:** Automatically populate filter options (years and cancer types) based on the unique values present in the CSV data.

## Non-Functional Requirements

- **Performance:** Ensure the application loads quickly and responds smoothly to user interactions, even with large datasets.
- **Usability:** Design an intuitive interface that allows users to easily interact with the map and filters.
- **Accessibility:** Make the application usable across various devices and screen sizes, including desktops, tablets, and mobile devices.
- **Code Quality:** Maintain clean, modular, and well-documented code to facilitate collaboration and future maintenance.

## User Interface Requirements

- **Single-Page Application:** Deliver all functionality within a single web page.
- **Map Display:** Position the chloropleth map as the primary visual element, occupying the majority of the screen.
- **Filter Controls:** Include user-friendly widgets (e.g., dropdown menus) for selecting year and cancer type, placed prominently near the map.
- **Legend:** Display a color legend to explain the mapping between color intensity and predicted cancer rates.
- **Optional Tooltips:** (If time permits) Show the county name and exact prediction value when users hover over a county.

## Data Requirements

- **Data Source:** Utilize a CSV file as the primary data source, with columns: `year`, `state_fips_code`, `county_fips_code`, `cancer_type`, `predictions`.
- **Data Processing:** Parse the CSV file and convert its contents into JSON objects for use within the application.
- **Data Filtering:** Filter and aggregate the data dynamically based on the user-selected year and cancer type.
- **Geographic Data:** Incorporate TopoJSON data representing U.S. county boundaries to render the chloropleth map.

## Technical Stack

- **Frontend Framework:** Svelte 5 and SvelteKit 2 for building the single-page application.
- **Visualization Library:** D3.js for rendering the chloropleth map and handling data-driven visualizations.
- **Geographic Data Handling:** topojson-client to process and integrate TopoJSON geographic data.
- **Styling:** Tailwind v4 for responsive and efficient CSS styling.
- **Data Format:** JSON objects, derived from the CSV data, for internal data representation and manipulation.

## Constraints

- The application must operate as a single-page app, with no multi-page navigation.
- Development must adhere to the specified technologies: Svelte 5, SvelteKit 2, D3.js, topojson-client, and Tailwind v4.
- Data is restricted to the provided CSV file; no additional external data sources are to be used.

## Assumptions

- The CSV data is complete, with no missing or inconsistent values for the specified columns.
- Every county displayed on the map has corresponding data in the CSV file for all relevant years and cancer types.
- Users possess basic familiarity with web-based maps and filtering interfaces, requiring minimal onboarding.

## Commands

- **Development**: `bun run dev` - Starts dev server
- **Build**: `bun run build` - Builds production version
- **Lint**: `bun run lint` - Runs Prettier and ESLint
- **Format**: `bun run format` - Auto-formats code with Prettier
- **Type Check**: `bun run check` - Validates TypeScript types

## Code Style

- **Framework**: SvelteKit with Svelte 5 runes and TypeScript
- **Formatting**: Prettier with tailwind plugin (2-space indent, single quotes)
- **CSS**: TailwindCSS for styling
- **Types**: Strict TypeScript, explicit type annotations for function params and returns
- **Imports**: Group imports: Svelte first, third-party libs next, local modules last
- **Error Handling**: Use try/catch with specific error types, provide fallback UI

## Naming Conventions

- **Components**: PascalCase
- **Functions**: camelCase
- **Variables**: camelCase
- **Constants**: camelCase (not UPPER_CASE)
- **Types/Interfaces**: PascalCase, prefixed with type for type aliases

## Data Visualization

- Use D3.js for visualizations
- TopoJSON/GeoJSON for map data
- Maintain responsive SVG containers
- Properly type data structures and D3 selections
