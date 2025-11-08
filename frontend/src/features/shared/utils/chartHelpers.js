/**
 * Shared Chart Helper Functions
 *
 * Consolidated utility functions for chart data generation and calculations
 * Used by both Entity and Sector features
 */

/**
 * Filters price data based on selected timeframe
 * @param {Array} priceData1Y - Full year of price data
 * @param {string} timeframe - Selected timeframe ('1D', '1M', '6M', 'YTD', '1Y')
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
    case '1D': {
      // Constrain 1D view to the most recent trading session
      const lastPoint = priceData1Y[priceData1Y.length - 1];
      if (lastPoint && lastPoint.date) {
        const latestDate = lastPoint.date;
        filtered = priceData1Y.filter(pt => pt.date === latestDate);
      } else {
        filtered = priceData1Y;
      }
      break;
    }
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
    case '3M': {
      const threeMonthsAgo = new Date(now);
      threeMonthsAgo.setMonth(now.getMonth() - 3);
      filtered = priceData1Y.filter(pt => {
        const ptDate = new Date(pt.date);
        return ptDate >= threeMonthsAgo && pt.date !== todayString;
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
    default: {
      // For longer ranges, exclude today's data so we only show completed trading days
      filtered = priceData1Y.filter(pt => pt.date !== todayString);

      if (timeframe === '5Y') {
        // Downsample 5Y data client-side to keep chart rendering performant
        const MAX_5Y_POINTS = 800;
        if (filtered.length > MAX_5Y_POINTS) {
          const step = Math.ceil(filtered.length / MAX_5Y_POINTS);
          const sampled = filtered.filter((_, idx) => idx % step === 0);
          if (sampled[sampled.length - 1] !== filtered[filtered.length - 1]) {
            sampled.push(filtered[filtered.length - 1]);
          }
          filtered = sampled;
        }
      }
      break;
    }
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

  return priceData.map((point, i) => {
    // Use nullish coalescing with NaN check to handle 0 correctly
    const closeValue = point.close !== undefined && point.close !== null ? parseFloat(point.close) : NaN;
    const priceValue = point.price !== undefined && point.price !== null ? parseFloat(point.price) : NaN;

    return {
      x: i,
      // Use null instead of 0 for missing values - charts render null as gaps, preventing artificial plunges
      y: !isNaN(closeValue) ? closeValue : (!isNaN(priceValue) ? priceValue : null),
      date: point.date,
      time: point.time,
      volume: point.volume || 0,
      index: i
    };
  });
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

  // Handle flat series (zero range) to prevent division by zero
  const range = max - min;
  if (range < 0.01) {
    const midpoint = (max + min) / 2;
    const epsilon = midpoint * 0.01 || 1;  // 1% of value or 1 minimum
    return { min: midpoint - epsilon, max: midpoint + epsilon };
  }

  const padding = range * paddingPercent;
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
    default:
      return dateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }
};

/**
 * Get market open and close times based on exchange
 * @param {string} exchange - Exchange code
 * @returns {Object} Object with marketOpen and marketClose in "HH:MM" format
 */
export const getMarketOpenClose = (exchange) => {
  const exchangeUpper = (exchange || '').toUpperCase();

  // US Markets
  if (exchangeUpper.includes('NMS') || exchangeUpper.includes('NYQ') ||
      exchangeUpper.includes('NASDAQ') || exchangeUpper.includes('NYSE') || exchangeUpper === '') {
    return { marketOpen: '09:30', marketClose: '16:30' };
  }
  // London
  if (exchangeUpper.includes('LSE') || exchangeUpper.includes('LON')) {
    return { marketOpen: '08:00', marketClose: '16:30' };
  }
  // Tokyo
  if (exchangeUpper.includes('JPX') || exchangeUpper.includes('TYO')) {
    return { marketOpen: '09:00', marketClose: '15:00' };
  }
  // Hong Kong
  if (exchangeUpper.includes('HKG') || exchangeUpper.includes('HKEX')) {
    return { marketOpen: '09:30', marketClose: '16:00' };
  }
  // Shanghai
  if (exchangeUpper.includes('SHG') || exchangeUpper.includes('SSE')) {
    return { marketOpen: '09:30', marketClose: '15:00' };
  }
  // Toronto
  if (exchangeUpper.includes('TOR') || exchangeUpper.includes('TSX')) {
    return { marketOpen: '09:30', marketClose: '16:00' };
  }
  // Singapore
  if (exchangeUpper.includes('SES') || exchangeUpper.includes('SGX') || exchangeUpper.includes('SIN')) {
    return { marketOpen: '09:00', marketClose: '17:00' };
  }

  // Default to US hours
  return { marketOpen: '09:30', marketClose: '16:30' };
};

