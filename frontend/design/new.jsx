import React, { useState, useEffect, useCallback, useRef } from 'react';
import Chart from 'chart.js/auto';

// Note: The 'chartjs-plugin-annotation' is not available in this environment via direct import.
// The feature to draw a "Previous Close" line has been removed to ensure the app compiles correctly.

// --- Configuration Data ---
const config = {
    industryData: { 'US': [ { name: 'All Sectors', index: 'S&P 500', ticker: '^GSPC', available: true }, { name: 'Communication Services', index: 'S&P 500 Communication Services', ticker: '^SP500-50', available: true }, { name: 'Consumer Discretionary', index: 'S&P 500 Consumer Discretionary', ticker: '^SP500-25', available: true }, { name: 'Consumer Staples', index: 'S&P 500 Consumer Staples', ticker: '^SP500-30', available: true }, { name: 'Energy', index: 'S&P 500 Energy', ticker: '^SP500-10', available: true }, { name: 'Financials', index: 'S&P 500 Financials', ticker: '^SP500-40', available: true }, { name: 'Health Care', index: 'S&P 500 Health Care', ticker: '^SP500-35', available: true }, { name: 'Industrials', index: 'S&P 500 Industrials', ticker: '^SP500-20', available: true }, { name: 'Information Technology', index: 'S&P 500 Information Technology', ticker: '^SP500-45', available: true }, { name: 'Materials', index: 'S&P 500 Materials', ticker: '^SP500-15', available: true }, { name: 'Real Estate', index: 'S&P 500 Real Estate', ticker: '^SP500-60', available: true }, { name: 'Utilities', index: 'S&P 500 Utilities', ticker: '^SP500-55', available: true } ], 'CHN': [ { name: 'All Sectors', index: 'CSI 300', ticker: '000300.SS', available: true }, { name: 'Energy', index: 'CSI 300 Energy', ticker: '000908.SH', available: false }, { name: 'Materials', index: 'CSI 300 Materials', ticker: '000909.SH', available: false }, { name: 'Industrials', index: 'CSI 300 Industrials', ticker: '000910.SH', available: false }, { name: 'Consumer Discretionary', index: 'CSI 300 Consumer Discretionary', ticker: '000911.SH', available: false }, { name: 'Consumer Staples', index: 'CSI 300 Consumer Staples', ticker: '000912.SH', available: false }, { name: 'Health Care', index: 'CSI 300 Health Care', ticker: '000913.SH', available: false }, { name: 'Financials', index: 'CSI 300 Financials', ticker: '000914.SH', available: false }, { name: 'Information Technology', index: 'CSI 300 Information Technology', ticker: '000915.SH', available: false }, { name: 'Telecommunication', index: 'CSI 300 Telecommunication', ticker: '000916.SH', available: false }, { name: 'Utilities', index: 'CSI 300 Utilities', ticker: '000917.SH', available: false } ], 'JPN': [ { name: 'All Sectors', index: 'Nikkei 225', ticker: '^N225', available: true }, { name: 'Foods', index: 'TOPIX-17 Foods', ticker: '.IFD.T', available: false }, { name: 'Fishery, Agriculture & Forestry', index: 'TOPIX-17 Fishery', ticker: '.IAF.T', available: false }, { name: 'Mining', index: 'TOPIX-17 Mining', ticker: '.IMN.T', available: false }, { name: 'Construction', index: 'TOPIX-17 Construction', ticker: '.ICN.T', available: false }, { name: 'Textiles & Apparels', index: 'TOPIX-17 Textiles', ticker: '.ITX.T', available: false }, { name: 'Pulp & Paper', index: 'TOPIX-17 Pulp & Paper', ticker: '.IPP.T', available: false }, { name: 'Chemicals', index: 'TOPIX-17 Chemicals', ticker: '.ICH.T', available: false }, { name: 'Pharmaceutical', index: 'TOPIX-17 Pharmaceutical', ticker: '.IPH.T', available: false }, { name: 'Oil & Coal Products', index: 'TOPIX-17 Oil & Coal', ticker: '.IOC.T', available: false }, { name: 'Rubber Products', index: 'TOPIX-17 Rubber', ticker: '.IRB.T', available: false }, { name: 'Glass & Ceramics Products', index: 'TOPIX-17 Glass & Ceramics', ticker: '.IGL.T', available: false }, { name: 'Iron & Steel', index: 'TOPIX-17 Iron & Steel', ticker: '.IST.T', available: false }, { name: 'Nonferrous Metals', index: 'TOPIX-17 Nonferrous Metals', ticker: '.INF.T', available: false }, { name: 'Metal Products', index: 'TOPIX-17 Metal Products', ticker: '.IMT.T', available: false }, { name: 'Machinery', index: 'TOPIX-17 Machinery', ticker: '.IMH.T', available: false }, { name: 'Electric Appliances', index: 'TOPIX-17 Electric Appliances', ticker: '.IEA.T', available: false }, { name: 'Transportation Equipment', index: 'TOPIX-17 Transportation Equipment', ticker: '.ITE.T', available: false }, { name: 'Precision Instruments', index: 'TOPIX-17 Precision Instruments', ticker: '.IPR.T', available: false }, { name: 'Other Products', index: 'TOPIX-17 Other Products', ticker: '.IOP.T', available: false }, { name: 'Electric Power & Gas', index: 'TOPIX-17 Electric Power & Gas', ticker: '.IEG.T', available: false }, { name: 'Land Transportation', index: 'TOPIX-17 Land Transportation', ticker: '.ILT.T', available: false }, { name: 'Marine Transportation', index: 'TOPIX-17 Marine Transportation', ticker: '.IMR.T', available: false }, { name: 'Air Transportation', index: 'TOPIX-17 Air Transportation', ticker: '.IAT.T', available: false }, { name: 'Warehousing', index: 'TOPIX-17 Warehousing', ticker: '.IWH.T', available: false }, { name: 'Information & Communication', index: 'TOPIX-17 Info & Comm', ticker: '.IIC.T', available: false }, { name: 'Wholesale Trade', index: 'TOPIX-17 Wholesale Trade', ticker: '.IWS.T', available: false }, { name: 'Retail Trade', index: 'TOPIX-17 Retail Trade', ticker: '.IRT.T', available: false }, { name: 'Banks', index: 'TOPIX-17 Banks', ticker: '.IBK.T', available: false }, { name: 'Securities', index: 'TOPIX-17 Securities', ticker: '.ISC.T', available: false }, { name: 'Insurance', index: 'TOPIX-17 Insurance', ticker: '.IIN.T', available: false }, { name: 'Other Financing Business', index: 'TOPIX-17 Other Financing', ticker: '.IOF.T', available: false }, { name: 'Real Estate', index: 'TOPIX-17 Real Estate', ticker: '.IRE.T', available: false }, { name: 'Services', index: 'TOPIX-17 Services', ticker: '.ISV.T', available: false } ], 'HKG': [ { name: 'All Sectors', index: 'HANG SENG INDEX', ticker: '^HSI', available: true }, { name: 'Finance', index: 'Hang Seng Finance', ticker: '^HSNF', available: false }, { name: 'Utilities', index: 'Hang Seng Utilities', ticker: '^HSNU', available: false }, { name: 'Properties', index: 'Hang Seng Properties', ticker: '^HSNP', available: false }, { name: 'Commerce & Industry', index: 'Hang Seng Commerce & Industry', ticker: '^HSCI', available: false } ], 'IND': [ { name: 'All Sectors', index: 'NIFTY 50', ticker: '^NSEI', available: true }, { name: 'Auto', index: 'Nifty Auto', ticker: '^CNXAUTO', available: false }, { name: 'Bank', index: 'Nifty Bank', ticker: '^NSEBANK', available: false }, { name: 'Energy', index: 'Nifty Energy', ticker: '^CNXENERGY', available: false }, { name: 'Financial Services', index: 'Nifty Financial Services', ticker: '^CNXFIN', available: false }, { name: 'FMCG', index: 'Nifty FMCG', ticker: '^CNXFMCG', available: false }, { name: 'IT', index: 'Nifty IT', ticker: '^CNXIT', available: false }, { name: 'Media', index: 'Nifty Media', ticker: '^CNXMEDIA', available: false }, { name: 'Metal', index: 'Nifty Metal', ticker: '^CNXMETAL', available: false }, { name: 'Pharma', index: 'Nifty Pharma', ticker: '^CNXPHARMA', available: false }, { name: 'Realty', index: 'Nifty Realty', ticker: '^CNXREALTY', available: false } ], 'FRA': [ { name: 'All Sectors', index: 'CAC 40', ticker: '^FCHI', available: true }, { name: 'Financials', index: 'CAC Financials', ticker: '^PAX', available: false }, { name: 'Industrials', index: 'CAC Industrials', ticker: '^PCIN', available: false }, { name: 'Consumer Services', index: 'CAC Consumer Services', ticker: '^PCCS', available: false }, { name: 'Health Care', index: 'CAC Health Care', ticker: '^PCHC', available: false } ], 'GBR': [ { name: 'All Sectors', index: 'FTSE 100', ticker: '^FTSE', available: true }, { name: 'Automobiles & Parts', index: 'FTSE 350 Automobiles & Parts', ticker: '^FTNMX401010', available: false }, { name: 'Banks', index: 'FTSE 350 Banks', ticker: '^FTNMX301010', available: false }, { name: 'Basic Resources', index: 'FTSE 350 Basic Resources', ticker: '^FTNMX551010', available: false }, { name: 'Chemicals', index: 'FTSE 350 Chemicals', ticker: '^FTNMX552010', available: false }, { name: 'Construction & Materials', index: 'FTSE 350 Construction & Materials', ticker: '^FTNMX501010', available: false }, { name: 'Financial Services', index: 'FTSE 350 Financial Services', ticker: '^FTNMX302010', available: false }, { name: 'Food & Beverage', index: 'FTSE 350 Food & Beverage', ticker: '^FTNMX452010', available: false }, { name: 'Health Care', index: 'FTSE 350 Health Care', ticker: '^FTNMX201010', available: false }, { name: 'Industrial Goods & Services', index: 'FTSE 350 Industrial Goods & Services', ticker: '^FTNMX502010', available: false }, { name: 'Insurance', index: 'FTSE 350 Insurance', ticker: '^FTNMX303010', available: false }, { name: 'Media', index: 'FTSE 350 Media', ticker: '^FTNMX403010', available: false }, { name: 'Oil & Gas', index: 'FTSE 350 Oil & Gas', ticker: '^FTNMX601010', available: false }, { name: 'Personal & Household Goods', index: 'FTSE 350 Personal & Household Goods', ticker: '^FTNMX452020', available: false }, { name: 'Real Estate', index: 'FTSE 350 Real Estate', ticker: '^FTNMX351010', available: false }, { name: 'Retail', index: 'FTSE 350 Retail', ticker: '^FTNMX404010', available: false }, { name: 'Technology', index: 'FTSE 350 Technology', ticker: '^FTNMX202010', available: false }, { name: 'Telecommunications', index: 'FTSE 350 Telecommunications', ticker: '^FTNMX101010', available: false }, { name: 'Travel & Leisure', index: 'FTSE 350 Travel & Leisure', ticker: '^FTNMX405010', available: false }, { name: 'Utilities', index: 'FTSE 350 Utilities', ticker: '^FTNMX651010', available: false } ], 'CAN': [ { name: 'All Sectors', index: 'S&P/TSX Composite', ticker: '^GSPTSE', available: true }, { name: 'Communication Services', index: 'S&P/TSX Capped Communication Services', ticker: '^TTCM', available: false }, { name: 'Consumer Discretionary', index: 'S&P/TSX Capped Consumer Discretionary', ticker: '^TTCD', available: false }, { name: 'Consumer Staples', index: 'S&P/TSX Capped Consumer Staples', ticker: '^TTCS', available: false }, { name: 'Energy', index: 'S&P/TSX Capped Energy', ticker: '^TTEN', available: false }, { name: 'Financials', index: 'S&P/TSX Capped Financials', ticker: '^TTFS', available: false }, { name: 'Health Care', index: 'S&P/TSX Capped Health Care', ticker: '^TTHC', available: false }, { name: 'Industrials', index: 'S&P/TSX Capped Industrials', ticker: '^TTIN', available: false }, { name: 'Information Technology', index: 'S&P/TSX Capped Information Technology', ticker: '^TTTK', available: false }, { name: 'Materials', index: 'S&P/TSX Capped Materials', ticker: '^TTMT', available: false }, { name: 'Real Estate', index: 'S&P/TSX Capped Real Estate', ticker: '^TTRE', available: false }, { name: 'Utilities', index: 'S&P/TSX Capped Utilities', ticker: '^TTUT', available: false } ], 'DEU': [ { name: 'All Sectors', index: 'DAX PERFORMANCE-INDEX', ticker: '^GDAXI', available: true }, { name: 'Automobile', index: 'DAXsector All Automobile', ticker: '^D1A0', available: false }, { name: 'Banks', index: 'DAXsector All Banks', ticker: '^D1B0', available: false }, { name: 'Basic Resources', index: 'DAXsector All Basic Resources', ticker: '^D1C0', available: false }, { name: 'Chemicals', index: 'DAXsector All Chemicals', ticker: '^D1D0', available: false }, { name: 'Construction', index: 'DAXsector All Construction', ticker: '^D1E0', available: false }, { name: 'Financial Services', index: 'DAXsector All Financial Services', ticker: '^D1F0', available: false }, { name: 'Food & Beverage', index: 'DAXsector All Food & Beverage', ticker: '^D1G0', available: false }, { name: 'Health Care', index: 'DAXsector All Health Care', ticker: '^D1H0', available: false }, { name: 'Industrial', index: 'DAXsector All Industrial', ticker: '^D1I0', available: false }, { name: 'Insurance', index: 'DAXsector All Insurance', ticker: '^D1K0', available: false }, { name: 'Media', index: 'DAXsector All Media', ticker: '^D1L0', available: false }, { name: 'Oil & Gas', index: 'DAXsector All Oil & Gas', ticker: '^D1M0', available: false }, { name: 'Real Estate', index: 'DAXsector All Real Estate', ticker: '^D1N0', available: false }, { name: 'Retail', index: 'DAXsector All Retail', ticker: '^D1P0', available: false }, { name: 'Technology', index: 'DAXsector All Technology', ticker: '^D1R0', available: false }, { name: 'Telecommunication', index: 'DAXsector All Telecommunication', ticker: '^D1S0', available: false }, { name: 'Travel & Leisure', index: 'DAXsector All Travel & Leisure', ticker: '^D1T0', available: false }, { name: 'Utilities', index: 'DAXsector All Utilities', ticker: '^D1U0', available: false } ], 'SAU': [ { name: 'All Sectors', index: 'Tadawul All Share', ticker: '^TASI.SR', available: true }, { name: 'Energy', index: 'Tadawul Energy', ticker: 'TASI10.SR', available: false }, { name: 'Materials', index: 'Tadawul Materials', ticker: 'TASI20.SR', available: false }, { name: 'Financials', index: 'Tadawul Financials', ticker: 'TASI40.SR', available: false } ] },
    topTickersData: { 'US': { 'All Sectors': ['MSFT', 'AAPL', 'NVDA', 'GOOGL', 'AMZN', 'META', 'BRK-B', 'LLY', 'AVGO', 'JPM'], 'Information Technology': ['MSFT', 'AAPL', 'NVDA', 'AVGO', 'ORCL', 'ADBE', 'CRM', 'AMD', 'QCOM', 'INTC'], 'Health Care': ['LLY', 'UNH', 'JNJ', 'MRK', 'ABBV', 'TMO', 'PFE', 'DHR', 'ABT', 'GILD'], 'Financials': ['BRK-B', 'JPM', 'V', 'MA', 'BAC', 'WFC', 'MS', 'GS', 'BLK', 'C'], 'Communication Services': ['META', 'GOOGL', 'NFLX', 'TMUS', 'CMCSA', 'VZ', 'DIS', 'T', 'CHTR', 'WBD'], 'Consumer Discretionary': ['AMZN', 'TSLA', 'HD', 'MCD', 'NKE', 'LOW', 'SBUX', 'BKNG', 'TJX', 'CMG'], 'Industrials': ['CAT', 'GE', 'UNP', 'BA', 'HON', 'DE', 'RTX', 'LMT', 'UPS', 'WM'], 'Consumer Staples': ['PG', 'COST', 'WMT', 'KO', 'PEP', 'PM', 'MO', 'MDLZ', 'CL', 'TGT'], 'Energy': ['XOM', 'CVX', 'SHEL', 'COP', 'TTE', 'SLB', 'EOG', 'PXD', 'MPC', 'OXY'], 'Materials': ['LIN', 'APD', 'SHW', 'FCX', 'ECL', 'NEM', 'DOW', 'CTVA', 'PPG', 'VMC'], 'Real Estate': ['PLD', 'AMT', 'EQIX', 'CCI', 'O', 'SPG', 'PSA', 'DLR', 'WELL', 'CPT'], 'Utilities': ['NEE', 'SO', 'DUK', 'D', 'AEP', 'EXC', 'SRE', 'PEG', 'XEL', 'ETR'] }, 'CAN': { 'All Sectors': ['SHOP.TO', 'RY.TO', 'TD.TO', 'ENB.TO', 'CNR.TO', 'CP.TO', 'TRI.TO', 'BNS.TO', 'SU.TO', 'BAM.TO'], }, 'GBR': { 'All Sectors': ['SHEL.L', 'AZN.L', 'HSBA.L', 'ULVR.L', 'DGE.L', 'RIO.L', 'BP.L', 'BATS.L', 'GLEN.L', 'REL.L'], }, 'DEU': { 'All Sectors': ['SAP.DE', 'SIE.DE', 'DTE.DE', 'AIR.DE', 'ALV.DE', 'MBG.DE', 'IFX.DE', 'BMW.DE', 'VOW3.DE', 'ADS.DE'], }, 'FRA': { 'All Sectors': ['MC.PA', 'TTE.PA', 'OR.PA', 'RMS.PA', 'AIR.PA', 'SNY.PA', 'SAF.PA', 'KER.PA', 'BNP.PA', 'EL.PA'], }, 'JPN': { 'All Sectors': ['8035.T', '9984.T', '6861.T', '6758.T', '9433.T', '4063.T', '7203.T', '6501.T', '8306.T', '6954.T'], }, 'CHN': { 'All Sectors': ['600519.SS', '300750.SZ', '601398.SS', '600036.SS', '601939.SS', '601857.SS', '000858.SZ', '000333.SZ', '600900.SS', '601288.SS'], }, 'HKG': { 'All Sectors': ['0700.HK', '9988.HK', '0005.HK', '1299.HK', '0941.HK', '0388.HK', '3690.HK', '2318.HK', '0016.HK', '0939.HK'], }, 'IND': { 'All Sectors': ['RELIANCE.NS', 'HDFCBANK.NS', 'ICICIBANK.NS', 'INFY.NS', 'TCS.NS', 'BHARTIARTL.NS', 'ITC.NS', 'HINDUNILVR.NS', 'LT.NS', 'SBIN.NS'], }, 'SAU': { 'All Sectors': ['2222.SR', '1120.SR', '7010.SR', '1180.SR', '1150.SR', '1211.SR', '4001.SR', '7020.SR', '1010.SR', '2240.SR'], }, }
};
const countryRegions = {
    Americas: [{ code: 'US', name: 'United States' }, { code: 'CAN', name: 'Canada' }],
    EMEA: [{ code: 'GBR', name: 'United Kingdom' }, { code: 'DEU', name: 'Germany' }, { code: 'FRA', name: 'France' }, { code: 'SAU', name: 'Saudi Arabia' }],
    APAC: [{ code: 'CHN', name: 'China' }, { code: 'JPN', name: 'Japan' }, { code: 'IND', name: 'India' }, { code: 'HKG', name: 'Hong Kong SAR' }]
};

