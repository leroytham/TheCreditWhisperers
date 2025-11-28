// frontend/src/components/ui/EmptyState.tsx

import React from 'react';
import { FileQuestion, LucideIcon } from 'lucide-react';

interface EmptyStateProps {
  title?: string;
  description?: string;
  icon?: LucideIcon;
  action?: React.ReactNode;
}

/**
 * Empty State Component
 * Displayed when there's no data to show
 */
const EmptyState: React.FC<EmptyStateProps> = ({
  title = 'No data found',
  description = 'Try adjusting your filters or search criteria',
  icon: Icon = FileQuestion,
  action,
}) => {
  return (
    <div className="flex flex-col items-center justify-center p-12 text-center">
      <div className="flex items-center justify-center w-16 h-16 bg-gray-100 rounded-full mb-4">
        <Icon className="w-8 h-8 text-gray-400" />
      </div>
      <h3 className="text-lg font-medium text-gray-900 mb-2">{title}</h3>
      <p className="text-sm text-gray-500 max-w-sm mb-6">{description}</p>
      {action && <div>{action}</div>}
    </div>
  );
};

export default EmptyState;
