import {
  getExchangeTimezone,
  parseExchangeDate,
  parseExchangeTimestamp,
  getWeekStartInTimezone,
  getMonthKeyInTimezone,
  getMonthStartInTimezone
} from '../../utils/formatters';

export interface SentimentHeadline {
  link?: string;
  title?: string;
  sentiment_score?: number;
  relevance_score?: number;
  source?: string;
  provider?: string;
}

export interface ChartDataPoint {
  timestamp?: string;
  date?: string;
  label?: string;
  volume: number;
  sentiment: number;
  score?: number;
  count?: number;
  headlines?: SentimentHeadline[];
}

export interface AggregatedDataPoint extends ChartDataPoint {
  weekStart?: string;
  monthKey?: string;
  monthStart?: string;
}

export const hasTimeComponent = (timestamp: string): boolean => {
  return Boolean(timestamp && typeof timestamp === 'string' && timestamp.includes('T'));
};

export const processAggregatedHeadlines = (
  headlinesList: SentimentHeadline[],
  maxHeadlines: number = 15
): SentimentHeadline[] => {
  if (!headlinesList || headlinesList.length === 0) {
    return [];
  }

  const uniqueHeadlines = new Map<string, SentimentHeadline>();
  headlinesList.forEach((headline: SentimentHeadline) => {
    if (headline && headline.link && !uniqueHeadlines.has(headline.link)) {
      uniqueHeadlines.set(headline.link, headline);
    }
  });

  const scoredHeadlines = Array.from(uniqueHeadlines.values())
    .map((headline: SentimentHeadline) => ({
      ...headline,
      _score: Math.abs(headline.sentiment_score || 0) * (headline.relevance_score || 1)
    }))
    .sort((a, b) => b._score - a._score)
    .slice(0, maxHeadlines)
    .map(({ _score, ...headline }) => headline);

  return scoredHeadlines;
};

export const getSentimentLabel = (sentiment: number): string => {
  if (sentiment >= 0.35) return 'Bullish';
  if (sentiment >= 0.15) return 'Somewhat-Bullish';
  if (sentiment >= -0.15) return 'Neutral';
  if (sentiment >= -0.35) return 'Somewhat-Bearish';
  return 'Bearish';
};

export const getSentimentColor = (sentiment: number): string => {
  if (sentiment >= 0.35) return '#10b981';
  if (sentiment >= 0.15) return '#34d399';
  if (sentiment >= -0.15) return '#9ca3af';
  if (sentiment >= -0.35) return '#fb923c';
  return '#ef4444';
};

interface WeekAggregation {
  timestamp: string;
  volumes: number[];
  sentiments: number[];
  headlinesList: SentimentHeadline[];
}

interface MonthAggregation {
  timestamp: string;
  volumes: number[];
  sentiments: number[];
  headlinesList: SentimentHeadline[];
}

const normalizeDataLabels = (
  dataArray: ChartDataPoint[],
  timeframe: string,
  exchange: string
): AggregatedDataPoint[] => {
  return dataArray.map((point: ChartDataPoint) => {
    if (timeframe === '1D' && point.timestamp) {
      const timezone = getExchangeTimezone(exchange);

      if (hasTimeComponent(point.timestamp)) {
        const date = parseExchangeTimestamp(point.timestamp, exchange);
        return {
          ...point,
          label: date?.toLocaleTimeString('en-US', {
            hour: 'numeric',
            minute: '2-digit',
            hour12: true,
            timeZone: timezone
          }) ?? point.timestamp
        };
      } else {
        const date = parseExchangeDate(point.timestamp, exchange);
        return {
          ...point,
          label: date?.toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            timeZone: timezone
          }) ?? point.timestamp
        };
      }
    }
    return point as AggregatedDataPoint;
  });
};

const aggregateByWeek = (
  rawData: ChartDataPoint[],
  exchange: string
): AggregatedDataPoint[] => {
  const weekMap = new Map<string, WeekAggregation>();

  rawData.forEach((point: ChartDataPoint) => {
    const date = parseExchangeDate(point.timestamp || '', exchange);
    const weekStart = date ? getWeekStartInTimezone(date, exchange) : null;
    const weekKey = weekStart?.toISOString() || '';

    if (weekKey && !weekMap.has(weekKey)) {
      weekMap.set(weekKey, {
        timestamp: weekStart?.toISOString() || '',
        volumes: [],
        sentiments: [],
        headlinesList: []
      });
    }

    const weekData = weekMap.get(weekKey);
    if (weekData) {
      weekData.volumes.push(point.volume);
      weekData.sentiments.push(point.sentiment);
      if (point.headlines && point.headlines.length > 0) {
        weekData.headlinesList.push(...point.headlines);
      }
    }
  });

  const weeklyData: AggregatedDataPoint[] = [];
  weekMap.forEach((weekData: WeekAggregation) => {
    const avgVolume = weekData.volumes.reduce((a, b) => a + b, 0) / weekData.volumes.length;
    const avgSentiment = weekData.sentiments.reduce((a, b) => a + b, 0) / weekData.sentiments.length;

    weeklyData.push({
      timestamp: weekData.timestamp,
      label: new Date(weekData.timestamp).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        timeZone: getExchangeTimezone(exchange)
      }),
      volume: Math.round(avgVolume),
      sentiment: avgSentiment,
      headlines: processAggregatedHeadlines(weekData.headlinesList)
    });
  });

  return weeklyData.sort((a, b) =>
    new Date(a.timestamp || '').getTime() - new Date(b.timestamp || '').getTime()
  );
};

