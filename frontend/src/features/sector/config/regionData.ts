/**
 * Regional grouping of countries for sector selection
 * Organized into: United States (with sectors), Developed Markets, and Emerging Markets (country-level only)
 */

export const regions = [
  {
    name: 'United States',
    countries: [
      { code: 'US', name: 'United States', backendName: 'US' },
    ],
  },
  {
    name: 'Developed Markets',
    countries: [
      { code: 'CAN', name: 'Canada', backendName: 'Canada' },
      { code: 'JPN', name: 'Japan', backendName: 'Japan' },
      { code: 'DEU', name: 'Germany', backendName: 'Germany' },
      { code: 'GBR', name: 'United Kingdom', backendName: 'United_Kingdom' },
      { code: 'FRA', name: 'France', backendName: 'France' },
      { code: 'AUS', name: 'Australia', backendName: 'Australia' },
      { code: 'CHE', name: 'Switzerland', backendName: 'Switzerland' },
      { code: 'HKG', name: 'Hong Kong', backendName: 'Hong_Kong' },
      { code: 'ITA', name: 'Italy', backendName: 'Italy' },
      { code: 'ESP', name: 'Spain', backendName: 'Spain' },
      { code: 'NLD', name: 'Netherlands', backendName: 'Netherlands' },
      { code: 'SWE', name: 'Sweden', backendName: 'Sweden' },
      { code: 'SGP', name: 'Singapore', backendName: 'Singapore' },
      { code: 'BEL', name: 'Belgium', backendName: 'Belgium' },
      { code: 'AUT', name: 'Austria', backendName: 'Austria' },
    ],
  },
  {
    name: 'Emerging Markets',
    countries: [
      { code: 'CHN', name: 'China', backendName: 'China' },
      { code: 'IND', name: 'India', backendName: 'India' },
      { code: 'TWN', name: 'Taiwan', backendName: 'Taiwan' },
      { code: 'KOR', name: 'South Korea', backendName: 'South_Korea' },
      { code: 'BRA', name: 'Brazil', backendName: 'Brazil' },
      { code: 'MEX', name: 'Mexico', backendName: 'Mexico' },
      { code: 'ZAF', name: 'South Africa', backendName: 'South_Africa' },
      { code: 'MYS', name: 'Malaysia', backendName: 'Malaysia' },
      { code: 'TUR', name: 'Turkey', backendName: 'Turkey' },
      { code: 'POL', name: 'Poland', backendName: 'Poland' },
      { code: 'CHL', name: 'Chile', backendName: 'Chile' },
      { code: 'PER', name: 'Peru', backendName: 'Peru' },
    ],
  },
];

/**
 * Helper function to get country name by code
 * @param {string} code - Country code (e.g., 'US', 'CHN')
 * @returns {string} Country name or empty string if not found
 */
export const getCountryName = (code) => {
  for (const region of regions) {
    for (const country of region.countries) {
      if (country.code === code) return country.name;
    }
  }
  return '';
};
