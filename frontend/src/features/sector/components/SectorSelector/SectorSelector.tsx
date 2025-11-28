import React, { useState } from 'react';
import { regions } from '../../config/regionData';
import CountryList from './CountryList';
import SectorList from './SectorList';

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

interface SectorSelectorProps {
  onSectorSelect?: (context: SectorContext) => void;
}

/**
 * SectorSelector component - Bloomberg-style two-panel country/sector selector
 */
const SectorSelector: React.FC<SectorSelectorProps> = ({ onSectorSelect }) => {
  const [selectedCountry, setSelectedCountry] = useState<string | null>(null);
  const [selectedSector, setSelectedSector] = useState<string | null>(null);
  const [openRegions, setOpenRegions] = useState<Record<string, boolean>>({
    Americas: true,
    EMEA: false,
    APAC: false
  });

  const handleRegionToggle = (regionName: string) => {
    setOpenRegions((prev) => ({ ...prev, [regionName]: !prev[regionName] }));
  };

  const handleCountrySelect = (countryCode: string) => {
    setSelectedCountry(countryCode);
    setSelectedSector(null); // Reset sector when country changes
  };

  const handleSectorSelect = (context: SectorContext) => {
    setSelectedSector(context.sector.name);
    if (onSectorSelect) {
      onSectorSelect(context);
    }
  };

  return (
    <div
      style={{
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
        WebkitFontSmoothing: 'antialiased',
        MozOsxFontSmoothing: 'grayscale'
      }}
    >
      <div
        className="flex w-full bg-white border border-gray-200 rounded-lg shadow overflow-hidden"
        style={{ minHeight: '60vh' }}
      >
        {/* Left: Country selection */}
        <div className="w-1/3 border-r border-gray-200 overflow-y-auto no-scrollbar">
          <div className="p-6 sticky top-0 bg-white border-b border-gray-200 z-10">
            <h2 className="text-2xl font-semibold text-gray-900 tracking-tight">Country</h2>
          </div>
          <CountryList
            regions={regions}
            selectedCountry={selectedCountry}
            onCountrySelect={handleCountrySelect}
            openRegions={openRegions}
            onRegionToggle={handleRegionToggle}
          />
        </div>

        {/* Right: Sector selection */}
        <div className="w-2/3">
          <SectorList
            selectedCountry={selectedCountry}
            selectedSector={selectedSector}
            onSectorSelect={handleSectorSelect}
          />
        </div>
      </div>

      <style>{`
        .filter-item {
          transition: background-color 0.2s ease-in-out;
        }
        .filter-item:hover:not(.unavailable) {
          background-color: #f9fafb;
        }
        .filter-item.active {
          background-color: #f3f4f6;
        }
        .filter-item.unavailable {
          color: #9ca3af;
          cursor: not-allowed;
        }
        .filter-item.unavailable .text-sm {
          color: #d1d5db;
        }
        .no-scrollbar::-webkit-scrollbar {
          display: none;
        }
        .no-scrollbar {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
      `}</style>
    </div>
  );
};

export default SectorSelector;
