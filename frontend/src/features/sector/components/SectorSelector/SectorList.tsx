import React from 'react';
import { industryData } from '../../config/sectorData';
import { getCountryName } from '../../config/regionData';
import { resolveSectorTicker, resolveDisplayTicker } from '../../utils/tickerResolver';

// Type definitions
interface Sector {
  name: string;
  index: string;
  ticker?: string;
  available: boolean;
}

interface SectorContext {
  countryCode: string;
  countryName: string;
  sector: Sector;
}

interface SectorListProps {
  selectedCountry: string | null;
  selectedSector: string | null;
  onSectorSelect?: (context: SectorContext) => void;
}

/**
 * SectorList component - displays sectors for selected country
 */
const SectorList: React.FC<SectorListProps> = ({ selectedCountry, selectedSector, onSectorSelect }) => {
  const countryName = getCountryName(selectedCountry || '');

  const handleSectorClick = (sector: Sector) => {
    if (!sector.available) return;

    const resolvedTicker = resolveSectorTicker(sector, selectedCountry ?? undefined);

    if (onSectorSelect && selectedCountry) {
      onSectorSelect({
        countryCode: selectedCountry,
        countryName: countryName,
        sector: { ...sector, ticker: resolvedTicker ?? sector.ticker },
      });
    }
  };

  return (
    <div className="overflow-y-auto no-scrollbar">
      <div className="p-6 sticky top-0 bg-white border-b border-gray-200 z-10">
        <h2 className="text-2xl font-semibold text-gray-900 tracking-tight">
          {selectedCountry ? `Sectors in ${countryName}` : 'Sectors'}
        </h2>
        {selectedCountry && (
          <p className="text-sm text-gray-600 mt-1">
            {((industryData as Record<string, Sector[]>)[selectedCountry])?.length || 0} sectors available
          </p>
        )}
      </div>
      <div className="space-y-2 p-6">
        {!selectedCountry && (
          <div className="flex flex-col items-center justify-center h-64 text-gray-400">
            <svg className="w-16 h-16 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
            <p className="text-center font-medium">Select a country to view sectors</p>
            <p className="text-sm text-gray-400 mt-1">Choose from the list on the left</p>
          </div>
        )}
        {selectedCountry && (
          <>
            {(industryData as Record<string, Sector[]>)[selectedCountry] ? (
              ((industryData as Record<string, Sector[]>)[selectedCountry]).map((sector: Sector) => (
                <div
                  key={sector.name}
                  className={`filter-item p-4 rounded-lg cursor-pointer flex flex-col border transition-all ${
                    selectedSector === sector.name
                      ? 'border-gray-900 bg-gray-50 shadow-sm'
                      : 'border-gray-200'
                  } ${
                    !sector.available
                      ? 'opacity-50 cursor-not-allowed'
                      : 'hover:border-gray-400 hover:shadow-sm'
                  }`}
                  onClick={() => handleSectorClick(sector)}
                >
                  <div className="flex items-center justify-between">
                    <span
                      className={`text-base font-medium ${
                        sector.available ? 'text-gray-900' : 'text-gray-400'
                      }`}
                    >
                      {sector.name}
                    </span>
                    {!sector.available && (
                      <span className="text-xs px-2 py-1 rounded bg-gray-100 text-gray-500">
                        Unavailable
                      </span>
                    )}
                  </div>
                  <div className="flex items-center justify-between mt-1">
                    <span className="text-sm text-gray-600">{sector.index}</span>
                    {sector.ticker && (
                      <span className="text-xs font-mono text-gray-500 bg-gray-100 px-2 py-0.5 rounded">
                        {resolveDisplayTicker(sector.ticker)}
                      </span>
                    )}
                  </div>
                </div>
              ))
            ) : (
              <div className="flex flex-col items-center justify-center h-64 text-gray-400">
                <svg className="w-16 h-16 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <p className="text-center font-medium">No sector data available</p>
                <p className="text-sm text-gray-400 mt-1">Data for this country is not available</p>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default SectorList;
