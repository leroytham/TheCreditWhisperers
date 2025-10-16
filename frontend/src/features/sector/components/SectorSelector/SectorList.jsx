import React from 'react';
import { industryData } from '../../config/sectorData';
import { getCountryName } from '../../config/regionData';
import { resolveSectorTicker } from '../../utils/tickerResolver';

/**
 * SectorList component - displays sectors for selected country
 */
const SectorList = ({ selectedCountry, selectedSector, onSectorSelect }) => {
  const countryName = getCountryName(selectedCountry);

  const handleSectorClick = (sector) => {
    if (!sector.available) return;

    const resolvedTicker = resolveSectorTicker(sector, selectedCountry);

    if (onSectorSelect) {
      onSectorSelect({
        countryCode: selectedCountry,
        countryName: countryName,
        sector: { ...sector, ticker: resolvedTicker },
      });
    }
  };

  return (
    <div className="overflow-y-auto no-scrollbar">
      <div className="p-6 sticky top-0 bg-white border-b border-gray-200 z-10">
        <h1 className="text-3xl font-bold text-black tracking-tight">
          {selectedCountry ? `Sectors in ${countryName}` : 'Sectors'}
        </h1>
      </div>
      <div className="space-y-1 p-6">
        {!selectedCountry && (
          <div className="flex items-center justify-center h-full text-gray-400">
            <p>Select a country to view its sectors.</p>
          </div>
        )}
        {selectedCountry && (
          <>
            {industryData[selectedCountry] ? (
              industryData[selectedCountry].map((sector) => (
                <div
                  key={sector.name}
                  className={`filter-item p-3 rounded-md cursor-pointer flex flex-col ${
                    selectedSector === sector.name ? 'active' : ''
                  } ${
                    !sector.available
                      ? 'unavailable text-gray-400 cursor-not-allowed'
                      : 'hover:bg-gray-50'
                  }`}
                  onClick={() => handleSectorClick(sector)}
                >
                  <span
                    className={`text-lg font-normal ${
                      sector.available ? 'text-gray-900' : 'text-gray-400'
                    }`}
                  >
                    {sector.name}
                  </span>
                  <span className="text-sm text-gray-500">{sector.index}</span>
                  {!sector.available && (
                    <span className="ml-2 text-xs text-gray-300">(Unavailable)</span>
                  )}
                </div>
              ))
            ) : (
              <div className="flex items-center justify-center h-full text-gray-400">
                <p>No sector data available for this country.</p>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default SectorList;
