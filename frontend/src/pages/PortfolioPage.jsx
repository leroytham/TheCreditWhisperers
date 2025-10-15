import React, { useState, useEffect, useRef, useLayoutEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Menu, Search, Bell, User, LogOut } from "lucide-react";

// --- Hardcoded country/sector data (from trial_v3.html) ---
const industryData = {
  US: [ { name: 'All Sectors', index: 'S&P 500', ticker: '^GSPC', available: true }, { name: 'Communication Services', index: 'S&P 500 Communication Services', ticker: '^SP500-50', available: true }, { name: 'Consumer Discretionary', index: 'S&P 500 Consumer Discretionary', ticker: '^SP500-25', available: true }, { name: 'Consumer Staples', index: 'S&P 500 Consumer Staples', ticker: '^SP500-30', available: true }, { name: 'Energy', index: 'S&P 500 Energy', ticker: '^GSPE', available: true }, { name: 'Financials', index: 'S&P 500 Financials', ticker: '^SP500-40', available: true }, { name: 'Health Care', index: 'S&P 500 Health Care', ticker: '^SP500-35', available: true }, { name: 'Industrials', index: 'S&P 500 Industrials', ticker: '^SP500-20', available: true }, { name: 'Information Technology', index: 'S&P 500 Information Technology', ticker: '^SP500-45', available: true }, { name: 'Materials', index: 'S&P 500 Materials', ticker: '^SP500-15', available: true }, { name: 'Real Estate', index: 'S&P 500 Real Estate', ticker: '^SP500-60', available: true }, { name: 'Utilities', index: 'S&P 500 Utilities', ticker: '^SP500-55', available: true } ],
  CHN: [ { name: 'All Sectors', index: 'CSI 300', ticker: '000300.SS', available: true }, { name: 'Energy', index: 'CSI 300 Energy', ticker: '000908.SH', available: false }, { name: 'Materials', index: 'CSI 300 Materials', ticker: '000909.SH', available: false }, { name: 'Industrials', index: 'CSI 300 Industrials', ticker: '000910.SH', available: false }, { name: 'Consumer Discretionary', index: 'CSI 300 Consumer Discretionary', ticker: '000911.SH', available: false }, { name: 'Consumer Staples', index: 'CSI 300 Consumer Staples', ticker: '000912.SH', available: false }, { name: 'Health Care', index: 'CSI 300 Health Care', ticker: '000913.SH', available: false }, { name: 'Financials', index: 'CSI 300 Financials', ticker: '000914.SH', available: false }, { name: 'Information Technology', index: 'CSI 300 Information Technology', ticker: '000915.SH', available: false }, { name: 'Telecommunication', index: 'CSI 300 Telecommunication', ticker: '000916.SH', available: false }, { name: 'Utilities', index: 'CSI 300 Utilities', ticker: '000917.SH', available: false } ],
  JPN: [ { name: 'All Sectors', index: 'Nikkei 225', ticker: '^N225', available: true }, { name: 'Foods', index: 'TOPIX-17 Foods', ticker: '.IFD.T', available: false }, { name: 'Fishery, Agriculture & Forestry', index: 'TOPIX-17 Fishery', ticker: '.IAF.T', available: false }, { name: 'Mining', index: 'TOPIX-17 Mining', ticker: '.IMN.T', available: false }, { name: 'Construction', index: 'TOPIX-17 Construction', ticker: '.ICN.T', available: false }, { name: 'Textiles & Apparels', index: 'TOPIX-17 Textiles', ticker: '.ITX.T', available: false }, { name: 'Pulp & Paper', index: 'TOPIX-17 Pulp & Paper', ticker: '.IPP.T', available: false }, { name: 'Chemicals', index: 'TOPIX-17 Chemicals', ticker: '.ICH.T', available: false }, { name: 'Pharmaceutical', index: 'TOPIX-17 Pharmaceutical', ticker: '.IPH.T', available: false }, { name: 'Oil & Coal Products', index: 'TOPIX-17 Oil & Coal', ticker: '.IOC.T', available: false }, { name: 'Rubber Products', index: 'TOPIX-17 Rubber', ticker: '.IRB.T', available: false }, { name: 'Glass & Ceramics Products', index: 'TOPIX-17 Glass & Ceramics', ticker: '.IGL.T', available: false }, { name: 'Iron & Steel', index: 'TOPIX-17 Iron & Steel', ticker: '.IST.T', available: false }, { name: 'Nonferrous Metals', index: 'TOPIX-17 Nonferrous Metals', ticker: '.INF.T', available: false }, { name: 'Metal Products', index: 'TOPIX-17 Metal Products', ticker: '.IMT.T', available: false }, { name: 'Machinery', index: 'TOPIX-17 Machinery', ticker: '.IMH.T', available: false }, { name: 'Electric Appliances', index: 'TOPIX-17 Electric Appliances', ticker: '.IEA.T', available: false }, { name: 'Transportation Equipment', index: 'TOPIX-17 Transportation Equipment', ticker: '.ITE.T', available: false }, { name: 'Precision Instruments', index: 'TOPIX-17 Precision Instruments', ticker: '.IPR.T', available: false }, { name: 'Other Products', index: 'TOPIX-17 Other Products', ticker: '.IOP.T', available: false }, { name: 'Electric Power & Gas', index: 'TOPIX-17 Electric Power & Gas', ticker: '.IEG.T', available: false }, { name: 'Land Transportation', index: 'TOPIX-17 Land Transportation', ticker: '.ILT.T', available: false }, { name: 'Marine Transportation', index: 'TOPIX-17 Marine Transportation', ticker: '.IMR.T', available: false }, { name: 'Air Transportation', index: 'TOPIX-17 Air Transportation', ticker: '.IAT.T', available: false }, { name: 'Warehousing', index: 'TOPIX-17 Warehousing', ticker: '.IWH.T', available: false }, { name: 'Information & Communication', index: 'TOPIX-17 Info & Comm', ticker: '.IIC.T', available: false }, { name: 'Wholesale Trade', index: 'TOPIX-17 Wholesale Trade', ticker: '.IWS.T', available: false }, { name: 'Retail Trade', index: 'TOPIX-17 Retail Trade', ticker: '.IRT.T', available: false }, { name: 'Banks', index: 'TOPIX-17 Banks', ticker: '.IBK.T', available: false }, { name: 'Securities', index: 'TOPIX-17 Securities', ticker: '.ISC.T', available: false }, { name: 'Insurance', index: 'TOPIX-17 Insurance', ticker: '.IIN.T', available: false }, { name: 'Other Financing Business', index: 'TOPIX-17 Other Financing', ticker: '.IOF.T', available: false }, { name: 'Real Estate', index: 'TOPIX-17 Real Estate', ticker: '.IRE.T', available: false }, { name: 'Services', index: 'TOPIX-17 Services', ticker: '.ISV.T', available: false } ],
  HKG: [ { name: 'All Sectors', index: 'HANG SENG INDEX', ticker: '^HSI', available: true }, { name: 'Finance', index: 'Hang Seng Finance', ticker: '^HSNF', available: false }, { name: 'Utilities', index: 'Hang Seng Utilities', ticker: '^HSNU', available: false }, { name: 'Properties', index: 'Hang Seng Properties', ticker: '^HSNP', available: false }, { name: 'Commerce & Industry', index: 'Hang Seng Commerce & Industry', ticker: '^HSCI', available: false } ],
  IND: [ { name: 'All Sectors', index: 'NIFTY 50', ticker: '^NSEI', available: true }, { name: 'Auto', index: 'Nifty Auto', ticker: '^CNXAUTO', available: false }, { name: 'Bank', index: 'Nifty Bank', ticker: '^NSEBANK', available: false }, { name: 'Energy', index: 'Nifty Energy', ticker: '^CNXENERGY', available: false }, { name: 'Financial Services', index: 'Nifty Financial Services', ticker: '^CNXFIN', available: false }, { name: 'FMCG', index: 'Nifty FMCG', ticker: '^CNXFMCG', available: false }, { name: 'IT', index: 'Nifty IT', ticker: '^CNXIT', available: false }, { name: 'Media', index: 'Nifty Media', ticker: '^CNXMEDIA', available: false }, { name: 'Metal', index: 'Nifty Metal', ticker: '^CNXMETAL', available: false }, { name: 'Pharma', index: 'Nifty Pharma', ticker: '^CNXPHARMA', available: false }, { name: 'Realty', index: 'Nifty Realty', ticker: '^CNXREALTY', available: false } ],
  FRA: [ { name: 'All Sectors', index: 'CAC 40', ticker: '^FCHI', available: true }, { name: 'Financials', index: 'CAC Financials', ticker: '^PAX', available: false }, { name: 'Industrials', index: 'CAC Industrials', ticker: '^PCIN', available: false }, { name: 'Consumer Services', index: 'CAC Consumer Services', ticker: '^PCCS', available: false }, { name: 'Health Care', index: 'CAC Health Care', ticker: '^PCHC', available: false } ],
  GBR: [ { name: 'All Sectors', index: 'FTSE 100', ticker: '^FTSE', available: true }, { name: 'Automobiles & Parts', index: 'FTSE 350 Automobiles & Parts', ticker: '^FTNMX401010', available: false }, { name: 'Banks', index: 'FTSE 350 Banks', ticker: '^FTNMX301010', available: false }, { name: 'Basic Resources', index: 'FTSE 350 Basic Resources', ticker: '^FTNMX551010', available: false }, { name: 'Chemicals', index: 'FTSE 350 Chemicals', ticker: '^FTNMX552010', available: false }, { name: 'Construction & Materials', index: 'FTSE 350 Construction & Materials', ticker: '^FTNMX501010', available: false }, { name: 'Financial Services', index: 'FTSE 350 Financial Services', ticker: '^FTNMX302010', available: false }, { name: 'Food & Beverage', index: 'FTSE 350 Food & Beverage', ticker: '^FTNMX452010', available: false }, { name: 'Health Care', index: 'FTSE 350 Health Care', ticker: '^FTNMX201010', available: false }, { name: 'Industrial Goods & Services', index: 'FTSE 350 Industrial Goods & Services', ticker: '^FTNMX502010', available: false }, { name: 'Insurance', index: 'FTSE 350 Insurance', ticker: '^FTNMX303010', available: false }, { name: 'Media', index: 'FTSE 350 Media', ticker: '^FTNMX403010', available: false }, { name: 'Oil & Gas', index: 'FTSE 350 Oil & Gas', ticker: '^FTNMX601010', available: false }, { name: 'Personal & Household Goods', index: 'FTSE 350 Personal & Household Goods', ticker: '^FTNMX452020', available: false }, { name: 'Real Estate', index: 'FTSE 350 Real Estate', ticker: '^FTNMX351010', available: false }, { name: 'Retail', index: 'FTSE 350 Retail', ticker: '^FTNMX404010', available: false }, { name: 'Technology', index: 'FTSE 350 Technology', ticker: '^FTNMX202010', available: false }, { name: 'Telecommunications', index: 'FTSE 350 Telecommunications', ticker: '^FTNMX101010', available: false }, { name: 'Travel & Leisure', index: 'FTSE 350 Travel & Leisure', ticker: '^FTNMX405010', available: false }, { name: 'Utilities', index: 'FTSE 350 Utilities', ticker: '^FTNMX651010', available: false } ],
  CAN: [ { name: 'All Sectors', index: 'S&P/TSX Composite', ticker: '^GSPTSE', available: true }, { name: 'Communication Services', index: 'S&P/TSX Capped Communication Services', ticker: '^TTCM', available: false }, { name: 'Consumer Discretionary', index: 'S&P/TSX Capped Consumer Discretionary', ticker: '^TTCD', available: false }, { name: 'Consumer Staples', index: 'S&P/TSX Capped Consumer Staples', ticker: '^TTCS', available: false }, { name: 'Energy', index: 'S&P/TSX Capped Energy', ticker: '^TTEN', available: false }, { name: 'Financials', index: 'S&P/TSX Capped Financials', ticker: '^TTFS', available: false }, { name: 'Health Care', index: 'S&P/TSX Capped Health Care', ticker: '^TTHC', available: false }, { name: 'Industrials', index: 'S&P/TSX Capped Industrials', ticker: '^TTIN', available: false }, { name: 'Information Technology', index: 'S&P/TSX Capped Information Technology', ticker: '^TTTK', available: false }, { name: 'Materials', index: 'S&P/TSX Capped Materials', ticker: '^TTMT', available: false }, { name: 'Real Estate', index: 'S&P/TSX Capped Real Estate', ticker: '^TTRE', available: false }, { name: 'Utilities', index: 'S&P/TSX Capped Utilities', ticker: '^TTUT', available: false } ],
  DEU: [ { name: 'All Sectors', index: 'DAX PERFORMANCE-INDEX', ticker: '^GDAXI', available: true }, { name: 'Automobile', index: 'DAXsector All Automobile', ticker: '^D1A0', available: false }, { name: 'Banks', index: 'DAXsector All Banks', ticker: '^D1B0', available: false }, { name: 'Basic Resources', index: 'DAXsector All Basic Resources', ticker: '^D1C0', available: false }, { name: 'Chemicals', index: 'DAXsector All Chemicals', ticker: '^D1D0', available: false }, { name: 'Construction', index: 'DAXsector All Construction', ticker: '^D1E0', available: false }, { name: 'Financial Services', index: 'DAXsector All Financial Services', ticker: '^D1F0', available: false }, { name: 'Food & Beverage', index: 'DAXsector All Food & Beverage', ticker: '^D1G0', available: false }, { name: 'Health Care', index: 'DAXsector All Health Care', ticker: '^D1H0', available: false }, { name: 'Industrial', index: 'DAXsector All Industrial', ticker: '^D1I0', available: false }, { name: 'Insurance', index: 'DAXsector All Insurance', ticker: '^D1K0', available: false }, { name: 'Media', index: 'DAXsector All Media', ticker: '^D1L0', available: false }, { name: 'Oil & Gas', index: 'DAXsector All Oil & Gas', ticker: '^D1M0', available: false }, { name: 'Real Estate', index: 'DAXsector All Real Estate', ticker: '^D1N0', available: false }, { name: 'Retail', index: 'DAXsector All Retail', ticker: '^D1P0', available: false }, { name: 'Technology', index: 'DAXsector All Technology', ticker: '^D1R0', available: false }, { name: 'Telecommunication', index: 'DAXsector All Telecommunication', ticker: '^D1S0', available: false }, { name: 'Travel & Leisure', index: 'DAXsector All Travel & Leisure', ticker: '^D1T0', available: false }, { name: 'Utilities', index: 'DAXsector All Utilities', ticker: '^D1U0', available: false } ],
  SAU: [ { name: 'All Sectors', index: 'Tadawul All Share', ticker: '^TASI.SR', available: true }, { name: 'Energy', index: 'Tadawul Energy', ticker: 'TASI10.SR', available: false }, { name: 'Materials', index: 'Tadawul Materials', ticker: 'TASI20.SR', available: false }, { name: 'Financials', index: 'Tadawul Financials', ticker: 'TASI40.SR', available: false } ]
};

