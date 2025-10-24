/**
 * Shared Chart Helper Functions
 *
 * Consolidated utility functions for chart data generation and calculations
 * Used by both Entity and Sector features
 */

/**
 * Filters price data based on selected timeframe
 * @param {Array} priceData1Y - Full year of price data
 * @param {string} timeframe - Selected timeframe ('1D', '1M', '6M', 'YTD', '1Y', '5Y')
 * @returns {Array} Filtered price data
 */
export const filterPriceDataByTimeframe = (priceData1Y, timeframe) => {
  if (!priceData1Y || priceData1Y.length === 0) {
    return [];
  }

  // Get current date in US Eastern Time (where US stock market operates)
  // This ensures we filter correctly regardless of user's local timezone
  const nowET = new Date().toLocaleString('en-US', { timeZone: 'America/New_York' });
  const etDate = new Date(nowET);

  // Format today's date in US ET as YYYY-MM-DD for comparison
  const todayString = etDate.getFullYear() + '-' +
    String(etDate.getMonth() + 1).padStart(2, '0') + '-' +
    String(etDate.getDate()).padStart(2, '0');

  let filtered = priceData1Y;
  const now = etDate; // Use ET date for all date calculations

  switch (timeframe) {
    case '1D':
      // For 1D, return all intraday data (already filtered by backend)
      filtered = priceData1Y;
      break;
    case '1M': {
      const oneMonthAgo = new Date(now);
      oneMonthAgo.setMonth(now.getMonth() - 1);
      // Exclude today's data - only show completed trading days
      filtered = priceData1Y.filter(pt => {
        const ptDate = new Date(pt.date);
        // Explicitly exclude today by comparing date strings
        return ptDate >= oneMonthAgo && pt.date !== todayString;
      });
      break;
    }
    case '6M': {
      const sixMonthsAgo = new Date(now);
      sixMonthsAgo.setMonth(now.getMonth() - 6);
      // Exclude today's data - only show completed trading days
      filtered = priceData1Y.filter(pt => {
        const ptDate = new Date(pt.date);
        // Explicitly exclude today by comparing date strings
        return ptDate >= sixMonthsAgo && pt.date !== todayString;
      });
      break;
    }
    case 'YTD': {
      const startOfYear = new Date(now.getFullYear(), 0, 1);
      // Exclude today's data - only show completed trading days
      filtered = priceData1Y.filter(pt => {
        const ptDate = new Date(pt.date);
        // Explicitly exclude today by comparing date strings
        return ptDate >= startOfYear && pt.date !== todayString;
      });
      break;
    }
    case '1Y':
      // Exclude today's data - only show completed trading days
      filtered = priceData1Y.filter(pt => {
        // Explicitly exclude today by comparing date strings
        return pt.date !== todayString;
      });
      break;
    case '5Y':
    default:
      // For 5Y, exclude today's data - only show completed trading days
      filtered = priceData1Y.filter(pt => {
        // Explicitly exclude today by comparing date strings
        return pt.date !== todayString;
      });
      break;
  }

  return filtered;
};

/**
 * Generate chart coordinates from backend price data
 * @param {Array} priceData - Price data points
 * @returns {Array} Chart data with x, y, date, time, volume, index
 */
export const generateChartData = (priceData) => {
  if (!priceData || priceData.length === 0) {
    return [];
  }

  return priceData.map((point, i) => ({
    x: i,
    y: parseFloat(point.close) || parseFloat(point.price) || 0,
    date: point.date,
    time: point.time,
    volume: point.volume || 0,
    index: i
  }));
};

/**
 * Calculate price range for chart scaling with padding
 * @param {Array} chartData - Chart data points
 * @param {number} paddingPercent - Padding percentage (default 0.1)
 * @returns {Object} Object with min and max values
 */
export const getPriceRange = (chartData, paddingPercent = 0.1) => {
  if (chartData.length === 0) return { min: 0, max: 100 };

  const prices = chartData.map(d => d.y);
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  const padding = (max - min) * paddingPercent;

  return { min: min - padding, max: max + padding };
};

/**
 * Format X-axis label based on timeframe
 * @param {Date} date - Date object
 * @param {string} timeframe - Timeframe (1D, 1M, 6M, YTD, 1Y, 5Y)
 * @param {string} time - Time string (for intraday)
 * @returns {string} Formatted label
 */
export const formatXAxisLabel = (date, timeframe, time = null) => {
  const dateObj = typeof date === 'string' ? new Date(date) : date;

  switch (timeframe) {
    case '1D':
      // Show time for intraday views (hourly intervals)
      if (time) {
        return time;
      }
      return dateObj.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
    case '1M':
    case '6M':
    case 'YTD':
    case '1Y':
      // Show date as "M/DD" (e.g., "10/20")
      return `${dateObj.getMonth() + 1}/${dateObj.getDate()}`;
    case '5Y':
      // Show year as "YYYY" (e.g., "2021")
      return dateObj.getFullYear().toString();
    default:
      return dateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }
};