const aggregateByMonth = (
  rawData: ChartDataPoint[],
  exchange: string
): AggregatedDataPoint[] => {
  const monthMap = new Map<string, MonthAggregation>();

  rawData.forEach((point: ChartDataPoint) => {
    const date = parseExchangeDate(point.timestamp || '', exchange);
    const monthKey = date ? getMonthKeyInTimezone(date, exchange) : null;

    if (monthKey && !monthMap.has(monthKey)) {
      const [year, month] = monthKey.split('-').map(Number);
      const monthStart = getMonthStartInTimezone(year, month - 1, exchange);

      monthMap.set(monthKey, {
        timestamp: monthStart?.toISOString() || '',
        volumes: [],
        sentiments: [],
        headlinesList: []
      });
    }

    const monthData = monthMap.get(monthKey || '');
    if (monthData) {
      monthData.volumes.push(point.volume);
      monthData.sentiments.push(point.sentiment);
      if (point.headlines && point.headlines.length > 0) {
        monthData.headlinesList.push(...point.headlines);
      }
    }
  });

  const monthlyData: AggregatedDataPoint[] = [];
  monthMap.forEach((monthData: MonthAggregation) => {
    const avgVolume = monthData.volumes.reduce((a, b) => a + b, 0) / monthData.volumes.length;
    const avgSentiment = monthData.sentiments.reduce((a, b) => a + b, 0) / monthData.sentiments.length;

    monthlyData.push({
      timestamp: monthData.timestamp,
      label: new Date(monthData.timestamp).toLocaleDateString('en-US', {
        month: 'short',
        year: 'numeric',
        timeZone: getExchangeTimezone(exchange)
      }),
      volume: Math.round(avgVolume),
      sentiment: avgSentiment,
      headlines: processAggregatedHeadlines(monthData.headlinesList)
    });
  });

  return monthlyData.sort((a, b) =>
    new Date(a.timestamp || '').getTime() - new Date(b.timestamp || '').getTime()
  );
};

export const aggregateDataByTimeframe = (
  rawData: ChartDataPoint[],
  timeframe: string,
  exchange: string
): AggregatedDataPoint[] => {
  // For short timeframes, use raw data but normalize labels
  if (['1D', '1W', '1M'].includes(timeframe)) {
    return normalizeDataLabels(rawData, timeframe, exchange);
  }

  // For medium timeframes (3M, 6M, YTD), aggregate by week
  if (['3M', '6M', 'YTD'].includes(timeframe)) {
    return aggregateByWeek(rawData, exchange);
  }

  // For long timeframes (1Y), aggregate by month
  if (['1Y'].includes(timeframe)) {
    return aggregateByMonth(rawData, exchange);
  }

  // Default: return raw data
  return rawData;
};

export const getChartTitle = (
  timeframe: string,
  viewMode: 'rolling' | 'daily' | 'weekly' | 'monthly'
): string => {
  if (viewMode === 'monthly' || (['1Y'].includes(timeframe))) {
    return `Sentiment & Volume (${timeframe}) - Monthly Averages`;
  } else if (viewMode === 'weekly' || (['3M', '6M', 'YTD'].includes(timeframe))) {
    return `Sentiment & Volume (${timeframe}) - Weekly Averages`;
  } else if (viewMode === 'rolling') {
    return `Sentiment & Volume (${timeframe}) - Rolling 24h Windows`;
  } else {
    return `Sentiment & Volume (${timeframe}) - Daily Data`;
  }
};

export const calculateXAxisPoints = (
  processedData: AggregatedDataPoint[],
  timeframe: string
): { index: number; label?: string; timestamp?: string }[] => {
  if (!processedData || processedData.length === 0) return [];

  let step: number;

  if (timeframe === '1D') {
    step = Math.max(1, Math.floor(processedData.length / 7));
  } else if (timeframe === '1W') {
    step = Math.max(1, Math.floor(processedData.length / 7));
  } else if (timeframe === '1M') {
    step = Math.max(1, Math.floor(processedData.length / 7));
  } else if (timeframe === '3M') {
    step = 15;
  } else if (timeframe === '6M') {
    step = 30;
  } else if (timeframe === 'YTD' || timeframe === '1Y') {
    step = 60;
  } else {
    step = Math.max(1, Math.floor(processedData.length / 7));
  }

  const points = [];
  for (let i = 0; i < processedData.length; i += step) {
    points.push({
      index: i,
      label: processedData[i].label,
      timestamp: processedData[i].timestamp
    });
  }

  // Always include the last point
  if (points.length > 0 && points[points.length - 1].index !== processedData.length - 1) {
    const lastIndex = processedData.length - 1;
    points.push({
      index: lastIndex,
      label: processedData[lastIndex].label,
      timestamp: processedData[lastIndex].timestamp
    });
  }

  return points;
};