/**
 * Calculate trading day elapsed percentage based on last data point time
 * @param {Array} chartData - Chart data with time property
 * @param {string} exchange - Exchange code
 * @returns {number} Percentage of trading day elapsed (0-1), or 1 if market closed
 */
export const calculateTradingDayElapsed = (chartData, exchange) => {
  if (!chartData || chartData.length === 0) return 1;

  const lastPoint = chartData[chartData.length - 1];
  if (!lastPoint.time) return 1; // If no time data, show full width

  const { marketOpen, marketClose } = getMarketOpenClose(exchange);

  // Parse times into minutes since midnight
  const parseTime = (timeStr) => {
    // Handle formats like "09:45 AM" or "09:45"
    let timeOnly = timeStr.trim();
    let hours, minutes;

    // Check if it has AM/PM
    if (timeOnly.includes('AM') || timeOnly.includes('PM')) {
      const isPM = timeOnly.includes('PM');
      timeOnly = timeOnly.replace(/\s*(AM|PM)\s*/i, '').trim();
      [hours, minutes] = timeOnly.split(':').map(Number);

      // Convert to 24-hour format
      if (isPM && hours !== 12) {
        hours += 12;
      } else if (!isPM && hours === 12) {
        hours = 0;
      }
    } else {
      [hours, minutes] = timeOnly.split(':').map(Number);
    }

    return hours * 60 + minutes;
  };

  const openMinutes = parseTime(marketOpen);
  const closeMinutes = parseTime(marketClose);
  const lastDataMinutes = parseTime(lastPoint.time);

  // Calculate elapsed percentage
  const totalTradingMinutes = closeMinutes - openMinutes;
  const elapsedMinutes = Math.max(0, Math.min(lastDataMinutes - openMinutes, totalTradingMinutes));

  return Math.min(elapsedMinutes / totalTradingMinutes, 1);
};

/**
 * Get market hours based on exchange
 * @param {string} exchange - Exchange code (e.g., "NMS", "NYQ", "LSE", "JPX")
 * @returns {Array} Array of time strings for market hours
 */