/**
 * Format tooltip date/time based on timeframe
 * @param {Date} date - Date object
 * @param {string} timeframe - Timeframe
 * @param {string} time - Time string (for intraday)
 * @returns {string} Formatted tooltip string
 */
export const formatTooltipDateTime = (date, timeframe, time = null) => {
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  const currentYear = new Date().getFullYear();
  const dateYear = dateObj.getFullYear();

  switch (timeframe) {
    case '1D':
      // Show only time for 1D (e.g., "12:06 PM")
      return time || dateObj.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
    case '1M':
    case '6M':
    case 'YTD':
    case '1Y':
      // Show "MMM DD" or "MMM DD, YYYY" if previous year
      if (dateYear < currentYear) {
        return dateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
      }
      return dateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    case '5Y':
      // Always show "MMM DD, YYYY"
      return dateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    default:
      return dateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }
};

/**
 * Generate timeline points for x-axis labels
 * @param {Array} chartData - Chart data points
 * @param {number} chartWidth - Width of chart in pixels (optional, for responsive mode)
 * @param {number} numPoints - Number of timeline points to generate (default 6)
 * @param {number} paddingLeft - Left padding in pixels (default 60)
 * @param {string} timeframe - Current timeframe for label formatting
 * @returns {Array} Timeline points with label and x position
 */
export const generateTimelinePoints = (chartData, chartWidth = null, numPoints = 6, paddingLeft = 60, timeframe = '1Y') => {
  if (chartData.length === 0) return [];

  const effectiveWidth = chartWidth || 660; // Default width for entity

  // For 5Y, try to select points at year boundaries for better distribution
  if (timeframe === '5Y') {
    const yearMap = new Map();

    // Group data points by year
    chartData.forEach((point, index) => {
      if (point.date) {
        const year = new Date(point.date).getFullYear();
        if (!yearMap.has(year)) {
          yearMap.set(year, []);
        }
        yearMap.get(year).push({ point, index });
      }
    });

    // Get unique years sorted
    const years = Array.from(yearMap.keys()).sort();

    if (years.length > 1) {
      // Create evenly spaced X positions for years
      return years.map((year, yearIndex) => {
        // Calculate evenly spaced position
        const xPosition = paddingLeft + (yearIndex * (effectiveWidth / (years.length - 1)));

        // Use the year as label
        const label = year.toString();

        return { label, x: xPosition };
      });
    }
  }

  // Default behavior for other timeframes
  const step = Math.max(1, Math.floor((chartData.length - 1) / (numPoints - 1)));
  const selectedIndices = [];

  for (let i = 0; i < numPoints - 1; i++) {
    selectedIndices.push(i * step);
  }
  selectedIndices.push(chartData.length - 1);

  const selectedPoints = selectedIndices.map(index => chartData[index]).filter(Boolean);

  return selectedPoints.map((point, i) => {
    let xPosition;

    // For 1D timeframe, use evenly spaced positions for better visual distribution
    // For other timeframes, align with actual data point positions
    if (timeframe === '1D') {
      // Evenly space the labels across the chart width
      xPosition = paddingLeft + (i * (effectiveWidth / Math.max(1, selectedPoints.length - 1)));
    } else {
      // Calculate X position based on actual data point index in chartData
      // This ensures X-axis labels align with hoverable data points
      const dataIndex = chartData.indexOf(point);
      xPosition = paddingLeft + (dataIndex * (effectiveWidth / Math.max(1, chartData.length - 1)));
    }

    let label = '';

    if (point.date) {
      label = formatXAxisLabel(point.date, timeframe, point.time);
    } else {
      label = `Point ${i + 1}`;
    }

    return { label, x: xPosition, dataIndex: chartData.indexOf(point) };
  });
};

/**
 * Calculate price change metrics
 * @param {Array} chartData - Chart data points
 * @returns {Object} Object with currentPrice, startPrice, priceChange, priceChangePercent
 */
export const calculatePriceChange = (chartData) => {
  if (chartData.length === 0) {
    return {
      currentPrice: null,
      startPrice: null,
      priceChange: 0,
      priceChangePercent: 0
    };
  }

  const currentPoint = chartData[chartData.length - 1];
  const startPoint = chartData[0];
  const priceChange = currentPoint.y - startPoint.y;
  const priceChangePercent = (priceChange / startPoint.y) * 100;

  return {
    currentPrice: currentPoint.y,
    startPrice: startPoint.y,
    priceChange,
    priceChangePercent
  };
};

/**
 * Calculate SVG path coordinates for price line
 * @param {Array} chartData - Chart data points
 * @param {Object} priceRange - Price range with min and max
 * @param {number} chartWidth - Chart width in pixels (default 660)
 * @param {number} chartHeight - Chart height in pixels (default 250)
 * @param {number} paddingLeft - Left padding (default 60)
 * @param {number} paddingTop - Top padding (default 40)
 * @returns {string} SVG path data
 */
