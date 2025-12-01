import React from 'react';
import { DetailedRelatedNews } from '../../../../shared/components';
import type { NewsArticle, ApiMetadata } from '../../../../../types';

interface NewsTabProps {
  news: NewsArticle[] | null;
  companyName: string;
  ticker: string;
  newsLoading: boolean;
  newsError: string | null;
  apiMetadata?: ApiMetadata;
}

export const NewsTab: React.FC<NewsTabProps> = ({
  news,
  companyName,
  ticker,
  newsLoading,
  newsError,
  apiMetadata
}) => {
  return (
    <div className="">
      <DetailedRelatedNews
        news={news as Parameters<typeof DetailedRelatedNews>[0]['news']}
        displayName={companyName}
        ticker={ticker}
        loading={newsLoading}
        error={newsError}
        apiMetadata={apiMetadata as Parameters<typeof DetailedRelatedNews>[0]['apiMetadata']}
      />
    </div>
  );
};

export default NewsTab;
