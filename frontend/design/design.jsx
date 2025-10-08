import React, { useState, useEffect, useCallback, useRef } from 'react';
import Chart from 'chart.js/auto';

// --- Helper Components ---

const SkeletonLoader = ({ className }) => <div className={`animate-pulse bg-gray-200 rounded ${className}`}></div>;
const Spinner = () => (
    <div className="absolute inset-0 flex items-center justify-center bg-white bg-opacity-75 z-20">
        <div style={{ border: '4px solid rgba(0, 0, 0, 0.1)', width: '36px', height: '36px', borderRadius: '50%', borderLeftColor: '#09f', animation: 'spin 1s ease infinite' }}></div>
        <style>{`@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}</style>
    </div>
);
const ErrorMessage = ({ message }) => ( <div className="p-4 text-center"><p className="text-red-500 font-semibold">{message}</p></div>);


// --- API & Data Helpers ---

const fetchWithRetry = async (url, options = {}, retries = 3, backoff = 300) => {
    for (let i = 0; i < retries; i++) {
        try {
            const response = await fetch(url, options);
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            return response.json();
        } catch (err) {
            console.warn(`Attempt ${i + 1} failed for ${url}. Retrying in ${backoff}ms...`);
            if (i === retries - 1) throw err;
            await new Promise(res => setTimeout(res, backoff));
            backoff *= 2;
        }
    }
};

const PROXY_URL = 'https://api.allorigins.win/raw?url=';

const getStartDateForRange = (range) => {
    const now = new Date();
    switch (range) {
        case '1D': return new Date(now.setDate(now.getDate() - 1));
        case '5D': return new Date(now.setDate(now.getDate() - 5));
        case '1M': return new Date(now.setMonth(now.getMonth() - 1));
        case '3M': return new Date(now.setMonth(now.getMonth() - 3));
        case '6M': return new Date(now.setMonth(now.getMonth() - 6));
        case 'YTD': return new Date(now.getFullYear(), 0, 1);
        case '1Y': return new Date(now.setFullYear(now.getFullYear() - 1));
        default: return new Date(now.setFullYear(now.getFullYear() - 1));
    }
};

// --- Custom Hooks ---

const useYahooFinanceAPI = (ticker, timeRange, cache) => {
    const [data, setData] = useState({ chart: null, news: [] });
    const [loading, setLoading] = useState({ chart: false, news: false });
    const [error, setError] = useState({ chart: null, news: null });

    // Effect for chart data
    useEffect(() => {
        if (!ticker) return;
        const cacheKey = `${ticker}-chart-${timeRange}`;

        const fetchChartData = async () => {
            if (cache.current[cacheKey]) {
                setData(prev => ({...prev, chart: cache.current[cacheKey]}));
                return;
            }

            setLoading(prev => ({ ...prev, chart: true }));
            setError(prev => ({ ...prev, chart: null }));

            try {
                const rangeMap = { '1D': '1d', '5D': '5d', '1M': '1mo', '3M': '3mo', '6M': '6mo', 'YTD': 'ytd', '1Y': '1y' };
                let interval;
                if (timeRange === '1D') {
                    interval = '5m';
                } else if (timeRange === '5D') {
                    interval = '30m';
                } else {
                    interval = '1d';
                }
                const chartUrl = `${PROXY_URL}${encodeURIComponent(`https://query1.finance.yahoo.com/v8/finance/chart/${ticker}?range=${rangeMap[timeRange]}&interval=${interval}`)}`;
                const chartData = await fetchWithRetry(chartUrl);
                const chartResult = chartData.chart?.result?.[0];
                if (!chartResult || chartData.chart?.error) {
                    throw new Error(chartData.chart?.error?.description || `No chart data found for ${ticker}.`);
                }
                cache.current[cacheKey] = chartResult;
                setData(prev => ({ ...prev, chart: chartResult }));
            } catch (err) {
                console.error("Failed to fetch chart data:", err);
                setError(prev => ({ ...prev, chart: err.message }));
            } finally {
                setLoading(prev => ({ ...prev, chart: false }));
            }
        };

        fetchChartData();
    }, [ticker, timeRange, cache]);

    // Effect for news data
    useEffect(() => {
        if (!ticker) return;
        const cacheKey = `${ticker}-news`;

        const fetchNewsData = async () => {
             if (cache.current[cacheKey]) {
                setData(prev => ({...prev, news: cache.current[cacheKey]}));
                return;
            }
            setLoading(prev => ({ ...prev, news: true }));
            setError(prev => ({ ...prev, news: null }));

            try {
                const newsUrl = `${PROXY_URL}${encodeURIComponent(`https://query1.finance.yahoo.com/v1/finance/search?q=${ticker}&newsCount=50`)}`;
                const newsData = await fetchWithRetry(newsUrl);
                const newsResult = newsData.news || [];
                cache.current[cacheKey] = newsResult;
                setData(prev => ({ ...prev, news: newsResult }));
            } catch (err) {
                console.error("Failed to fetch news data:", err);
                setError(prev => ({ ...prev, news: err.message }));
            } finally {
                setLoading(prev => ({ ...prev, news: false }));
            }
        };

        fetchNewsData();
    }, [ticker, cache]);
    
    // Effect for real-time price polling
    useEffect(() => {
        if (!ticker) return;

        const pollPrice = async () => {
            try {
                const url = `${PROXY_URL}${encodeURIComponent(`https://query1.finance.yahoo.com/v8/finance/chart/${ticker}?range=1d&interval=1m`)}`;
                const priceData = await fetchWithRetry(url);
                const latestMeta = priceData.chart?.result?.[0]?.meta;
                if (latestMeta && latestMeta.regularMarketPrice) {
                    setData(prev => {
                        if (!prev.chart) return prev; 
                        
                        const newChartData = {
                             ...prev.chart,
                            meta: {
                                ...prev.chart.meta,
                                regularMarketPrice: latestMeta.regularMarketPrice,
                                regularMarketTime: latestMeta.regularMarketTime,
                            }
                        };
                        
                        const cacheKey1D = `${ticker}-chart-1D`;
                        if(cache.current[cacheKey1D]) {
                            cache.current[cacheKey1D] = newChartData;
                        }

                        return {
                            ...prev,
                            chart: newChartData
                        };
                    });
                }
            } catch (err) {
                console.warn("Real-time price poll failed:", err);
            }
        };
 
        const intervalId = setInterval(pollPrice, 15000); 

        return () => clearInterval(intervalId);

    }, [ticker, cache]);


    return { data, loading, error };
};

const useSearchSuggestions = (query) => {
    const [suggestions, setSuggestions] = useState({ quotes: [] });
    const [loading, setLoading] = useState(false);
    const debounceTimeout = useRef(null);

    useEffect(() => {
        if (debounceTimeout.current) clearTimeout(debounceTimeout.current);
        if (query.trim().length > 1) {
            setLoading(true);
            debounceTimeout.current = setTimeout(async () => {
                try {
                    const url = `${PROXY_URL}${encodeURIComponent(`https://query1.finance.yahoo.com/v1/finance/search?q=${query}`)}`;
                    const data = await fetchWithRetry(url);
                    setSuggestions({ quotes: data.quotes || [] });
                } catch (err) {
                    console.error("Failed to fetch suggestions:", err);
                    setSuggestions({ quotes: [] });
                } finally {
                    setLoading(false);
                }
            }, 300);
        } else {
            setSuggestions({ quotes: [] });
        }
        return () => { if (debounceTimeout.current) clearTimeout(debounceTimeout.current); };
    }, [query]);

    return { suggestions, loading };
};


// --- UI Components ---

const Header = ({ data, ticker }) => {
    if (!data.chart) return null;

    const { meta } = data.chart;
    const change = meta.regularMarketPrice - meta.chartPreviousClose;
    const changePercent = (change / meta.chartPreviousClose) * 100;
    
    const formatMarketState = (state) => {
        if (!state) return '';
        const s = state.toUpperCase();
        if (s === 'REGULAR') return 'Market open';
        if (s === 'PRE') return 'Pre-market';
        if (s === 'POST') return 'Post-market';
        if (s === 'CLOSED') return 'Market closed';
        return state;
    }

    const marketTime = new Date(meta.regularMarketTime * 1000);
    const timeString = marketTime.toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        timeZoneName: 'short',
        timeZone: meta.exchangeTimezoneName
    });

    const dateString = marketTime.toLocaleDateString('en-US', {
        month: '2-digit',
        day: '2-digit',
        year: '2-digit'
    });

    return (
        <div>
            <h1 className="text-4xl font-bold text-gray-900 mb-1">{meta.shortName || ticker}</h1>

            <div className="text-md text-gray-500 mb-1">
                <span>{meta.symbol || ticker}:US</span>
            </div>
            <div className="text-md text-gray-500 mb-4">
                 <span>{(meta.fullExchangeName || '').replace('GS', ' GS')} ({meta.currency})</span>
                {meta.marketState && <span className="font-semibold"> · {formatMarketState(meta.marketState)}</span>}
            </div>

            <div className="flex items-center space-x-3 flex-wrap mb-1">
                <p className="text-5xl font-light">{meta.regularMarketPrice?.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</p>
                {!isNaN(change) && (
                    <div className={`flex items-center text-2xl font-semibold ${change >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {change >= 0 ? 
                            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 20"><path d="M12 0L24 20L0 20L12 0Z" /></svg> : 
                            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 20"><path d="M12 20L0 0L24 0L12 20Z" /></svg>
                        }
                        <span className="ml-1">{Math.abs(change).toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</span>
                        <span className="ml-2">{change >= 0 ? '+' : ''}{changePercent.toFixed(2)}%</span>
                    </div>
                )}
            </div>
            
             <p className="text-sm text-gray-500">
                As of {timeString} {dateString}. 
                {meta.exchangeName === 'NMS' && ' Nasdaq Last Sale'}
             </p>
        </div>
    );
};