const regions = [
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

const BloombergSelector = ({ onSectorSelect }) => {
  const [selectedCountry, setSelectedCountry] = useState(null);
  const [selectedSector, setSelectedSector] = useState(null);
  const [openRegions, setOpenRegions] = useState({ Americas: true, EMEA: false, APAC: false });

  const handleRegionToggle = (regionName) => {
    setOpenRegions((prev) => ({ ...prev, [regionName]: !prev[regionName] }));
  };

  const getCountryName = (code) => {
    for (const region of regions) {
      for (const country of region.countries) {
        if (country.code === code) return country.name;
      }
    }
    return '';
  };

  return (
    <div className="mt-8" style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif', WebkitFontSmoothing: 'antialiased', MozOsxFontSmoothing: 'grayscale' }}>
      <div className="flex w-full bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden" style={{ minHeight: '60vh' }}>
        {/* Left: Country selection */}
        <div className="w-1/3 border-r border-gray-200 overflow-y-auto no-scrollbar">
          <div className="p-6 sticky top-0 bg-white border-b border-gray-200 z-10">
            <h1 className="text-3xl font-bold text-black tracking-tight">Country</h1>
          </div>
          <div className="space-y-4 p-6">
            {regions.map((region) => (
              <div key={region.name} className="region-container">
                <div
                  className="region-header flex justify-between items-center cursor-pointer p-2 rounded-md hover:bg-gray-50"
                  onClick={() => handleRegionToggle(region.name)}
                >
                  <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider">{region.name}</h2>
                  <svg
                    className={`chevron-icon w-5 h-5 text-gray-500 transition-transform duration-200 ${openRegions[region.name] ? '' : 'rotate-180'}`}
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
                          className={`filter-item p-3 rounded-md cursor-pointer ${selectedCountry === country.code ? 'active' : ''} ${!hasSectors ? 'unavailable text-gray-400 cursor-not-allowed' : 'hover:bg-gray-50'}`}
                          onClick={() => hasSectors && setSelectedCountry(country.code)}
                        >
                          <span className={`text-lg pointer-events-none font-normal ${hasSectors ? 'text-gray-900' : 'text-gray-400'}`}>{country.name}</span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
        {/* Right: Sector selection */}
        <div className="w-2/3 overflow-y-auto no-scrollbar">
          <div className="p-6 sticky top-0 bg-white border-b border-gray-200 z-10">
            <h1 className="text-3xl font-bold text-black tracking-tight">
              {selectedCountry ? `Sectors in ${getCountryName(selectedCountry)}` : 'Sectors'}
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
                      className={`filter-item p-3 rounded-md cursor-pointer flex flex-col ${selectedSector === sector.name ? 'active' : ''} ${!sector.available ? 'unavailable text-gray-400 cursor-not-allowed' : 'hover:bg-gray-50'}`}
                      onClick={() => {
                        if (!sector.available) return;
                        setSelectedSector(sector.name);

                        // Resolve a ticker for the selected sector to mirror trial_v3 behaviour
                        // Prefer index tickers for sectors (not ETFs). Example: S&P500 Technology -> 'sp500-45'
                        const sectorTickerOverrides = {
                          'All Sectors': '^GSPC',
                          'Communication Services': 'sp500-communication-services',
                          'Consumer Discretionary': 'sp500-consumer-discretionary',
                          'Consumer Staples': 'sp500-consumer-staples',
                          'Energy': 'XLE',
                          'Financials': 'sp500-financials',
                          'Health Care': 'sp500-health-care',
                          'Industrials': 'sp500-industrials',
                          // Use the numeric-style index code for Technology as in trial_v3 example
                          'Information Technology': 'sp500-45',
                          'Materials': 'sp500-materials',
                          'Real Estate': 'sp500-real-estate',
                          'Utilities': 'sp500-utilities'
                        };

                        const countryDefaultTickers = {
                          US: '^GSPC',
                          CHN: '000300.SS',
                          JPN: '^N225',
                          HKG: '^HSI',
                          IND: '^NSEI',
                          FRA: '^FCHI',
                          GBR: '^FTSE',
                          CAN: '^GSPTSE',
                          DEU: '^GDAXI',
                          SAU: '^TASI.SR'
                        };

                        let resolvedTicker = null;
                        if (sector.ticker) resolvedTicker = sector.ticker;
                        else if (sectorTickerOverrides[sector.name]) resolvedTicker = sectorTickerOverrides[sector.name];
                        else if (sector.index && (/\^|\./).test(sector.index)) resolvedTicker = sector.index;
                        else resolvedTicker = countryDefaultTickers[selectedCountry] || null;

                        if (onSectorSelect) {
                          onSectorSelect({
                            countryCode: selectedCountry,
                            countryName: getCountryName(selectedCountry),
                            sector: { ...sector, ticker: resolvedTicker },
                          });
                        }
                      }}
                    >
                      <span className={`text-lg font-normal ${sector.available ? 'text-gray-900' : 'text-gray-400'}`}>{sector.name}</span>
                      <span className="text-sm text-gray-500">{sector.index}</span>
                      {!sector.available && <span className="ml-2 text-xs text-gray-300">(Unavailable)</span>}
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

const PerformanceView = ({ context, onBack }) => {

  const countryCode = context?.countryCode || '';
  const countryName = context?.countryName || '';
  const sector = context?.sector || null;
  const sectorName = sector?.name || '';
  const indexName = sector?.index || '';

  const [loading, setLoading] = useState(true);
  const [priceData1Y, setPriceData1Y] = useState([]);
  const [priceData, setPriceData] = useState([]);
  const [companyName, setCompanyName] = useState('');
  const [currency, setCurrency] = useState('USD');
  const [news, setNews] = useState([]);
  const [sentimentAvg, setSentimentAvg] = useState(null);
  const [dailySentiment, setDailySentiment] = useState({});
  const [error, setError] = useState(null);

  const TIMEFRAMES = ['5D', '1M', '3M', '6M', 'YTD', '1Y'];
  const NUM_X_AXIS_POINTS = 6;
  const [timeframe, setTimeframe] = useState('1M');
  const [hoveredPoint, setHoveredPoint] = useState(null);
  const [hoveredBar, setHoveredBar] = useState(null);
  const [visibleHeadlines, setVisibleHeadlines] = useState(5);
  const chartContainerRef = useRef(null);
  const [dynamicChartWidth, setDynamicChartWidth] = useState(660);
  const [topConstituents, setTopConstituents] = useState([]);
  const [topEvents, setTopEvents] = useState([]);

  const [showEvents, setShowEvents] = useState(true);



  // Measure container width and update chart width for responsive behavior
  useLayoutEffect(() => {
    const measure = () => {
      const el = chartContainerRef.current;
      if (!el) return;
      const w = Math.max(300, el.clientWidth - 120); // leave paddings for left/right margins
      setDynamicChartWidth(Math.min(1000, w));
    };
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, []);

  // Default country -> index ticker mapping (fallbacks)
  const countryDefaultTickers = {
    US: '^GSPC',
    CHN: '000300.SS',
    JPN: '^N225',
    HKG: '^HSI',
    IND: '^NSEI',
    FRA: '^FCHI',
    GBR: '^FTSE',
    CAN: '^GSPTSE',
    DEU: '^GDAXI',
    SAU: '^TASI.SR'
  };

  // Determine ticker to use for API calls
  const determineTicker = () => {
    // If sector provides an explicit ticker property
    if (sector && sector.ticker) return sector.ticker;
    // Prefer sector -> ticker overrides for common S&P sector names (use SPDR sector ETFs)
    const sectorTickerOverrides = {
      'All Sectors': '^GSPC',
      'Communication Services': 'sp500-communication-services',
      'Consumer Discretionary': 'sp500-consumer-discretionary',
      'Consumer Staples': 'sp500-consumer-staples',
      'Energy': 'sp500-energy',
      'Financials': 'sp500-financials',
      'Health Care': 'sp500-health-care',
      'Industrials': 'sp500-industrials',
      'Information Technology': 'sp500-45',
      'Materials': 'sp500-materials',
      'Real Estate': 'sp500-real-estate',
      'Utilities': 'sp500-utilities'
    };

    



    // If sector name is recognized, return mapped ETF/ticker
    if (sector && sector.name) {
      const match = sectorTickerOverrides[sector.name];
      if (match) return match;
    }

    // If indexName looks like a ticker (contains ^ or a dot), use it
    if (indexName && (/\^|\./).test(indexName)) return indexName;

    // If sector.index includes a known index key (e.g., 'S&P 500'), try to infer
    if (indexName && /S&P|SP500|SP 500|S&P 500/i.test(indexName) && sector && sector.name) {
      const inferred = sectorTickerOverrides[sector.name];
      if (inferred) return inferred;
    }

    // Otherwise fall back to country default
    return countryDefaultTickers[countryCode] || 'AAPL';
  };
  const ticker = determineTicker();

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    setError(null);
    setTopEvents([]);
    
    // Map S&P sector codes to real Yahoo/ETF tickers for news
    const newsTickerOverrides = {
      '^SP500-25': 'XLY',   // Consumer Discretionary
      '^SP500-30': 'XLP',   // Consumer Staples
      '^SP500-35': 'XLV',   // Health Care
      '^SP500-40': 'XLF',   // Financials
      '^SP500-45': 'XLK',   // Tech
      '^SP500-50': 'XLC',   // Communication Services
      '^SP500-55': 'XLU',   // Utilities
      '^SP500-60': 'XLRE',  // Real Estate
      '^SP500-15': 'XLB',   // Materials
      '^SP500-20': 'XLI',   // Industrials
      '^GSPE': 'XLE',       // Energy
    };
    const newsTicker = newsTickerOverrides[ticker] || ticker;

    const fetchPrice = fetch(`/api/price?ticker=${encodeURIComponent(ticker)}&timeframe=1Y`).then(r => r.json());
    const fetchConstituents = fetch(`http://localhost:5001/top-constituents?ticker=${encodeURIComponent(newsTicker)}`).then(r => r.json());

    // const fetchNews = fetch(`/api/news?ticker=${encodeURIComponent(ticker)}`).then(r => r.json());
    const fetchNews = fetch(`http://localhost:5001/news?ticker=${encodeURIComponent(newsTicker)}`)
    .then(r => r.json());

    // fetch daily sentiment
    const fetchDailySentiment = fetch(`/api/daily-sentiment?ticker=${encodeURIComponent(newsTicker)}`)
    .then(r => r.json());

    // fetch significant events api
    const fetchAnalysis = fetch(
      `/api/stocks/${encodeURIComponent(newsTicker)}/significant-events`
    ).then(r => r.json());


    Promise.allSettled([fetchPrice, fetchNews, fetchConstituents, fetchDailySentiment, fetchAnalysis]).then(([priceRes, newsRes, constRes, dailySentimentRes, analysisRes]) => {
      if (!mounted) return;
      // Price result
      if (priceRes.status === 'fulfilled' && priceRes.value) {
        const p = priceRes.value;
        // API returns { prices: [...], company_name, currency } per backend
        setPriceData1Y(p.prices || []);
        setCompanyName(p.company_name || '');
        setCurrency(p.currency || 'USD');
      } else {
        console.error('Price fetch failed', priceRes.reason || priceRes.value);
        setError(prev => prev ? prev + ' | price failed' : 'price failed');
      }
      // News result: normalize different possible backend field names so the UI can render
      let newsReceived = false;
      if (newsRes.status === 'fulfilled' && newsRes.value) {
        console.log("This is the value" , newsRes.value)
        const n = newsRes.value;
        const raw = n.news || [];
        const normalized = raw.map(article => ({
          // handle title/headline variants
          title: article.title || article.headline || article.headline_text || article.summary || '',
          // handle link/url variants
          link: article.link || article.url || article.href || article.source_link || article.source || '#',
          // handle publish date variants
          publish_date: article.publish_date || article.date || article.publishedAt || article.pub_date || '',
          provider: article.provider || article.source || article.source_name || '',
          sentiment_score: (article.sentiment_score ?? article.score ?? null)
        }));
        setNews(normalized);
        setSentimentAvg(n.avg_score ?? n.avgScore ?? null);
        if (Array.isArray(normalized) && normalized.length > 0) newsReceived = true;
      } else {
        console.error('News fetch failed', newsRes.reason || newsRes.value);
        setError(prev => prev ? prev + ' | news failed' : 'news failed');
      }

      // top constituents
      if (constRes.status === 'fulfilled' && constRes.value && constRes.value.success) {
        setTopConstituents(constRes.value.top_constituents);
      } else {
        console.error('Top constituent fetch failed', constRes.reason || constRes.value);
      }

      // daily sentiment
      if (dailySentimentRes.status === 'fulfilled' && dailySentimentRes.value) {
        setDailySentiment(dailySentimentRes.value.daily || {});
      } else {
        console.error('Daily sentiment fetch failed', dailySentimentRes.reason || dailySentimentRes.value);
      }

      // significant events portion
      if (analysisRes.status === "fulfilled" && analysisRes.value) {
        // Handle both old format (with success field) and new format (with ticker field)
        const rawEvents = analysisRes.value.events || [];

        // Transform events to match frontend expectations
        const transformedEvents = rawEvents.map(event => {
          const startDate = new Date(event.start_date);
          const endDate = new Date(event.start_date); // Backend only provides start_date
          const movePct = event.total_move_pct * 100; // Convert to percentage

          return {
            ...event,
            trend: movePct >= 0 ? 'Upward' : 'Downward',
            total_move_pct: movePct,
            end_date: event.start_date, // Use start_date as end_date for now
            days: 1 // Default to 1 day since we only have start_date
          };
        });

        setTopEvents(transformedEvents);
        console.log(`Loaded ${transformedEvents.length} significant events for ${newsTicker}`);
      } else {
        console.error("Analysis fetch failed", analysisRes.reason || analysisRes.value);
      }
  

      // If we didn't get news from /api/news, try fallback to /articles (older route)
      // if (!newsReceived) {
      //   console.debug('[PerformanceView] No news from /api/news, trying /articles fallback for', ticker);
      //   const endDate = new Date();
      //   const startDate = new Date();
      //   startDate.setMonth(endDate.getMonth() - 3); // last 3 months
      //   const sd = startDate.toISOString().slice(0, 10);
      //   const ed = endDate.toISOString().slice(0, 10);
      //   fetch(`/articles?ticker=${encodeURIComponent(ticker)}&start_date=${sd}&end_date=${ed}`).then(r => r.json()).then(artRes => {
      //     if (!mounted) return;
      //     if (artRes && artRes.success && Array.isArray(artRes.articles) && artRes.articles.length > 0) {
      //       const normalized = artRes.articles.map(a => ({
      //         title: a.title || a.headline || a.summary || '',
      //         link: a.url || a.link || a.source_link || '#',
      //         publish_date: a.publish_date || a.date || a.publishedAt || '',
      //         provider: a.provider || a.source || '' ,
      //         sentiment_score: (a.sentiment_score ?? a.score ?? null)
      //       }));
      //       setNews(normalized);
      //       console.debug('[PerformanceView] Loaded fallback /articles, count=', normalized.length);
      //     }
      //   }).catch(err => {
      //     console.error('[PerformanceView] Fallback /articles failed', err);
      //   });
      // }

      setLoading(false);
    }).catch(err => {
      console.error('Fetch error', err);
      if (mounted) {
        setError(String(err));
        setLoading(false);
      }
    });

    return () => { mounted = false; };
  }, [timeframe, ticker]);

  // Filter priceData1Y into priceData according to timeframe (same logic as FinancialDashboard)
  useEffect(() => {
    if (!priceData1Y || priceData1Y.length === 0) {
      setPriceData([]);
      return;
    }
    const now = new Date();
    let filtered = priceData1Y;
    if (timeframe === '5D') {
      filtered = priceData1Y.slice(-5);
    } else if (timeframe === '1M') {
      const oneMonthAgo = new Date(now);
      oneMonthAgo.setMonth(now.getMonth() - 1);
      filtered = priceData1Y.filter(pt => new Date(pt.date) >= oneMonthAgo);
    } else if (timeframe === '3M') {
      const threeMonthsAgo = new Date(now);
      threeMonthsAgo.setMonth(now.getMonth() - 3);
      filtered = priceData1Y.filter(pt => new Date(pt.date) >= threeMonthsAgo);
    } else if (timeframe === '6M') {
      const sixMonthsAgo = new Date(now);
      sixMonthsAgo.setMonth(now.getMonth() - 6);
      filtered = priceData1Y.filter(pt => new Date(pt.date) >= sixMonthsAgo);
    } else if (timeframe === 'YTD') {
      const startOfYear = new Date(now.getFullYear(), 0, 1);
      filtered = priceData1Y.filter(pt => new Date(pt.date) >= startOfYear);
    } else {
      filtered = priceData1Y;
    }
    setPriceData(filtered);
  }, [priceData1Y, timeframe]);

  const generateChartData = () => {
    if (!priceData || priceData.length === 0) return [];
    return priceData.map((point, i) => ({
      x: i,
      y: parseFloat(point.close) || parseFloat(point.price) || 0,
      date: point.date,
      time: point.time,
      volume: point.volume || 0
    }));
  };

  const chartData = generateChartData();

  // Calculate price range for chart scaling (same as FinancialDashboard)
  const getPriceRange = () => {
    if (chartData.length === 0) return { min: 0, max: 100 };
    const prices = chartData.map(d => d.y);
    const min = Math.min(...prices);
    const max = Math.max(...prices);
    const padding = (max - min) * 0.1;
    return { min: min - padding, max: max + padding };
  };

  const priceRange = getPriceRange();

  // Chart dimensions (must be defined before timeline generation)
  const chartWidth = dynamicChartWidth;
  const chartHeight = 250;

  const generateTimelinePoints = () => {
    if (chartData.length === 0) return [];
    const step = Math.max(1, Math.floor((chartData.length - 1) / (NUM_X_AXIS_POINTS - 1)));
    const selectedIndices = [];
    for (let i = 0; i < NUM_X_AXIS_POINTS - 1; i++) {
      selectedIndices.push(i * step);
    }
    selectedIndices.push(chartData.length - 1);
    const selectedPoints = selectedIndices.map(index => chartData[index]).filter(Boolean);
    return selectedPoints.map((point, i, arr) => {
      const xPosition = 60 + (i * (chartWidth / Math.max(1, arr.length - 1)));
      let label = '';
      if (point.date) {
        const date = new Date(point.date);
        label = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      } else {
        label = `Point ${i + 1}`;
      }
      return { label, x: xPosition };
    });
  };

  const timelinePoints = generateTimelinePoints();

  // Generate daily sentiment bar chart data
  const generateDailySentimentBars = () => {
    if (!dailySentiment || Object.keys(dailySentiment).length === 0) {
      return [];
    }

    // Sort by date and get last 7 days
    const sortedDates = Object.keys(dailySentiment).sort();
    const last7Days = sortedDates.slice(-7);

    return last7Days.map((date, index) => {
      const dayData = dailySentiment[date];
      const score = dayData.score || 0;
      const count = dayData.count || 0;
      const headlines = dayData.headlines || [];
      const dateObj = new Date(date);
      const label = dateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

      return {
        date: date,
        label: label,
        score: score,
        count: count,
        headlines: headlines,
        index: index
      };
    });
  };

  const dailySentimentBars = generateDailySentimentBars();

  // Compute event marker positions
  const eventMarkers = React.useMemo(() => {
    if (!chartData || chartData.length === 0 || !topEvents || topEvents.length === 0) return [];

    return topEvents.map((event) => {
      const eventDate = new Date(event.start_date);
      // Find the closest price point by date
      const index = chartData.findIndex(pt => new Date(pt.date).toDateString() === eventDate.toDateString());
      if (index === -1) return null;

      const x = 60 + (index * (chartWidth / Math.max(1, chartData.length - 1)));
      const y = (40 + chartHeight) - ((chartData[index].y - priceRange.min) / (priceRange.max - priceRange.min) * chartHeight);

      return {
        x,
        y,
        trend: event.trend,
        pct: event.total_move_pct,
        date: event.start_date,
        news: event.news
      };
    }).filter(Boolean);
  }, [chartData, topEvents, chartWidth, chartHeight, priceRange]);


  // Precompute tooltip positioning and values to avoid inline IIFE in JSX
  const tooltip = (() => {
    if (!hoveredPoint) return null;
    const tooltipWidth = 220;
    const containerLeft = 60; // left padding inside svg where chart starts
    const minLeft = containerLeft;
    const maxLeft = containerLeft + chartWidth - tooltipWidth;
    const rawLeft = hoveredPoint.x - tooltipWidth / 2;
    const left = Math.max(minLeft, Math.min(rawLeft, maxLeft));
    const rawTop = hoveredPoint.y - 100; // position above the point
    const top = Math.max(8, rawTop);
    const idx = hoveredPoint.xIndex;
    const prev = (idx > 0 && chartData[idx - 1]) ? chartData[idx - 1].y : hoveredPoint.price;
    const change = hoveredPoint.price - prev;
    const changePct = prev ? (change / prev) * 100 : 0;
    const dateStr = hoveredPoint.date ? new Date(hoveredPoint.date).toLocaleString() : '';
    return { left, top, change, changePct, dateStr };
  })();

  // Current price info based on chartData
  const currentChartPoint = chartData.length > 0 ? chartData[chartData.length - 1] : null;
  const startChartPoint = chartData.length > 0 ? chartData[0] : null;
  const priceChange = currentChartPoint && startChartPoint ? (currentChartPoint.y - startChartPoint.y) : 0;
  const priceChangePercent = startChartPoint ? ((priceChange / startChartPoint.y) * 100) : 0;

  // derive current price
  const currentPricePoint = priceData1Y && priceData1Y.length ? priceData1Y[priceData1Y.length - 1] : null;
  const currentPrice = currentPricePoint ? (currentPricePoint.close ?? currentPricePoint.price ?? null) : null;

  return (
    <div className="space-y-6 w-full max-w-7xl mx-auto p-4">
      <div className="bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden p-6">
        <button onClick={onBack} className="mb-4 text-sm text-gray-500 hover:text-black">← Back to Sector Selection</button>
        <div>
          <h1 className="text-2xl font-bold text-black">{countryName} - {sectorName}</h1>
          {/* Build a deduplicated subtitle: prefer indexName, ticker (if different), then companyName */}
          {(() => {
            const parts = [];
            if (indexName) parts.push(indexName);
            if (sector?.ticker && sector.ticker !== indexName && sector.ticker !== companyName) parts.push(sector.ticker);
            // if (companyName && companyName !== indexName && companyName !== sector?.ticker) parts.push(companyName);
            if (parts.length === 0) return null;
            return <p className="text-sm text-gray-500 mb-2">{parts.join(' · ')}</p>;
          })()}
          <div className="flex items-end space-x-3">
            <div className="text-3xl font-bold">{currentPrice !== null ? Number(currentPrice).toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2}) : '--'}</div>
            <div className={`text-sm ${priceChange >= 0 ? 'text-green-600' : 'text-red-600'}`}>{currency} · {priceChange >= 0 ? '▲' : '▼'} {priceChange.toFixed(2)} ({priceChangePercent >= 0 ? '+' : ''}{priceChangePercent.toFixed(2)}%)</div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-6">
        <div className="col-span-2 bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden p-6">
          {loading ? (
            <div className="flex items-center justify-center h-40 text-gray-400">
              <div className="text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto mb-2"></div>
                <div>Loading performance data...</div>
              </div>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between mb-4">
      {/* Left side: timeframe buttons */}
      <div className="flex items-center space-x-2">
        {TIMEFRAMES.map(tf => (
          <button
            key={tf}
            onClick={() => setTimeframe(tf)}
            className={`px-2 py-1 text-sm rounded ${
              timeframe === tf
                ? 'bg-blue-500 text-white'
                : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            {tf}
          </button>
        ))}
      </div>

      {/* Right side: sentiment + toggle */}
      <div className="flex items-center space-x-4">
        {/* Sentiment */}
        {sentimentAvg !== null && (
          <div
            className={`text-sm font-medium ${
              sentimentAvg >= 0 ? 'text-green-600' : 'text-red-600'
            }`}
          >
            Avg Sentiment: {Number(sentimentAvg).toFixed(2)}
          </div>
        )}

        {/* Major Events toggle */}
        <div className="flex items-center space-x-2">
          <label
            htmlFor="toggle-events"
            className="text-sm text-gray-600 select-none"
          >
            Major Events
          </label>
          <button
            id="toggle-events"
            onClick={() => setShowEvents(prev => !prev)}
            className={`relative inline-flex h-5 w-10 items-center rounded-full transition-colors duration-200 ${
              showEvents ? 'bg-blue-500' : 'bg-gray-300'
            }`}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform duration-200 ${
                showEvents ? 'translate-x-5' : 'translate-x-1'
              }`}
            />
          </button>
        </div>
      </div>
    </div>


              <div ref={chartContainerRef} className="relative h-96 bg-white border border-gray-200 rounded-lg shadow-md">
                {(!chartData || chartData.length === 0) ? (
                  <div className="flex items-center justify-center h-full text-gray-400">
                    <div className="text-center">No chart data</div>
                  </div>
                ) : (
                  <>
                  <svg className="w-full h-full" style={{ overflow: 'visible' }}>
                    <defs>
                      <linearGradient id="chartGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                        <stop offset="0%" style={{ stopColor: priceChange >= 0 ? '#16a34a' : '#dc2626', stopOpacity: 0.18 }} />
                        <stop offset="100%" style={{ stopColor: priceChange >= 0 ? '#16a34a' : '#dc2626', stopOpacity: 0 }} />
                      </linearGradient>
                    </defs>
                    <g className="text-gray-400 text-xs">
                      {[...Array(6)].map((_, i) => {
                        const yPos = 40 + (i * ((chartHeight) / 5));
                        const price = priceRange.max - ((priceRange.max - priceRange.min) * i / 5);
                        return (
                          <g key={i}>
                            <line
                              x1="60"
                              y1={yPos}
                              x2={60 + chartWidth}
                              y2={yPos}
                              stroke="#e5e7eb"
                              strokeWidth="1"
                            />
                            <text x="50" y={yPos + 5} textAnchor="end" fill="#9ca3af" fontSize="11" fontWeight="bold">
                              {price.toLocaleString(undefined, {maximumFractionDigits: 2})}
                            </text>
                          </g>
                        );
                      })}
                      {timelinePoints.map((point, i) => (
                        <line
                          key={`v-${i}`}
                          x1={point.x}
                          y1="40"
                          x2={point.x}
                          y2={40 + chartHeight}
                          stroke="#e5e7eb"
                          strokeWidth="1"
                        />
                      ))}
                    </g>

                    {/* Area */}
                    {chartData.length > 0 && (
                      <path
                        d={`M 60 ${40 + chartHeight} ${chartData
                          .map((point, i) => {
                            const x = 60 + (i * (chartWidth / Math.max(1, chartData.length - 1)));
                            const y = (40 + chartHeight) - ((point.y - priceRange.min) / (priceRange.max - priceRange.min) * chartHeight);
                            return `L ${x} ${y}`;
                          })
                          .join(' ')} L ${60 + ((chartData.length - 1) * (chartWidth / Math.max(1, chartData.length - 1)))} ${40 + chartHeight} Z`}
                        fill="url(#chartGradient)"
                      />
                    )}

                    {/* Line */}
                    {chartData.length > 0 && (
                      <path
                        d={`M ${60} ${(40 + chartHeight) - ((chartData[0].y - priceRange.min) / (priceRange.max - priceRange.min) * chartHeight)} ${chartData
                          .slice(1)
                          .map((point, i) => {
                            const x = 60 + ((i + 1) * (chartWidth / Math.max(1, chartData.length - 1)));
                            const y = (40 + chartHeight) - ((point.y - priceRange.min) / (priceRange.max - priceRange.min) * chartHeight);
                            return `L ${x} ${y}`;
                          })
                          .join(' ')}`}
                        fill="none"
                        stroke={priceChange >= 0 ? '#16a34a' : '#dc2626'}
                        strokeWidth="3"
                        style={{ filter: 'drop-shadow(0 2px 4px rgba(22,163,74,0.08))' }}
                      />
                    )}

                    {/* Interactive Hover Areas and Points */}
                    {chartData.map((point, i) => {
                      const x = 60 + (i * (chartWidth / Math.max(1, chartData.length - 1)));
                      const y = (40 + chartHeight) - ((point.y - priceRange.min) / (priceRange.max - priceRange.min) * chartHeight);
                      const isHovered = hoveredPoint?.xIndex === i;
                      return (
                        <g key={i}>
                          <rect
                            x={x - 10}
                            y="40"
                            width="20"
                            height="250"
                            fill="transparent"
                            className="cursor-crosshair"
                            onMouseEnter={() => setHoveredPoint({ ...point, x, y, xIndex: i, price: point.y, date: point.date, time: point.time })}
                            onMouseLeave={() => setHoveredPoint(null)}
                          />
                          {isHovered && (
                            <>
                              <circle
                                cx={x}
                                cy={y}
                                r="5"
                                fill={priceChange >= 0 ? '#3b82f6' : '#ef4444'}
                                stroke="white"
                                strokeWidth="2"
                                style={{ filter: 'drop-shadow(0 2px 4px rgba(59,130,246,0.15))' }}
                              />
                              <line
                                x1={x}
                                y1="40"
                                x2={x}
                                y2={40 + chartHeight}
                                stroke={priceChange >= 0 ? '#3b82f6' : '#ef4444'}
                                strokeWidth="1"
                                strokeDasharray="3,3"
                              />
                            </>
                          )}
                        </g>
                      );
                    })}

                    {/* Timeline Circles and Labels */}
                    {timelinePoints.map((point, i) => (
                      <g key={`timeline-${i}`}>
                        <circle
                          cx={point.x}
                          cy="310"
                          r="8"
                          fill="#f9fafb"
                          stroke="#d1d5db"
                          strokeWidth="2"
                        />
                        <circle
                          cx={point.x}
                          cy="310"
                          r="3"
                          fill="#3b82f6"
                        />
                        <text
                          x={point.x}
                          y="330"
                          textAnchor="middle"
                          fill="#374151"
                          fontSize="11"
                          fontWeight="bold"
                        >
                          {point.label}
                        </text>
                      </g>
                    ))}

                    {/* Significant Event Markers */}
                    {showEvents && eventMarkers.map((marker, i) => (
                      <g key={`event-${i}`} className="cursor-pointer group">
                        {/* Marker line */}
                        <line
                          x1={marker.x}
                          y1="40"
                          x2={marker.x}
                          y2={40 + chartHeight}
                          stroke={marker.trend === "UP" ? "#16a34a" : "#dc2626"}
                          strokeWidth="1.5"
                          strokeDasharray="4,2"
                          opacity="0.6"
                        />
                        {/* Small event circle */}
                        <circle
                          cx={marker.x}
                          cy={marker.y}
                          r="5"
                          fill={marker.trend === "UP" ? "#16a34a" : "#dc2626"}
                          stroke="white"
                          strokeWidth="2"
                        />
                        {/* Hover tooltip for event */}
                        <g className="opacity-0 group-hover:opacity-100 transition-opacity">
                          <rect
                            x={marker.x - 70}
                            y={marker.y - 60}
                            width="140"
                            height="48"
                            rx="6"
                            fill="white"
                            stroke="#d1d5db"
                            strokeWidth="1"
                            filter="drop-shadow(0 1px 2px rgba(0,0,0,0.1))"
                          />
                          <text
                            x={marker.x}
                            y={marker.y - 42}
                            textAnchor="middle"
                            fill="#111827"
                            fontSize="11"
                            fontWeight="bold"
                          >
                            {marker.trend} Move ({marker.pct.toFixed(2)}%)
                          </text>
                          <text
                            x={marker.x}
                            y={marker.y - 28}
                            textAnchor="middle"
                            fill="#6b7280"
                            fontSize="10"
                          >
                            {marker.date}
                          </text>
                        </g>
                      </g>
                    ))}

                  </svg>
                  {/* Hover tooltip - positioned absolutely inside the chart container */}
                  {tooltip && (
                    <div style={{ position: 'absolute', left: `${tooltip.left}px`, top: `${tooltip.top}px`, width: `220px`, zIndex: 50 }}>
                      <div className="bg-white border border-gray-200 rounded-lg shadow-lg p-3 text-sm">
                        <div className="flex items-center justify-between mb-2">
                          <div className="font-semibold text-xs text-gray-700">{companyName || determineTicker()}</div>
                          <div className={`text-xs font-bold ${tooltip.change >= 0 ? 'text-green-600' : 'text-red-600'}`}>{tooltip.change >= 0 ? '▲' : '▼'} {tooltip.change.toFixed(2)}</div>
                        </div>
                        <div className="text-xs text-gray-500 mb-1">{tooltip.dateStr}</div>
                        <div className="flex items-baseline justify-between">
                          <div className="text-lg font-bold">{Number(hoveredPoint.price).toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</div>
                          <div className={`text-xs ${tooltip.change >= 0 ? 'text-green-600' : 'text-red-600'}`}>{tooltip.changePct >= 0 ? '+' : ''}{tooltip.changePct.toFixed(2)}%</div>
                        </div>
                        {/* {hoveredPoint.volume !== undefined && (
                          <div className="text-xs text-gray-500 mt-2">Vol: {Number(hoveredPoint.volume).toLocaleString()}</div>
                        )} */}
                      </div>
                    </div>
                  )}
                  </>
                )}
              </div>
            </>
          )}

          {/* Daily Sentiment Bar Chart */}
          <div className="mt-6">
            <h3 className="text-lg font-semibold mb-4">Daily Average Sentiment (Past 7 Days)</h3>
            <div className="relative h-96 bg-white border border-gray-200 rounded-lg shadow-md p-6">
              {dailySentimentBars.length === 0 ? (
                <div className="flex items-center justify-center h-full text-gray-400">
                  <div className="text-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto mb-2"></div>
                    <div>Loading sentiment data...</div>
                  </div>
                </div>
              ) : (
                <>
                  <svg className="w-full h-full">
                    {/* Y-axis label - moved to left side, rotated */}
                    <text
                      x="-180"
                      y="15"
                      fill="#6b7280"
                      fontSize="11"
                      fontWeight="600"
                      transform="rotate(-90)"
                      textAnchor="middle"
                    >
                      Average Sentiment Score
                    </text>

                    {/* Y-axis labels and grid lines */}
                    <g className="text-gray-400 text-xs">
                      {[0.4, 0.2, 0, -0.2, -0.4].map((value, i) => {
                        const yPos = 40 + (i * 65);
                        return (
                          <g key={i}>
                            <line x1="70" y1={yPos} x2="750" y2={yPos} stroke="#e5e7eb" strokeWidth="1" />
                            <text x="60" y={yPos + 4} textAnchor="end" fill="#6b7280" fontSize="12" fontWeight="500">
                              {value.toFixed(1)}
                            </text>
                          </g>
                        );
                      })}
                    </g>

                    {/* Bars with score labels */}
                    {dailySentimentBars.map((bar, i) => {
                      const barWidth = 70;
                      const barSpacing = (680) / dailySentimentBars.length;
                      const x = 70 + (i * barSpacing) + (barSpacing - barWidth) / 2;
                      const zeroY = 170; // Middle of chart (0 value)
                      const scoreHeight = Math.abs(bar.score) * 325; // Scale: 0.4 = 130px
                      const barY = bar.score >= 0 ? zeroY - scoreHeight : zeroY;
                      const barColor = bar.score > 0 ? '#22c55e' : bar.score < 0 ? '#ef4444' : '#9ca3af';

                      return (
                        <g key={i}>
                          {/* Bar */}
                          <rect
                            x={x}
                            y={barY}
                            width={barWidth}
                            height={Math.max(scoreHeight, 3)}
                            fill={barColor}
                            opacity="0.85"
                            rx="3"
                            className="cursor-pointer transition-opacity"
                            style={{ opacity: hoveredBar === i ? 1 : 0.85 }}
                            onMouseEnter={() => setHoveredBar(i)}
                            onMouseLeave={() => setHoveredBar(null)}
                          />
                          {/* Score label above bar */}
                          <text
                            x={x + barWidth / 2}
                            y={bar.score >= 0 ? barY - 8 : barY + scoreHeight + 18}
                            textAnchor="middle"
                            fill="#374151"
                            fontSize="12"
                            fontWeight="600"
                          >
                            {bar.score.toFixed(2)}
                          </text>
                          {/* Date label on X-axis */}
                          <text
                            x={x + barWidth / 2}
                            y="325"
                            textAnchor="middle"
                            fill="#374151"
                            fontSize="12"
                            fontWeight="500"
                          >
                            {bar.label}
                          </text>
                        </g>
                      );
                    })}
                  </svg>

                  {/* Hover Tooltip */}
                  {hoveredBar !== null && dailySentimentBars[hoveredBar] && (
                    <div
                      className="absolute bg-white border-2 border-blue-400 rounded-lg shadow-2xl p-4 z-30 overflow-y-auto"
                      style={{
                        left: `${Math.min(Math.max(70 + (hoveredBar * (680 / dailySentimentBars.length)) + ((680 / dailySentimentBars.length) / 2) - 150, 20), 600)}px`,
                        top: '100px',
                        width: '320px',
                        maxHeight: '400px'
                      }}
                      onMouseEnter={() => setHoveredBar(hoveredBar)}
                      onMouseLeave={() => {
                        setHoveredBar(null);
                        setVisibleHeadlines(5); // Reset when leaving
                      }}
                    >
                      <div className="mb-3 pb-2 border-b border-gray-200">
                        <div className="text-sm font-semibold text-gray-700">{dailySentimentBars[hoveredBar].label}</div>
                        <div className="flex items-center justify-between mt-1">
                          <span className="text-xs text-gray-600">Sentiment Score:</span>
                          <span className={`text-sm font-bold ${dailySentimentBars[hoveredBar].score >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                            {dailySentimentBars[hoveredBar].score.toFixed(3)}
                          </span>
                        </div>
                        <div className="flex items-center justify-between mt-1">
                          <span className="text-xs text-gray-600">Articles Analyzed:</span>
                          <span className="text-sm font-semibold text-blue-600">{dailySentimentBars[hoveredBar].count}</span>
                        </div>
                      </div>

                      {dailySentimentBars[hoveredBar].headlines && dailySentimentBars[hoveredBar].headlines.length > 0 && (
                        <div>
                          <div className="text-xs font-semibold text-gray-700 mb-2">
                            Most Polar Headlines (Top {Math.min(visibleHeadlines, dailySentimentBars[hoveredBar].headlines.length)})
                          </div>
                          <div className="space-y-3">
                            {dailySentimentBars[hoveredBar].headlines.slice(0, visibleHeadlines).map((headline, idx) => (
                              <div key={idx} className="border-l-2 border-blue-300 pl-2 py-1">
                                <a
                                  href={headline.link}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-xs text-gray-800 hover:text-blue-600 hover:underline leading-tight block cursor-pointer transition-colors"
                                  style={{ pointerEvents: 'auto', display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}
                                >
                                  {headline.title}
                                </a>
                                <div className="flex items-center justify-between mt-1">
                                  <span className="text-xs text-gray-500">{headline.provider}</span>
                                  <span className={`text-xs font-semibold ${headline.sentiment_score >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                    {headline.sentiment_score >= 0 ? '+' : ''}{headline.sentiment_score.toFixed(2)}
                                  </span>
                                </div>
                              </div>
                            ))}
                          </div>

                          {/* View More Button */}
                          {visibleHeadlines < dailySentimentBars[hoveredBar].headlines.length && (
                            <button
                              onClick={() => setVisibleHeadlines(prev => prev + 5)}
                              className="mt-3 w-full py-2 px-4 bg-blue-500 hover:bg-blue-600 text-white text-xs font-semibold rounded transition-colors"
                            >
                              View More ({dailySentimentBars[hoveredBar].headlines.length - visibleHeadlines} remaining)
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>

        <div className="col-span-1 space-y-6">
          {/* Significant Events */}
          <div className="bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">Significant Events</h3>
              <span className="text-sm text-gray-500">{sectorName}</span>
            </div>

            {(!topEvents || topEvents.length === 0) ? (
              <div className="text-gray-400 text-sm">No significant events found.</div>
            ) : (
              <div className="space-y-4 max-h-96 overflow-y-auto">
                {topEvents.slice(0, 5).map((event, idx) => (
                  <div key={idx} className="border-b border-gray-100 pb-3">
                    <div className="flex items-center justify-between mb-1">
                      <h4 className="text-sm font-semibold text-gray-800">
                        <span className={`inline-block w-3 h-3 rounded-full mr-2 ${
                          event.trend === 'Upward' ? 'bg-green-500' : 'bg-red-500'
                        }`}></span>
                        {event.trend} Move · {event.total_move_pct.toFixed(2)}%
                      </h4>
                    </div>
                    <p className="text-xs text-gray-500 mb-2">{event.start_date}</p>

                    {event.news && event.news.length > 0 && (
                      <ul className="text-xs text-gray-600 space-y-1">
                        {event.news.slice(0, 2).map((n, i) => (
                          <li key={i} className="pl-2 border-l-2 border-blue-200">
                            <a href={n.link} target="_blank" rel="noopener noreferrer" className="hover:text-blue-600">
                              {n.title}
                            </a>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Related News */}
          <div className="bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">Related News</h3>
              <div className="text-sm text-gray-500">{companyName}</div>
            </div>
            {error && <div className="text-sm text-red-500 mb-2">{error}</div>}
            <div className="space-y-4 max-h-96 overflow-y-auto">
              {(!news || news.length === 0) ? (
                <div className="text-gray-400">No news found for {sectorName} ({determineTicker()})</div>
              ) : (
                news.map((article, index) => (
                  <div key={index} className="border-b border-gray-100 pb-4">
                    <div className="flex items-start justify-between mb-2">
                      <h4 className="text-sm font-medium text-gray-900 leading-5 flex-1">
                        <a href={article.link} target="_blank" rel="noopener noreferrer" className="hover:text-blue-600">
                          {article.title}
                        </a>
                      </h4>
                      {article.sentiment_score !== undefined && article.sentiment_score !== null && (
                        <span className={`ml-2 px-2 py-1 rounded text-xs font-semibold whitespace-nowrap border ${
                          article.sentiment_score > 0 ? 'text-green-600 border-green-600 bg-green-50' :
                          article.sentiment_score < 0 ? 'text-red-600 border-red-600 bg-red-50' :
                          'text-gray-600 border-gray-600 bg-gray-50'
                        }`}>
                          {article.sentiment_score > 0 ? '+' : ''}{Number(article.sentiment_score).toFixed(2)}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-gray-600">{article.publish_date} | {article.provider}</p>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Overall Sentiment Stats */}
          <div className="bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden p-6">
            <h3 className="text-lg font-semibold mb-4">Overall Sentiment</h3>
            <div className="flex items-center space-x-8">
              <div>
                <div className="text-sm text-gray-600">Average Sentiment Score</div>
                <div className={`text-4xl font-bold ${
                  (sentimentAvg || 0) >= 0 ? 'text-green-600' : 'text-red-600'
                }`}>
                  {sentimentAvg !== null ? sentimentAvg.toFixed(2) : '--'}
                </div>
              </div>
              <div>
                <div className="text-sm text-gray-600">News Articles</div>
                <div className="text-lg font-semibold">{news.length}</div>
              </div>
            </div>
          </div>
        </div>
          <div className="col-span-3 bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">Top Constituents</h3>
              <span className="text-sm text-gray-500">{sectorName}</span>
            </div>

            {(!topConstituents || topConstituents.length === 0) ? (
              <div className="text-gray-400 text-sm">No constituent data available.</div>
            ) : (
              <table className="w-full text-sm">
                <thead className="text-gray-500 border-b border-gray-200">
                  <tr>
                    <th className="text-left py-2">Name</th>
                    <th className="text-right py-2">Price</th>
                    <th className="text-right py-2">Market Cap</th>
                    <th className="text-right py-2">% Day</th>
                  </tr>
                </thead>
                <tbody>
                  {topConstituents.map((c, idx) => (
                    <tr key={idx} className="border-b border-gray-50 hover:bg-gray-50">
                      <td className="py-2 font-medium text-gray-900">{c.name || c.symbol}</td>
                      <td className="py-2 text-right">
                        {c.price ? `$${c.price.toLocaleString(undefined, { maximumFractionDigits: 2 })}` : '--'}
                      </td>
                      <td className="py-2 text-right">
                        {c.marketCap ? `$${(c.marketCap / 1e9).toFixed(1)}B` : '--'}
                      </td>
                      <td className={`py-2 text-right ${c.percentChange.toFixed(2) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {c.percentChange.toFixed(2) !== null ? `${c.percentChange.toFixed(2) > 0 ? '+' : ''}${c.percentChange.toFixed(2)}%` : '--'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
      </div>
    </div>
  );
};




const Portfolio = () => {
  const [searchTerm, setSearchTerm] = useState("");
  const navigate = useNavigate();
  const [view, setView] = useState('filter'); // 'filter' | 'performance'
  const [performanceContext, setPerformanceContext] = useState(null);
  const [searchParams] = useSearchParams();



  // Example suggestions
  const suggestions = [
    { symbol: "AAPL", quoteType: "EQUITY", shortname: "Apple Inc." },
    { symbol: "MSFT", quoteType: "EQUITY", shortname: "Microsoft Corp." },
    { symbol: "GOOGL", quoteType: "EQUITY", shortname: "Alphabet Inc." },
  ];

  useEffect(() => {
    const user = searchParams.get("user");
    if (user) {
      sessionStorage.setItem("user", user);
    } else if (!sessionStorage.getItem("user")) {
      navigate("/login");
    }
  }, [navigate, searchParams]);

  const handleLogout = () => {
    const confirmLogout = window.confirm("Are you sure you want to log out?");
    if (confirmLogout) {
      sessionStorage.removeItem("user");
      navigate("/login");
    }
  };



  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-4 py-3">
        <div className="flex items-center justify-between">
          {/* Left: Menu + PORTFOLIO/ENTITY */}
          <div className="flex items-center space-x-4">
            {/* <Menu className="w-6 h-6 text-gray-600" /> */}
            <nav className="flex space-x-8">
              <button className="text-gray-900 font-semibold border-b-2 border-blue-500 pb-2">SECTOR</button>
              <button
                className="text-gray-600 hover:text-gray-900"
                onClick={() => navigate("/financial_dashboard")}
              >
                ENTITY
              </button>
            </nav>
          </div>

          {/* Middle: Search bar
          <div className="flex-1 max-w-md mx-8 relative">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search sector, country, entity, and more"
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              ></input>
              {searchTerm.length > 1 && suggestions?.length > 0 && (
                <div className="absolute left-0 top-full w-full bg-white border border-gray-200 rounded-md shadow-lg mt-1 z-30 max-h-96 overflow-y-auto">
                  {Array.from(
                    new Map(
                      suggestions
                        .filter((q) => q.quoteType === "EQUITY")
                        .map((q) => [q.symbol, q])
                    ).values()
                  ).map((q, idx) => (
                    <div
                      key={q.symbol + "-" + idx}
                      className="px-4 py-3 cursor-pointer hover:bg-gray-100"
                    >
                      <p className="font-bold text-sm">{q.symbol}</p>
                      <p className="text-xs text-gray-600 truncate">{q.shortname || q.longname}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div> */}

          {/* Right: Icons */}
          <div className="flex items-center space-x-4">
            <Bell className="w-6 h-6 text-gray-600" />
            <User className="w-6 h-6 text-gray-600" />
            <button
              onClick={handleLogout}
            >
              <LogOut className="w-6 h-6 text-gray-600 hover:text-gray-600 transition" />
            </button>
          </div>
        </div>
      </header>

      {/* Main content placeholder */}
      <main className="p-4">
        {view === 'filter' && (
          <>
            {/* Bloomberg-style selector below */}
            <BloombergSelector onSectorSelect={(ctx) => { setPerformanceContext(ctx); setView('performance'); }} />
          </>
        )}

        {view === 'performance' && (
          <PerformanceView
            context={performanceContext}
            onBack={() => setView('filter')}
          />
        )}
      </main>
    </div>
  );
};

export default Portfolio;
