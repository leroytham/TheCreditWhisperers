import React from 'react';
import { industryData } from '../../config/sectorData';

/**
 * CountryList component - displays collapsible regions with countries
 */
const CountryList = ({ regions, selectedCountry, onCountrySelect, openRegions, onRegionToggle }) => {
  return (
    <div className="space-y-4 p-6">
      {regions.map((region) => (
        <div key={region.name} className="region-container">
          <div
            className="region-header flex justify-between items-center cursor-pointer p-2 rounded-md hover:bg-gray-50"
            onClick={() => onRegionToggle(region.name)}
          >
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider">
              {region.name}
            </h2>
            <svg
              className={`chevron-icon w-5 h-5 text-gray-500 transition-transform duration-200 ${
                openRegions[region.name] ? '' : 'rotate-180'
              }`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </div>
          {openRegions[region.name] && (
            <div className="country-list-container pl-2 pt-1 space-y-1">
              {region.countries.map((country) => {
                const hasSectors = !!industryData[country.code];
                return (
                  <div
                    key={country.code}
                    className={`filter-item p-3 rounded-md cursor-pointer ${
                      selectedCountry === country.code ? 'active' : ''
                    } ${
                      !hasSectors
                        ? 'unavailable text-gray-400 cursor-not-allowed'
                        : 'hover:bg-gray-50'
                    }`}
                    onClick={() => hasSectors && onCountrySelect(country.code)}
                  >
                    <span
                      className={`text-lg pointer-events-none font-normal ${
                        hasSectors ? 'text-gray-900' : 'text-gray-400'
                      }`}
                    >
                      {country.name}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ))}
    </div>
  );
};

export default CountryList;