const PerformanceChart = ({ chartData, timeRange }) => {
    const chartRef = useRef(null);
    useEffect(() => {
        if (!chartData || !chartRef.current) return;
        
        const { meta, timestamp, indicators } = chartData;
        const closePrices = indicators.quote[0].close?.filter(p => p !== null);
        if (!closePrices || closePrices.length === 0) return;

        const labels = timestamp.map(ts => {
            const date = new Date(ts * 1000);
            if (timeRange === '1D') {
                return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', timeZone: meta.exchangeTimezoneName });
            }
            return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: meta.exchangeTimezoneName });
        });
        
        const crosshairPlugin = {
            id: 'crosshair',
            afterDraw: chart => {
                if (chart.tooltip?.getActiveElements()?.length) {
                    const ctx = chart.ctx;
                    const activePoint = chart.tooltip.getActiveElements()[0];
                    const x = activePoint.element.x;
                    const y = activePoint.element.y;
                    const topY = chart.scales.y.top;
                    const bottomY = chart.scales.y.bottom;

                    ctx.save();
                    
                    ctx.beginPath();
                    ctx.setLineDash([5, 5]);
                    ctx.moveTo(x, topY);
                    ctx.lineTo(x, bottomY);
                    ctx.lineWidth = 1;
                    ctx.strokeStyle = 'rgba(0, 0, 0, 0.5)';
                    ctx.stroke();

                    ctx.beginPath();
                    ctx.arc(x, y, 5, 0, 2 * Math.PI);
                    ctx.fillStyle = 'black';
                    ctx.fill();
                    
                    ctx.restore();
                }
            }
        };

        const prevCloseAnnotationPlugin = {
            id: 'prevCloseLine',
            afterDraw: chart => {
                 if (chart.options.plugins.prevCloseLine.timeRange !== '1D') {
                    return;
                }
                const prevClose = chart.options.plugins.prevCloseLine.value;
                const currency = chart.options.plugins.prevCloseLine.currency;
                const ctx = chart.ctx;
                const scaleY = chart.scales.y;
                const chartArea = chart.chartArea;
                const y = scaleY.getPixelForValue(prevClose);

                if (y >= chartArea.top && y <= chartArea.bottom) {
                     ctx.save();
                     ctx.beginPath();
                     ctx.moveTo(chartArea.left, y);
                     ctx.lineTo(chartArea.right, y);
                     ctx.lineWidth = 1;
                     ctx.strokeStyle = '#a0aec0';
                     ctx.setLineDash([5, 5]);
                     ctx.stroke();
                     
                     ctx.fillStyle = '#a0aec0';
                     ctx.font = '10px sans-serif';
                     ctx.textAlign = 'left';
                     ctx.textBaseline = 'bottom';
                     ctx.fillText(`PREV. CLOSE ${prevClose.toFixed(2)} ${currency}`, chartArea.left + 5, y - 5);
                     
                     ctx.restore();
                }
            }
        };

        const chartInstance = new Chart(chartRef.current, {
            type: 'line',
            data: {
                labels,
                datasets: [{ 
                    label: 'Price', data: closePrices, 
                    borderColor: closePrices[closePrices.length - 1] >= meta.chartPreviousClose ? '#16a34a' : '#dc2626', 
                    borderWidth: 2, pointRadius: 0, tension: 0.1, fill: true,
                    backgroundColor: closePrices[closePrices.length - 1] >= meta.chartPreviousClose ? 'rgba(22, 163, 74, 0.1)' : 'rgba(220, 38, 38, 0.1)'
                }]
            },
            options: {
                responsive: true, maintainAspectRatio: false,
                interaction: {
                    mode: 'index',
                    intersect: false,
                },
                scales: { 
                    x: { grid: { display: false } }, 
                    y: { 
                        grid: { 
                            color: 'rgba(0, 0, 0, 0.1)',
                            borderDash: [5, 5]
                        } 
                    }
                },
                plugins: { 
                    legend: { display: false },
                    tooltip: {
                        enabled: true,
                        position: 'nearest',
                        yAlign: 'bottom',
                        backgroundColor: 'rgba(249, 250, 251, 0.9)',
                        titleColor: '#000',
                        bodyColor: '#000',
                        borderColor: '#ccc',
                        borderWidth: 1,
                        displayColors: false,
                        callbacks: {
                            title: (tooltipItems) => {
                                const item = tooltipItems[0];
                                return `${item.parsed.y.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})} ${meta.currency}`;
                            },
                            label: (context) => {
                                const date = new Date(timestamp[context.dataIndex] * 1000);
                                if (timeRange === '1D') {
                                    return date.toLocaleTimeString('en-US', {hour: '2-digit', minute: '2-digit', timeZone: meta.exchangeTimezoneName});
                                }
                                if (timeRange === '5D') {
                                    return date.toLocaleString('en-US', {month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: meta.exchangeTimezoneName});
                                }
                                return date.toLocaleDateString('en-US', {month: 'short', day: 'numeric', timeZone: meta.exchangeTimezoneName});
                            }
                        }
                    },
                    prevCloseLine: {
                        value: meta.chartPreviousClose,
                        currency: meta.currency,
                        timeRange: timeRange
                    }
                }
            },
            plugins: [crosshairPlugin, prevCloseAnnotationPlugin]
        });
        return () => chartInstance.destroy();
    }, [chartData, timeRange]);
    
    return <canvas ref={chartRef}></canvas>;
};

