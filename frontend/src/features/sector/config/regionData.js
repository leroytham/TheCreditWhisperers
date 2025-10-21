/**
 * Regional grouping of countries for sector selection
 */

export const regions = [
  {
    name: 'Americas',
    countries: [
      { code: 'US', name: 'United States' },
      { code: 'CAN', name: 'Canada' },
    ],
  },
  {
    name: 'EMEA',
    countries: [
      { code: 'GBR', name: 'United Kingdom' },
      { code: 'DEU', name: 'Germany' },
      { code: 'FRA', name: 'France' },
      { code: 'SAU', name: 'Saudi Arabia' },
    ],
  },
  {
    name: 'APAC',
    countries: [
      { code: 'CHN', name: 'China' },
      { code: 'JPN', name: 'Japan' },
      { code: 'HKG', name: 'Hong Kong' },
      { code: 'IND', name: 'India' },
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