export const getMarketHours = (exchange) => {
  // Normalize exchange string
  const exchangeUpper = (exchange || '').toUpperCase();

  // US Markets (NASDAQ, NYSE, etc.)
  if (exchangeUpper.includes('NMS') || // NASDAQ
      exchangeUpper.includes('NYQ') || // NYSE
      exchangeUpper.includes('NASDAQ') ||
      exchangeUpper.includes('NYSE') ||
      exchangeUpper === '') { // Default to US market hours
    return ['10:30', '12:00', '13:30', '15:00', '16:30'];
  }

  // London Stock Exchange
  if (exchangeUpper.includes('LSE') || exchangeUpper.includes('LON')) {
    return ['08:00', '10:00', '12:00', '14:00', '16:30'];
  }

  // Tokyo Stock Exchange
  if (exchangeUpper.includes('JPX') || exchangeUpper.includes('TYO')) {
    return ['09:00', '10:30', '12:00', '13:30', '15:00'];
  }

  // Hong Kong Stock Exchange
  if (exchangeUpper.includes('HKG') || exchangeUpper.includes('HKEX')) {
    return ['09:30', '11:00', '13:00', '14:30', '16:00'];
  }

  // Shanghai Stock Exchange
  if (exchangeUpper.includes('SHG') || exchangeUpper.includes('SSE')) {
    return ['09:30', '11:00', '13:00', '14:00', '15:00'];
  }

  // Toronto Stock Exchange
  if (exchangeUpper.includes('TOR') || exchangeUpper.includes('TSX')) {
    return ['09:30', '11:00', '12:30', '14:00', '16:00'];
  }

  // Singapore Exchange (SGX) - 9:00 AM to 5:00 PM SGT
  if (exchangeUpper.includes('SES') || exchangeUpper.includes('SGX') || exchangeUpper.includes('SIN')) {
    return ['09:00', '11:00', '13:00', '15:00', '17:00'];
  }

  // Default to US market hours for unknown exchanges
  return ['10:30', '12:00', '13:30', '15:00', '16:30'];
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
      // Show 24-hour time for 1D (e.g., "09:30", "16:00")
      if (time) {
        // If time is already provided, ensure it's in 24-hour format
        if (time.includes('AM') || time.includes('PM')) {
          // Convert from 12-hour to 24-hour format
          const isPM = time.includes('PM');
          const timeOnly = time.replace(/\s*(AM|PM)\s*/i, '').trim();
          let [hours, minutes] = timeOnly.split(':').map(Number);

          if (isPM && hours !== 12) {
            hours += 12;
          } else if (!isPM && hours === 12) {
            hours = 0;
          }

          return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
        }
        return time; // Already in 24-hour format
      }
      // Generate from date object in 24-hour format
      return dateObj.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
    case '1M':
    case '6M':
    case 'YTD':
    case '1Y':
      // Show "MMM DD" or "MMM DD, YYYY" if previous year
      if (dateYear < currentYear) {
        return dateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
      }
      return dateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
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
 * @param {string} exchange - Exchange code for determining market hours (1D only)
 * @returns {Array} Timeline points with label and x position
 */
export const generateTimelinePoints = (chartData, chartWidth = null, numPoints = 6, paddingLeft = 60, timeframe = '1Y', exchange = '') => {
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

    if (years.length >= 1) {
      // Position year labels at actual year boundaries (first data point of each year)
      const yearLabels = years.map((year) => {
        // Get first data point for this year from yearMap
        const yearDataPoints = yearMap.get(year);
        const firstPointIndex = yearDataPoints[0].index;

        // Calculate x position based on actual data point index
        const xPosition = paddingLeft + (firstPointIndex * (effectiveWidth / Math.max(1, chartData.length - 1)));

        return { label: year.toString(), x: xPosition };
      });

      // Filter out overlapping labels (keep later year if labels are < 80px apart)
      const filteredLabels = [];
      for (let i = 0; i < yearLabels.length; i++) {
        if (i === 0) {
          filteredLabels.push(yearLabels[i]);
        } else {
          const prevLabel = filteredLabels[filteredLabels.length - 1];
          const currentLabel = yearLabels[i];
          // If labels are more than 80px apart, keep both; otherwise replace with current (keep later year)
          if (currentLabel.x - prevLabel.x >= 80) {
            filteredLabels.push(currentLabel);
          } else {
            // Replace previous with current (keep the later year to avoid overlap)
            filteredLabels[filteredLabels.length - 1] = currentLabel;
          }
        }
      }

      return filteredLabels;
    }
  }

  // Handle 1D timeframe - show market hours based on exchange
  if (timeframe === '1D') {
    // Get market hours for the specific exchange
    const targetTimes = getMarketHours(exchange);
    const { marketOpen, marketClose } = getMarketOpenClose(exchange);
    const timelinePoints = [];

    // Parse market open/close times into minutes since midnight
    const [openHours, openMinutes] = marketOpen.split(':').map(Number);
    const openMinutesSinceMidnight = openHours * 60 + openMinutes;

    const [closeHours, closeMinutes] = marketClose.split(':').map(Number);
    const closeMinutesSinceMidnight = closeHours * 60 + closeMinutes;

    const totalTradingMinutes = closeMinutesSinceMidnight - openMinutesSinceMidnight;

    targetTimes.forEach((targetTime, index) => {
      // Parse target time into minutes since midnight
      const [hours, minutes] = targetTime.split(':').map(Number);
      const targetMinutes = hours * 60 + minutes;

      // Calculate how many minutes into the trading day this label is
      const minutesIntoTradingDay = targetMinutes - openMinutesSinceMidnight;

      // Calculate position as percentage of trading day
      const percentageIntoDay = minutesIntoTradingDay / totalTradingMinutes;
      const xPosition = paddingLeft + (percentageIntoDay * effectiveWidth);

      timelinePoints.push({ label: targetTime, x: xPosition });
    });

    return timelinePoints;
  }

  // For 1M, 6M, YTD, 1Y: Skip first ~10% of data for first label (like 1D skips 09:30-10:30)
  // Data still plots from the beginning, but first X-axis label appears later
  if (timeframe === '1M' || timeframe === '6M' || timeframe === 'YTD' || timeframe === '1Y') {
    // Use smaller offset for 1M to maintain better proportions
    const offsetPercent = timeframe === '1M' ? 0.05 : 0.1;
    const startOffset = Math.floor(chartData.length * offsetPercent);
    const remainingLength = chartData.length - startOffset - 1; // -1 to account for last index

    // Limit numPoints to available data to prevent duplicates with short series
    const effectiveNumPoints = Math.min(numPoints, chartData.length - startOffset);

    // Distribute effectiveNumPoints evenly from startOffset to end
    const selectedIndices = [];
    for (let i = 0; i < effectiveNumPoints; i++) {
      // Guard division by zero when effectiveNumPoints is 1
      const index = startOffset + Math.floor((i * remainingLength) / Math.max(1, effectiveNumPoints - 1));
      selectedIndices.push(Math.min(index, chartData.length - 1));
    }

    // Deduplicate indices using Set to prevent stacked labels
    const uniqueIndices = [...new Set(selectedIndices)];

    const selectedPoints = uniqueIndices.map(index => chartData[index]).filter(Boolean);

    return selectedPoints.map((point, i) => {
      const dataIndex = chartData.indexOf(point);
      const xPosition = paddingLeft + (dataIndex * (effectiveWidth / Math.max(1, chartData.length - 1)));

      let label = '';
      if (point.date) {
        label = formatXAxisLabel(point.date, timeframe, point.time);
      } else {
        label = `Point ${i + 1}`;
      }

      return { label, x: xPosition, dataIndex: chartData.indexOf(point) };
    });
  }

  // Default behavior for other timeframes (not used currently, but kept for safety)
  const step = Math.max(1, Math.floor((chartData.length - 1) / (numPoints - 1)));
  const selectedIndices = [];

  for (let i = 0; i < numPoints - 1; i++) {
    selectedIndices.push(i * step);
  }
  selectedIndices.push(chartData.length - 1);

  const selectedPoints = selectedIndices.map(index => chartData[index]).filter(Boolean);

  return selectedPoints.map((point, i) => {
    // Calculate X position based on actual data point index in chartData
    // This ensures X-axis labels align with hoverable data points
    const dataIndex = chartData.indexOf(point);
    const xPosition = paddingLeft + (dataIndex * (effectiveWidth / Math.max(1, chartData.length - 1)));

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
 * @returns {Object} Object with currentPrice, startPrice, priceChange, priceChangePercent, isValidPercentage
 */
export const calculatePriceChange = (chartData) => {
  if (chartData.length === 0) {
    return {
      currentPrice: null,
      startPrice: null,
      priceChange: 0,
      priceChangePercent: 0,
      isValidPercentage: false
    };
  }

  const currentPoint = chartData[chartData.length - 1];
  const startPoint = chartData[0];

  // Early check for NaN values
  if (!isFinite(startPoint.y) || !isFinite(currentPoint.y)) {
    return {
      currentPrice: currentPoint.y,
      startPrice: startPoint.y,
      priceChange: 0,
      priceChangePercent: null,
      isValidPercentage: false
    };
  }

  const priceChange = currentPoint.y - startPoint.y;

  // Fix Bug 3: Guard against division by zero
  // This prevents Infinity/NaN from leaking into UI state
  let priceChangePercent = 0;
  let isValidPercentage = true;

  if (startPoint.y > 0) {
    // Normal case: positive start price
    priceChangePercent = (priceChange / startPoint.y) * 100;
  } else if (startPoint.y === 0) {
    // Zero start price: percentage change is undefined
    // Started from $0, now has value - mathematically undefined
    priceChangePercent = null;
    isValidPercentage = false;
  } else if (startPoint.y < 0) {
    // Negative start price (unusual but handle robustly)
    // Calculate based on absolute value
    priceChangePercent = (priceChange / Math.abs(startPoint.y)) * -100;
  }

  // Additional safety: Check for NaN/Infinity after calculation
  if (!isFinite(priceChangePercent)) {
    priceChangePercent = null;
    isValidPercentage = false;
  }

  return {
    currentPrice: currentPoint.y,
    startPrice: startPoint.y,
    priceChange,
    priceChangePercent,
    isValidPercentage
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
  
  // Find the index of the actual event date
  const eventIndex = chartData.findIndex(p => {
    // Compare YYYY-MM-DD to avoid timezone-related discrepancies
    const pointDateStr = (new Date(p.date)).toISOString().slice(0,10);
    const eventDateStr = (new Date(event.start_date)).toISOString().slice(0,10);
    return pointDateStr === eventDateStr;
  });

  if (eventIndex === -1) return null;

  // Use the previous data point (1 interval before) if available, otherwise use the event date itself
  const displayIndex = eventIndex > 0 ? eventIndex - 1 : eventIndex;
  const pricePoint = chartData[displayIndex];

  if (!pricePoint || pricePoint.index === undefined) return null;

  // Clamp denominator to at least 1 to prevent division by zero when chartData has single point
  const xPos = paddingLeft + ((pricePoint.index / Math.max(1, chartData.length - 1)) * chartWidth);

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
    const index = chartData.findIndex(pt => {
      const ptDateStr = (new Date(pt.date)).toISOString().slice(0,10);
      const evDateStr = (new Date(event.start_date)).toISOString().slice(0,10);
      return ptDateStr === evDateStr;
    });

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