const SearchBar = ({ onTickerSelect }) => {
    const [query, setQuery] = useState('');
    const [isFocused, setIsFocused] = useState(false);
    const { suggestions, loading } = useSearchSuggestions(query);
    const searchRef = useRef(null);

    const handleSelect = (ticker) => {
        setQuery(ticker);
        onTickerSelect(ticker);
        setIsFocused(false);
    };
    
    useEffect(() => {
        const handleClickOutside = (e) => { if (searchRef.current && !searchRef.current.contains(e.target)) setIsFocused(false); };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    return (
        <div className="relative" ref={searchRef}>
            <input type="text" value={query} onChange={e => setQuery(e.target.value)} onFocus={() => setIsFocused(true)} placeholder="Search for quotes" className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500" />
            {isFocused && query && (
                 <div className="absolute top-full left-0 w-full bg-white border border-gray-200 rounded-md shadow-lg mt-1 z-30 max-h-96 overflow-y-auto">
                    {loading && <div className="p-4 text-center text-gray-500">Loading...</div>}
                    {!loading && suggestions.quotes.filter(q => q.quoteType === 'EQUITY').map(q => (
                        <div key={q.symbol} onClick={() => handleSelect(q.symbol)} className="px-4 py-3 cursor-pointer hover:bg-gray-100">
                            <p className="font-bold text-sm">{q.symbol}</p>
                            <p className="text-xs text-gray-600 truncate">{q.shortname || q.longname}</p>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

// --- Page Sections ---
const ChartSection = ({ data, timeRange, setTimeRange, isLoading }) => (
    <div className="bg-white rounded-lg shadow p-6 h-full">
         <div className="flex items-center space-x-1 bg-gray-100 rounded-md p-1 my-2">
            {['1D', '5D', '1M', '3M', '6M', 'YTD', '1Y'].map(r => 
                <button key={r} onClick={() => setTimeRange(r)} className={`px-3 py-1 text-sm font-semibold rounded-md w-full transition-colors ${timeRange === r ? 'bg-white shadow-sm text-gray-900' : 'bg-transparent text-gray-600 hover:bg-gray-200'}`}>{r}</button>
            )}
        </div>
        <div className="relative h-[400px]">
            {isLoading ? <SkeletonLoader className="w-full h-full" /> : <PerformanceChart chartData={data.chart} timeRange={timeRange} />}
        </div>
    </div>
);

const NewsSection = ({ news, ticker, isLoading }) => {
    return (
        <div className="bg-white rounded-lg shadow p-6 h-full">
            <h3 className="text-lg font-bold mb-4">Related News for {ticker}</h3>
            <div className="space-y-4 overflow-y-auto" style={{maxHeight: '450px'}}>
                {isLoading ? (
                    <div className="space-y-4">
                        {[...Array(5)].map((_, i) => <SkeletonLoader key={i} className="h-16 w-full" />)}
                    </div>
                ) : news.length > 0 ? news.map((item, index) => (
                    <a key={item.uuid + index} href={item.link} target="_blank" rel="noopener noreferrer" className="block p-3 border rounded-md hover:bg-gray-50">
                        <h4 className="font-semibold text-gray-800 text-sm">{item.title}</h4>
                        <p className="text-xs text-gray-500 mt-1">{item.publisher} &bull; {new Date(item.providerPublishTime * 1000).toLocaleDateString()}</p>
                    </a>
                )) : <p className="text-sm text-gray-500">No recent news available.</p>}
            </div>
        </div>
    );
};

// --- App ---
export default function App() {
    const [ticker, setTicker] = useState('AAPL');
    const [timeRange, setTimeRange] = useState('1Y');
    const cache = useRef({});
    const { data, loading, error } = useYahooFinanceAPI(ticker, timeRange, cache);

    const isInitialLoading = !data.chart && loading.chart;
    const hasFatalError = error.chart && !data.chart;

    const startDate = getStartDateForRange(timeRange);
    const filteredNews = data.news.filter(item => new Date(item.providerPublishTime * 1000) >= startDate);

    return (
        <div className="p-4 md:p-6 bg-gray-50 min-h-screen">
            <main className="max-w-7xl mx-auto space-y-6">
                <div className="bg-white rounded-lg shadow p-6">
                   <SearchBar onTickerSelect={setTicker} />
                </div>
                
                {!ticker ? (
                    <div className="text-center p-10 bg-white rounded-lg shadow">Select a ticker to begin.</div>
                ) : isInitialLoading ? (
                    <div className="text-center p-10 bg-white rounded-lg shadow"><Spinner /></div>
                ) : hasFatalError ? (
                    <ErrorMessage message={error.chart || "Could not load data for this ticker."} />
                ) : (
                    <>
                        <div className="bg-white rounded-lg shadow p-6 sticky top-4 z-20">
                            <Header data={data} ticker={ticker} />
                        </div>
                        
                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                            <div className="lg:col-span-2">
                                <ChartSection data={data} timeRange={timeRange} setTimeRange={setTimeRange} isLoading={loading.chart} />
                            </div>
                            <div className="lg:col-span-1">
                                <NewsSection news={filteredNews} ticker={ticker} isLoading={loading.news} />
                            </div>
                        </div>
                    </>
                )}
            </main>
        </div>
    );
}