// --- Helper Components & Functions ---
const SkeletonLoader = ({ className }) => <div className={`animate-pulse bg-gray-200 rounded ${className}`}></div>;

const Spinner = () => (
    <div className="absolute inset-0 flex items-center justify-center bg-white bg-opacity-75 z-20">
        <div style={{ border: '4px solid rgba(0, 0, 0, 0.1)', width: '36px', height: '36px', borderRadius: '50%', borderLeftColor: '#09f', animation: 'spin 1s ease infinite' }}></div>
        <style>{`@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}</style>
    </div>
);

const ErrorMessage = ({ message }) => ( <div className="absolute inset-0 flex items-center justify-center p-4"><p className="text-red-500 text-center">{message}</p></div>);

const fetchWithRetry = async (url, options = {}, retries = 3, backoff = 300) => {
    for (let i = 0; i < retries; i++) {
        try {
            const response = await fetch(url, options);
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            return response;
        } catch (err) {
            console.warn(`Attempt ${i + 1} failed for ${url}. Retrying in ${backoff}ms...`);
            if (i === retries - 1) throw err;
            await new Promise(res => setTimeout(res, backoff));
            backoff *= 2;
        }
    }
};

const getStartDateForRange = (range) => {
    const now = new Date();
    switch (range) {
        case '1D': return new Date(now.setDate(now.getDate() - 1));
        case '5D': return new Date(now.setDate(now.getDate() - 5));
        case '3M': return new Date(now.setMonth(now.getMonth() - 3));
        case '6M': return new Date(now.setMonth(now.getMonth() - 6));
        case 'YTD': return new Date(now.getFullYear(), 0, 1);
        case '1Y': return new Date(now.setFullYear(now.getFullYear() - 1));
        default: return new Date(now.setFullYear(now.getFullYear() - 1));
    }
};

// --- Reusable UI Components ---

const CountryRegion = ({ name, countries, selectedCountry, onCountrySelect, isInitiallyOpen }) => {
    const [isOpen, setIsOpen] = useState(isInitiallyOpen);
    return (
        <div>
            <div className="flex justify-between items-center cursor-pointer p-2 rounded-md hover:bg-gray-50" onClick={() => setIsOpen(!isOpen)}>
                <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider">{name}</h2>
                <svg className={`w-5 h-5 text-gray-500 transition-transform transform ${isOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
            </div>
            {isOpen && (
                <div className="pl-2 pt-1 space-y-1">
                    {countries.map(country => (
                        <div key={country.code} onClick={() => onCountrySelect(country)} className={`cursor-pointer p-3 rounded-md transition-colors ${selectedCountry?.code === country.code ? 'bg-gray-200' : 'hover:bg-gray-100'}`}>
                            <span className="text-lg text-gray-800">{country.name}</span>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

const SectorList = ({ country, onSectorSelect }) => {
    if (!country) return <div className="flex items-center justify-center h-full text-gray-400"><p>Select a country to view its sectors.</p></div>;
    const sectors = (config.industryData[country.code] || []).sort((a, b) => (a.name === 'All Sectors') ? -1 : (b.name === 'All Sectors') ? 1 : a.name.localeCompare(b.name));
    return (
        <div className="space-y-1 p-6">
            {sectors.length > 0 ? sectors.map(sector => (
                <div key={sector.ticker || sector.index} onClick={() => sector.available && onSectorSelect(sector)} className={sector.available ? 'cursor-pointer p-3 rounded-md hover:bg-gray-100 transition-colors' : 'p-3 rounded-md text-gray-400 cursor-not-allowed'}>
                    <div className="pointer-events-none"><span className="text-lg">{sector.name}</span><p className="text-sm text-gray-600">{sector.index}</p></div>
                </div>
            )) : <p>No sectors found for {country.name}.</p>}
        </div>
    );
};

const PerformanceChart = ({ chartData, timeRange }) => {
    const chartRef = useRef(null);
    const chartInstanceRef = useRef(null);
    useEffect(() => {
        if (!chartData || !chartRef.current) return;
        if (chartInstanceRef.current) chartInstanceRef.current.destroy();
        const { timestamps, closePrices, previousClose, meta, currency } = chartData;
        const timezone = meta.exchangeTimezoneName || 'UTC';
        let labels;
        if (timeRange === '1D') labels = timestamps.map(ts => new Date(ts * 1000).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: timezone }));
        else labels = timestamps.map(ts => new Date(ts * 1000).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: '2-digit', timeZone: timezone }));
        
        const isPositiveChange = chartData.lastClosePrice >= chartData.previousClose;
        const chartColor = isPositiveChange ? '#16a34a' : '#dc2626';
        const ctx = chartRef.current.getContext('2d');
        const gradient = ctx.createLinearGradient(0, 0, 0, 400);
        gradient.addColorStop(0, isPositiveChange ? 'rgba(22, 163, 74, 0.2)' : 'rgba(220, 38, 38, 0.2)');
        gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');

        const options = {
            responsive: true, maintainAspectRatio: false, interaction: { mode: 'index', intersect: false },
            scales: { x: { grid: { display: false } }, y: { grid: { color: '#e5e7eb' } } },
            plugins: { legend: { display: false }, tooltip: { enabled: true, backgroundColor: '#fff', titleColor: '#000', bodyColor: '#000', borderColor: '#e5e7eb', borderWidth: 1, padding: 10, displayColors: false, callbacks: { title: items => `${items[0].parsed.y.toLocaleString('en-US', { minimumFractionDigits: 2 })} ${currency}`, label: ctx => new Date(timestamps[ctx.dataIndex] * 1000).toLocaleString('en-US', { timeZone: timezone, dateStyle: 'medium', timeStyle: 'short' }) } } }
        };

        chartInstanceRef.current = new Chart(ctx, { type: 'line', data: { labels, datasets: [{ data: closePrices, borderColor: chartColor, backgroundColor: gradient, borderWidth: 2, pointRadius: 0, tension: 0.1, fill: true }] }, options });
        return () => { if (chartInstanceRef.current) chartInstanceRef.current.destroy(); };
    }, [chartData, timeRange]);
    return <canvas ref={chartRef}></canvas>;
};

const HeadlinesGrid = ({ items, title, loading, error, filterComponents, onGenerateTakeaways, takeaways, takeawaysLoading, takeawaysError }) => {
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 10;

    useEffect(() => {
        setCurrentPage(1);
    }, [items]);

    const indexOfLastItem = currentPage * itemsPerPage;
    const indexOfFirstItem = indexOfLastItem - itemsPerPage;
    const currentItems = items.slice(indexOfFirstItem, indexOfLastItem);

    const totalPages = Math.ceil(items.length / itemsPerPage);

    const handlePrevPage = () => setCurrentPage(prev => Math.max(prev - 1, 1));
    const handleNextPage = () => setCurrentPage(prev => Math.min(prev + 1, totalPages));

    const sentimentColor = (sentiment) => {
        switch (sentiment) {
            case 'Positive': return 'text-green-500';
            case 'Negative': return 'text-red-500';
            default: return 'text-gray-400';
        }
    };

    return (
        <div className="bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden p-6">
            <div className="flex justify-between items-center mb-4">
                <h2 className="text-lg font-bold text-black">{title}</h2>
                 <div className="flex items-center space-x-2">
                    {items && items.length > itemsPerPage && (
                         <div className="flex items-center space-x-2">
                            <button onClick={handlePrevPage} disabled={currentPage === 1} className="bg-gray-200 hover:bg-gray-300 rounded-full p-2 transition disabled:opacity-50">
                                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" /></svg>
                            </button>
                            <span className="text-sm font-medium text-gray-700">Page {currentPage} of {totalPages}</span>
                            <button onClick={handleNextPage} disabled={currentPage === totalPages || totalPages === 0} className="bg-gray-200 hover:bg-gray-300 rounded-full p-2 transition disabled:opacity-50">
                                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" /></svg>
                            </button>
                        </div>
                    )}
                </div>
            </div>
            
            {filterComponents}

            <div className="relative min-h-[500px]">
                {loading && <Spinner />}
                {error && <ErrorMessage message={error} />}
                {!loading && !error && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {currentItems && currentItems.length > 0 ? currentItems.map((item, index) => (
                           <a key={item.link + index} href={item.link} target="_blank" rel="noopener noreferrer" className="block border border-gray-200 rounded-lg p-6 bg-white hover:bg-gray-50 hover:shadow-lg transition-all duration-200 h-full flex flex-col justify-between">
                                <div>
                                    <div className="flex items-center mb-2">
                                        <span className={`mr-2 text-xl ${sentimentColor(item.sentiment)}`}>●</span>
                                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${item.type === 'News' ? 'bg-blue-100 text-blue-800' : 'bg-purple-100 text-purple-800'}`}>{item.type}</span>
                                    </div>
                                    <h3 className="font-semibold text-gray-900 mb-2 leading-tight">{item.title}</h3>
                                    <p className="text-xs text-gray-500 mb-4">By {item.source} &bull; {item.date}</p>
                                </div>
                                <div className="mt-4 flex flex-wrap gap-2 pt-4 border-t border-gray-100">{item.relatedTickers?.map(t => <span key={t} className="bg-gray-200 text-gray-700 text-xs font-semibold mr-2 px-2.5 py-0.5 rounded-full">{t}</span>)}</div>
                            </a>
                        )) : <p className="text-sm text-gray-500 px-2 col-span-2">No headlines available.</p>}
                    </div>
                )}
            </div>
            
             <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg mt-6">
                 <div className="flex justify-between items-center mb-2">
                    <h3 className="text-md font-semibold text-black">✨ AI Key Takeaways</h3>
                    <button onClick={onGenerateTakeaways} disabled={takeawaysLoading || !items || items.length === 0} className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-lg transition-colors disabled:bg-blue-300 text-sm">
                        {takeawaysLoading ? 'Analyzing...' : 'Generate'}
                    </button>
                </div>
                 <div className="relative min-h-[50px]">
                    {takeawaysLoading && <Spinner />}
                    {takeawaysError && <ErrorMessage message={takeawaysError} />}
                    {takeaways ? <div className="text-gray-800 prose-sm" dangerouslySetInnerHTML={{ __html: takeaways.replace(/\n/g, '<br />') }} /> : <p className="text-gray-500 text-sm">Click "Generate" to summarize key themes from all headlines.</p>}
                </div>
            </div>
        </div>
    );
};

const ConstituentFilter = ({ constituents, onFilterChange, currentFilter }) => {
    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = useRef(null);
    const selectedConstituent = constituents.find(c => c.symbol === currentFilter);

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target)) setIsOpen(false);
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);
    
    if (!constituents || constituents.length === 0) return null;

    return (
        <div className="relative inline-block text-left" ref={dropdownRef}>
            <button type="button" onClick={() => setIsOpen(!isOpen)} className="inline-flex justify-center w-full rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-sm font-medium text-gray-700 hover:bg-gray-50">
                <span className="truncate pr-2">{selectedConstituent ? `${selectedConstituent.name} (${selectedConstituent.symbol})` : 'All Companies'}</span>
                <svg className="-mr-1 ml-2 h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" /></svg>
            </button>
            {isOpen && (
                <div className="origin-top-left absolute left-0 mt-2 w-72 rounded-md shadow-lg bg-white ring-1 ring-black ring-opacity-5 z-20">
                    <div className="py-1 max-h-60 overflow-y-auto">
                        <a href="#" onClick={(e) => { e.preventDefault(); onFilterChange('All'); setIsOpen(false); }} className="text-gray-700 block px-4 py-2 text-sm hover:bg-gray-100">All Companies</a>
                        {constituents.map(c => (
                            <a key={c.symbol} href="#" onClick={(e) => { e.preventDefault(); onFilterChange(c.symbol); setIsOpen(false); }} className="text-gray-700 block px-4 py-2 text-sm hover:bg-gray-100 truncate" title={`${c.name} (${c.symbol})`}>{c.name} ({c.symbol})</a>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};

const HeadlineTypeFilter = ({ currentFilter, onFilterChange }) => {
    const filterTypes = ['All', 'News', 'Press Release'];
    return (
        <div className="flex items-center space-x-1 bg-gray-100 rounded-md p-1">
            {filterTypes.map(type => (
                <button
                    key={type}
                    onClick={() => onFilterChange(type)}
                    className={`px-3 py-1 text-sm font-semibold rounded-md transition-colors ${
                        currentFilter === type
                            ? 'bg-white shadow-sm text-gray-900'
                            : 'bg-transparent text-gray-600 hover:bg-gray-200'
                    }`}
                >
                    {type === 'All' ? 'All Types' : type}
                </button>
            ))}
        </div>
    );
};

// --- Main App Component ---
export default function App() {
    const [view, setView] = useState('filter');
    const [selectedCountry, setSelectedCountry] = useState(null);
    const [selectedSector, setSelectedSector] = useState(null);
    const [timeRange, setTimeRange] = useState('1Y');
    const [headlineCompanyFilter, setHeadlineCompanyFilter] = useState('All');
    const [headlineTypeFilter, setHeadlineTypeFilter] = useState('All');
    const [performanceData, setPerformanceData] = useState({ header: null, chart: null, constituents: [], headlines: [], keyTakeaways: null });
    const [loading, setLoading] = useState({ chart: false, constituents: false, headlines: false, keyTakeaways: false });
    const [error, setError] = useState({ chart: null, constituents: null, headlines: null, keyTakeaways: null });
    const cache = useRef({});

    const callGeminiAPI = useCallback(async (payload) => {
        const apiKey = ""; 
        const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-05-20:generateContent?key=${apiKey}`;
        const response = await fetchWithRetry(apiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        const result = await response.json();
        const text = result.candidates?.[0]?.content?.parts?.[0]?.text;
        if (!text) throw new Error("The model did not return any content.");
        return text;
    }, []);
    
    const handleGenerateKeyTakeaways = useCallback(async () => {
        const filtered = performanceData.headlines.filter(h => {
            const companyMatch = headlineCompanyFilter === 'All' || h.relatedTickers?.includes(headlineCompanyFilter);
            if (!companyMatch) return false;
            const typeMatch = headlineTypeFilter === 'All' || h.type === headlineTypeFilter;
            return typeMatch;
        });

        if (!filtered || filtered.length === 0 || !selectedSector) return;
        setLoading(prev => ({ ...prev, keyTakeaways: true }));
        setError(prev => ({ ...prev, keyTakeaways: null }));
        try {
            const systemPrompt = "You are a financial market analyst. Summarize the key themes from the provided news headlines into a 3-point bulleted list. Each point should be a concise sentence.";
            const userQuery = `Based on the following news headlines for the ${selectedSector?.name} sector, what are the key takeaways?\n\n${filtered.map(n => `- "${n.title}"`).join('\n')}`;
            const payload = { contents: [{ parts: [{ text: userQuery }] }], systemInstruction: { parts: [{ text: systemPrompt }] } };
            const text = await callGeminiAPI(payload);
            setPerformanceData(prev => ({ ...prev, keyTakeaways: text }));
        } catch (err) {
            setError(prev => ({ ...prev, keyTakeaways: `Failed to generate takeaways. ${err.message}` }));
        } finally {
            setLoading(prev => ({ ...prev, keyTakeaways: false }));
        }
    }, [performanceData.headlines, selectedSector, headlineCompanyFilter, headlineTypeFilter, callGeminiAPI]);

    useEffect(() => {
        if (view !== 'performance' || !selectedSector || !selectedCountry) return;

        const cacheKey = `${selectedCountry.code}-${selectedSector.ticker}`;
        
        const fetchAllData = async () => {
            setLoading({ chart: true, constituents: true, headlines: true, keyTakeaways: false });
            setError({ chart: null, constituents: null, headlines: null, keyTakeaways: null });
            
            try {
                // Fetch primary data for the selected time range
                const rangeMap = { '1D': '1d', '5D': '5d', '3M': '3mo', '6M': '6mo', 'YTD': 'ytd', '1Y': '1y' };
                const yahooUrl = `https://query1.finance.yahoo.com/v8/finance/chart/${selectedSector.ticker}?range=${rangeMap[timeRange]}&interval=${timeRange === '1D' ? '5m' : '1d'}`;
                const proxyUrl = `https://corsproxy.io/?${encodeURIComponent(yahooUrl)}`;
                const response = await fetchWithRetry(proxyUrl);
                const result = await response.json();
                if (result.chart?.error) throw new Error(result.chart.error.description);
                const chartResult = result.chart?.result?.[0];
                const meta = chartResult?.meta;
                const timestamps = chartResult?.timestamp?.filter(Boolean);
                const closePrices = chartResult?.indicators?.quote?.[0]?.close?.filter(p => p !== null);
                if (!meta || !timestamps || !closePrices) throw new Error('API response missing critical chart data.');
                const chartData = { timestamps, closePrices, previousClose: meta.chartPreviousClose, lastClosePrice: closePrices[closePrices.length - 1], currency: meta.currency, meta };
    
                setPerformanceData(prev => ({ ...prev, chart: chartData, header: chartData }));
                setLoading(prev => ({...prev, chart: false}));
    
                const tickerSymbols = config.topTickersData[selectedCountry.code]?.[selectedSector.name] || config.topTickersData[selectedCountry.code]?.['All Sectors'] || [];
                 const quotePromises = tickerSymbols.map(async (t) => {
                    const interval = (timeRange === '1D') ? '5m' : (timeRange === '5D') ? '30m' : '1d';
                    const constUrl = `https://query1.finance.yahoo.com/v8/finance/chart/${t}?range=${rangeMap[timeRange]}&interval=${interval}`;
                    const constProxyUrl = `https://corsproxy.io/?${encodeURIComponent(constUrl)}`;
                    const res = await fetchWithRetry(constProxyUrl);
                    const constResult = await res.json();
                    const constChartResult = constResult.chart?.result?.[0];
                    const constMeta = constChartResult?.meta;
                    const constClosePrices = constChartResult?.indicators?.quote?.[0]?.close?.filter(p => p !== null);

                    if (!constMeta || !constClosePrices || constClosePrices.length < 1) return { symbol: t, name: constMeta?.shortName || t, price: constMeta?.regularMarketPrice || 0, change: 0, changePercent: 0 };
                    
                    const startPrice = constClosePrices[0];
                    const endPrice = constClosePrices[constClosePrices.length - 1];
                    const change = endPrice - startPrice;
                    const changePercent = startPrice !== 0 ? (change / startPrice) * 100 : 0;
                    
                    return { symbol: t, name: constMeta.shortName || t, price: endPrice, change, changePercent };
                });
                const topConstituents = (await Promise.all(quotePromises)).filter(Boolean);
                setPerformanceData(prev => ({ ...prev, constituents: topConstituents }));
                setLoading(prev => ({ ...prev, constituents: false }));

                // Fetch headlines and then process them
                const allTickersToFetch = [selectedSector.ticker, ...topConstituents.map(c => c.symbol)];
                const prPublishers = ['Business Wire', 'PR Newswire', 'GlobeNewswire', 'Marketwired', 'Accesswire'];
                const fetchPromises = allTickersToFetch.map(async (t) => {
                    const newsUrl = `https://query1.finance.yahoo.com/v1/finance/search?q=${t}&newsCount=10`;
                    const newsProxyUrl = `https://corsproxy.io/?${encodeURIComponent(newsUrl)}`;
                    try {
                        const newsResponse = await fetchWithRetry(newsProxyUrl);
                        const data = await newsResponse.json();
                        return (data?.news || []).map(article => ({ ...article, searchedTicker: t }));
                    } catch (e) { return []; }
                });
                const results = await Promise.all(fetchPromises);
                const allArticlesRaw = results.flat();
                const uniqueArticles = new Map();
                allArticlesRaw.forEach(article => {
                    if (uniqueArticles.has(article.link)) {
                        const existing = uniqueArticles.get(article.link);
                        existing.searchedTickers.add(article.searchedTicker);
                    } else {
                        uniqueArticles.set(article.link, { ...article, searchedTickers: new Set([article.searchedTicker]) });
                    }
                });
                const startDate = getStartDateForRange(timeRange);
                const articlesToFormat = Array.from(uniqueArticles.values())
                    .filter(article => new Date(article.providerPublishTime * 1000) >= startDate)
                    .map(article => {
                         const publishTime = new Date(article.providerPublishTime * 1000);
                         const hoursSince = (new Date() - publishTime) / 36e5;
                         const dateString = hoursSince < 24 ? `${Math.round(hoursSince < 1 ? hoursSince * 60 : hoursSince)}${hoursSince < 1 ? 'm' : 'h'} ago` : publishTime.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                         const type = prPublishers.includes(article.publisher) ? 'Press Release' : 'News';
                         const relatedTickers = Array.from(article.searchedTickers || []);
                         return { ...article, type, date: dateString, relatedTickers };
                    })
                    .sort((a, b) => b.providerPublishTime - a.providerPublishTime);

                setPerformanceData(prev => ({ ...prev, headlines: articlesToFormat}));
                setLoading(prev => ({...prev, headlines: false}));

            } catch (err) {
                console.error("Failed to fetch all data:", err);
                setError(prev => ({ ...prev, chart: err.message, constituents: err.message, headlines: err.message }));
                setLoading({ chart: false, constituents: false, headlines: false, keyTakeaways: false });
            }
        };

        fetchAllData();
    }, [view, selectedSector, selectedCountry, timeRange]);

    const filteredHeadlines = performanceData.headlines.filter(h => {
        const companyMatch = headlineCompanyFilter === 'All' || h.relatedTickers?.includes(headlineCompanyFilter);
        if (!companyMatch) return false;
        const typeMatch = headlineTypeFilter === 'All' || h.type === headlineTypeFilter;
        return typeMatch;
    });

    if (view === 'filter') {
      return (
            <div className="flex w-full max-w-7xl mx-auto bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden" style={{ minHeight: '80vh' }}>
                <div className="w-1/3 border-r border-gray-200 overflow-y-auto"><div className="p-6 sticky top-0 bg-white border-b z-10"><h1 className="text-3xl font-bold tracking-tight">Country</h1></div><div className="space-y-4 p-6">{Object.entries(countryRegions).map(([name, countries], i) => <CountryRegion key={name} name={name} countries={countries} selectedCountry={selectedCountry} onCountrySelect={setSelectedCountry} isInitiallyOpen={i === 0} />)}</div></div>
                <div className="w-2/3 overflow-y-auto"><div className="p-6 sticky top-0 bg-white border-b z-10"><h1 className={`text-3xl font-bold tracking-tight ${!selectedCountry ? 'text-transparent' : ''}`}>{selectedCountry ? `Sectors in ${selectedCountry.name}` : 'Sectors'}</h1></div><SectorList country={selectedCountry} onSectorSelect={s => { setSelectedSector(s); setView('performance'); setHeadlineCompanyFilter('All'); setHeadlineTypeFilter('All'); }} /></div>
            </div>
      );
    }
    
    return (
        <div className="w-full max-w-7xl mx-auto space-y-6">
            <div className="bg-white border border-gray-200 rounded-lg shadow-sm p-6 sticky top-8 z-20">
                <button onClick={() => setView('filter')} className="mb-4 text-sm text-gray-500 hover:text-black">← Back to Sector Selection</button>
                {performanceData.header ? (() => {
                     const { meta, lastClosePrice, previousClose, currency } = performanceData.header;
                     const change = lastClosePrice - previousClose; const changePercent = (change / previousClose) * 100;
                     const timeString = new Date(meta.regularMarketTime * 1000).toLocaleString('en-US', { timeZone: meta.exchangeTimezoneName, dateStyle: 'long', timeStyle: 'short'});
                    return <div><h1 className="text-2xl font-bold">{selectedCountry?.name} - {selectedSector?.name}</h1><p className="text-sm text-gray-500 mb-2">{selectedSector?.index} ({selectedSector?.ticker}) ({currency})</p><div className="flex items-end space-x-2"><p className="text-4xl font-bold">{lastClosePrice.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</p><p className={`text-lg font-semibold mb-1 ${change >= 0 ? 'text-green-600' : 'text-red-600'}`}>{change.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})} ({changePercent.toFixed(2)}%)</p></div><p className="text-xs text-gray-500">As of {timeString}</p></div>
                })() : <div className="h-[108px] animate-pulse"><div className="h-8 bg-gray-200 rounded w-3/4 mb-2"></div><div className="h-4 bg-gray-200 rounded w-1/2 mb-3"></div><div className="h-10 bg-gray-200 rounded w-1/3"></div></div>}
                 <div className="flex items-center space-x-1 bg-gray-100 rounded-md p-1 mt-4">
                    {['1D', '5D', '3M', '6M', 'YTD', '1Y'].map(r => 
                        <button key={r} onClick={() => setTimeRange(r)} className={`px-3 py-1 text-sm font-semibold rounded-md w-full transition-colors ${timeRange === r ? 'bg-white shadow-sm text-gray-900' : 'bg-transparent text-gray-600 hover:bg-gray-200'}`}>{r}</button>
                    )}
                </div>
            </div>

            <div className="bg-white border border-gray-200 rounded-lg shadow-sm p-6"><div className="flex flex-col md:flex-row gap-6"><div className="w-full md:w-2/3 flex flex-col"><div className="relative min-h-[400px]">{loading.chart ? <SkeletonLoader className="w-full h-full" /> : error.chart ? <ErrorMessage message={error.chart} /> : <PerformanceChart chartData={performanceData.chart} timeRange={timeRange} />}</div></div><div className="w-full md:w-1/3 flex flex-col md:border-l md:pl-6"><h2 className="text-lg font-bold mb-4">Top Constituents</h2><div className="flex-grow relative">{loading.constituents ? <div className="space-y-2">{[...Array(10)].map((_, i) => <SkeletonLoader key={i} className="w-full h-12" />)}</div> : error.constituents ? <ErrorMessage message={error.constituents} /> : <div className="overflow-y-auto h-[400px] pr-2">{performanceData.constituents.map(t => <div key={t.symbol} className="flex justify-between items-center py-3 border-b last:border-b-0"><div className="overflow-hidden pr-4"><p className="text-sm font-semibold truncate">{t.name}</p><p className="text-xs text-gray-500">{t.symbol}</p></div><div className="text-right flex-shrink-0"><p className="text-sm font-medium">{t.price.toFixed(2)}</p><p className={`text-xs ${t.change >= 0 ? 'text-green-600' : 'text-red-600'}`}>{t.change.toFixed(2)} ({t.changePercent.toFixed(2)}%)</p></div></div>)}</div>}</div></div></div></div>
            
             <HeadlinesGrid 
                items={filteredHeadlines} 
                title="Latest Headlines" 
                loading={loading.headlines} 
                error={error.headlines} 
                filterComponents={
                    <div className="flex flex-wrap items-center gap-4 mb-4">
                        <ConstituentFilter 
                            constituents={performanceData.constituents} 
                            onFilterChange={setHeadlineCompanyFilter} 
                            currentFilter={headlineCompanyFilter}
                        />
                        <HeadlineTypeFilter 
                            currentFilter={headlineTypeFilter}
                            onFilterChange={setHeadlineTypeFilter}
                        />
                    </div>
                } 
                onGenerateTakeaways={handleGenerateKeyTakeaways}
                takeaways={performanceData.keyTakeaways}
                takeawaysLoading={loading.keyTakeaways}
                takeawaysError={error.keyTakeaways}
            />
        </div>
    );
}