export const calculateChartPath = (
  chartData,
  priceRange,
  chartWidth = 660,
  chartHeight = 250,
  paddingLeft = 60,
  paddingTop = 40
) => {
  if (chartData.length === 0) return '';

  const points = chartData.map((point, i) => {
    const x = paddingLeft + (i * (chartWidth / Math.max(1, chartData.length - 1)));
    const y = paddingTop + chartHeight - ((point.y - priceRange.min) / (priceRange.max - priceRange.min) * chartHeight);
    return { x, y };
  });

  const pathData = points.map((point, i) =>
    i === 0 ? `M ${point.x} ${point.y}` : `L ${point.x} ${point.y}`
  ).join(' ');

  return pathData;
};

/**
 * Calculate SVG path for filled area under chart
 * @param {Array} chartData - Chart data points
 * @param {Object} priceRange - Price range with min and max
 * @param {number} chartWidth - Chart width in pixels (default 660)
 * @param {number} chartHeight - Chart height in pixels (default 250)
 * @param {number} paddingLeft - Left padding (default 60)
 * @param {number} paddingTop - Top padding (default 40)
 * @returns {string} SVG path data for fill area
 */
export const calculateFillPath = (
  chartData,
  priceRange,
  chartWidth = 660,
  chartHeight = 250,
  paddingLeft = 60,
  paddingTop = 40
) => {
  if (chartData.length === 0) return '';

  const bottomY = paddingTop + chartHeight;

  const points = chartData.map((point, i) => {
    const x = paddingLeft + (i * (chartWidth / Math.max(1, chartData.length - 1)));
    const y = paddingTop + chartHeight - ((point.y - priceRange.min) / (priceRange.max - priceRange.min) * chartHeight);
    return `L ${x} ${y}`;
  }).join(' ');

  const lastX = paddingLeft + ((chartData.length - 1) * (chartWidth / Math.max(1, chartData.length - 1)));

  return `M ${paddingLeft} ${bottomY} ${points} L ${lastX} ${bottomY} Z`;
};

/**
 * Generate daily sentiment bar chart data
 * @param {Object} dailySentiment - Daily sentiment data keyed by date
 * @param {number} daysToShow - Number of days to include (default 7)
 * @returns {Array} Bar chart data with date, label, score, count, headlines, index
 */
export const generateDailySentimentBars = (dailySentiment, daysToShow = 7) => {
  if (!dailySentiment || Object.keys(dailySentiment).length === 0) {
    return [];
  }

  // Sort by date and get last N days
  const sortedDates = Object.keys(dailySentiment).sort();
  const lastDays = sortedDates.slice(-daysToShow);

  return lastDays.map((date, index) => {
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

/**
 * Find event position on chart (Entity style - using CHART_CONFIG)
 * @param {Object} event - Event object with start_date and trend
 * @param {Array} chartData - Chart data points with date and index
 * @param {number} chartWidth - Chart width (default 660)
 * @param {number} paddingLeft - Left padding (default 60)
 * @returns {Object|null} Object with xPos, pricePoint, isUpward or null if not found
 */
export const findEventPosition = (event, chartData, chartWidth = 660, paddingLeft = 60) => {
  const eventDate = new Date(event.start_date);
  const pricePoint = chartData.find(p => {
    const pointDate = new Date(p.date);
    return pointDate.toDateString() === eventDate.toDateString();
  });

  if (!pricePoint || pricePoint.index === undefined) return null;

  const xPos = paddingLeft + ((pricePoint.index / (chartData.length - 1)) * chartWidth);

  return {
    xPos,
    pricePoint,
    isUpward: event.trend === 'Upward'
  };
};

/**
 * Compute event marker positions on chart (Sector style - with y-coordinate)
 * @param {Array} events - Significant events array
 * @param {Array} chartData - Chart data points
 * @param {number} chartWidth - Chart width in pixels
 * @param {number} chartHeight - Chart height in pixels
 * @param {Object} priceRange - Price range with min and max
 * @param {number} paddingLeft - Left padding (default 60)
 * @param {number} paddingTop - Top padding (default 40)
 * @returns {Array} Event markers with x, y, trend, pct, date, news
 */
export const computeEventMarkers = (
  events,
  chartData,
  chartWidth,
  chartHeight,
  priceRange,
  paddingLeft = 60,
  paddingTop = 40
) => {
  if (!chartData || chartData.length === 0 || !events || events.length === 0) {
    return [];
  }

  return events.map((event) => {
    const eventDate = new Date(event.start_date);
    const index = chartData.findIndex(pt => new Date(pt.date).toDateString() === eventDate.toDateString());

    if (index === -1) return null;

    const x = paddingLeft + (index * (chartWidth / Math.max(1, chartData.length - 1)));
    const y = (paddingTop + chartHeight) - ((chartData[index].y - priceRange.min) / (priceRange.max - priceRange.min) * chartHeight);

    return {
      x,
      y,
      trend: event.trend,
      pct: event.total_move_pct,
      date: event.start_date,
      news: event.news
    };
  }).filter(Boolean);
};
