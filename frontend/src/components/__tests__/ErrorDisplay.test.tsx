/**
 * ErrorDisplay Component Tests
 *
 * Tests for the error display components including:
 * - ErrorDisplay (main component with variants)
 * - InlineError (compact error display)
 * - EmptyState (no data display)
 */

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ErrorDisplay, { InlineError, EmptyState } from '../ErrorDisplay';

// =============================================================================
// ERRORDISPLAY TESTS
// =============================================================================

describe('ErrorDisplay', () => {
  // ===========================================================================
  // BASIC RENDERING
  // ===========================================================================

  describe('Basic Rendering', () => {
    it('renders with default message', () => {
      render(<ErrorDisplay />);

      expect(screen.getByText('Something went wrong')).toBeInTheDocument();
    });

    it('renders custom message', () => {
      render(<ErrorDisplay message="Custom error message" />);

      expect(screen.getByText('Custom error message')).toBeInTheDocument();
    });

    it('renders with title', () => {
      render(<ErrorDisplay title="Error Title" message="Error message" />);

      expect(screen.getByText('Error Title')).toBeInTheDocument();
      expect(screen.getByText('Error message')).toBeInTheDocument();
    });

    it('has alert role for accessibility', () => {
      render(<ErrorDisplay />);

      expect(screen.getByRole('alert')).toBeInTheDocument();
    });

    it('has aria-live attribute for screen readers', () => {
      render(<ErrorDisplay />);

      expect(screen.getByRole('alert')).toHaveAttribute('aria-live', 'assertive');
    });
  });

  // ===========================================================================
  // VARIANTS
  // ===========================================================================

  describe('Variants', () => {
    it('renders error variant by default', () => {
      const { container } = render(<ErrorDisplay />);

      expect(container.firstChild).toHaveClass('bg-red-50');
      expect(container.firstChild).toHaveClass('border-red-200');
    });

    it('renders warning variant', () => {
      const { container } = render(<ErrorDisplay variant="warning" />);

      expect(container.firstChild).toHaveClass('bg-yellow-50');
      expect(container.firstChild).toHaveClass('border-yellow-200');
    });

    it('renders info variant', () => {
      const { container } = render(<ErrorDisplay variant="info" />);

      expect(container.firstChild).toHaveClass('bg-blue-50');
      expect(container.firstChild).toHaveClass('border-blue-200');
    });

    it('falls back to error variant for unknown variant', () => {
      // Force unknown variant for testing fallback
      const { container } = render(
        <ErrorDisplay variant={'unknown' as 'error'} />
      );

      expect(container.firstChild).toHaveClass('bg-red-50');
    });
  });

  // ===========================================================================
  // ICON
  // ===========================================================================

  describe('Icon', () => {
    it('shows icon by default', () => {
      const { container } = render(<ErrorDisplay />);

      const svg = container.querySelector('svg');
      expect(svg).toBeInTheDocument();
    });

    it('hides icon when showIcon is false', () => {
      const { container } = render(<ErrorDisplay showIcon={false} />);

      const svg = container.querySelector('svg');
      expect(svg).not.toBeInTheDocument();
    });

    it('renders different icon for error variant', () => {
      const { container } = render(<ErrorDisplay variant="error" />);

      const path = container.querySelector('path');
      expect(path).toHaveAttribute('d', expect.stringContaining('M12 8v4m0 4h.01'));
    });

    it('renders different icon for warning variant', () => {
      const { container } = render(<ErrorDisplay variant="warning" />);

      const path = container.querySelector('path');
      expect(path).toHaveAttribute('d', expect.stringContaining('M12 9v2m0 4h.01'));
    });

    it('renders different icon for info variant', () => {
      const { container } = render(<ErrorDisplay variant="info" />);

      const path = container.querySelector('path');
      expect(path).toHaveAttribute('d', expect.stringContaining('M13 16h-1v-4h-1'));
    });

    it('icon has aria-hidden for accessibility', () => {
      const { container } = render(<ErrorDisplay />);

      const svg = container.querySelector('svg');
      expect(svg).toHaveAttribute('aria-hidden', 'true');
    });
  });

  // ===========================================================================
  // RETRY BUTTON
  // ===========================================================================

  describe('Retry Button', () => {
    it('does not render retry button when onRetry is not provided', () => {
      render(<ErrorDisplay />);

      expect(screen.queryByRole('button')).not.toBeInTheDocument();
    });

    it('renders retry button when onRetry is provided', () => {
      render(<ErrorDisplay onRetry={() => {}} />);

      expect(screen.getByRole('button', { name: 'Try Again' })).toBeInTheDocument();
    });

    it('uses custom retry text', () => {
      render(<ErrorDisplay onRetry={() => {}} retryText="Reload" />);

      expect(screen.getByRole('button', { name: 'Reload' })).toBeInTheDocument();
    });

    it('calls onRetry when button is clicked', async () => {
      const onRetry = jest.fn();
      render(<ErrorDisplay onRetry={onRetry} />);

      await userEvent.click(screen.getByRole('button'));

      expect(onRetry).toHaveBeenCalledTimes(1);
    });

    it('applies variant color to retry button', () => {
      render(<ErrorDisplay variant="error" onRetry={() => {}} />);

      const button = screen.getByRole('button');
      expect(button).toHaveClass('bg-red-600');
    });

    it('applies warning variant color to retry button', () => {
      render(<ErrorDisplay variant="warning" onRetry={() => {}} />);

      const button = screen.getByRole('button');
      expect(button).toHaveClass('bg-yellow-600');
    });

    it('applies info variant color to retry button', () => {
      render(<ErrorDisplay variant="info" onRetry={() => {}} />);

      const button = screen.getByRole('button');
      expect(button).toHaveClass('bg-blue-600');
    });
  });

  // ===========================================================================
  // FULLSCREEN MODE
  // ===========================================================================

  describe('Fullscreen Mode', () => {
    it('renders inline by default', () => {
      const { container } = render(<ErrorDisplay />);

      expect(container.firstChild).not.toHaveClass('min-h-screen');
    });

    it('renders fullscreen when fullScreen is true', () => {
      const { container } = render(<ErrorDisplay fullScreen />);

      expect(container.firstChild).toHaveClass('min-h-screen');
      expect(container.firstChild).toHaveClass('flex');
      expect(container.firstChild).toHaveClass('items-center');
      expect(container.firstChild).toHaveClass('justify-center');
    });

    it('wraps content in max-width container when fullscreen', () => {
      const { container } = render(<ErrorDisplay fullScreen />);

      const wrapper = container.querySelector('.max-w-md');
      expect(wrapper).toBeInTheDocument();
    });
  });

  // ===========================================================================
  // CUSTOM CLASSNAME
  // ===========================================================================

  describe('Custom ClassName', () => {
    it('applies custom className', () => {
      const { container } = render(<ErrorDisplay className="custom-class" />);

      expect(container.querySelector('.custom-class')).toBeInTheDocument();
    });

    it('preserves default classes with custom className', () => {
      const { container } = render(
        <ErrorDisplay className="custom-class" variant="error" />
      );

      const element = container.querySelector('.custom-class');
      expect(element).toHaveClass('bg-red-50');
    });
  });
});

// =============================================================================
// INLINEERROR TESTS
// =============================================================================

describe('InlineError', () => {
  // ===========================================================================
  // BASIC RENDERING
  // ===========================================================================

  describe('Basic Rendering', () => {
    it('renders message', () => {
      render(<InlineError message="Error occurred" />);

      expect(screen.getByText('Error occurred')).toBeInTheDocument();
    });

    it('has alert role', () => {
      render(<InlineError message="Error" />);

      expect(screen.getByRole('alert')).toBeInTheDocument();
    });

    it('renders with red color scheme', () => {
      const { container } = render(<InlineError message="Error" />);

      expect(container.firstChild).toHaveClass('text-red-600');
    });
  });

  // ===========================================================================
  // MESSAGE ENHANCEMENT
  // ===========================================================================

  describe('Message Enhancement', () => {
    it('enhances "failed to load" messages', () => {
      render(<InlineError message="Failed to load data" />);

      expect(
        screen.getByText(/Please check your internet connection/)
      ).toBeInTheDocument();
    });

    it('enhances "timeout" messages', () => {
      render(<InlineError message="Request timeout" />);

      expect(
        screen.getByText(/server is taking longer than expected/)
      ).toBeInTheDocument();
    });

    it('enhances "unauthorized" messages', () => {
      render(<InlineError message="Unauthorized access" />);

      expect(screen.getByText(/session may have expired/)).toBeInTheDocument();
    });

    it('enhances "401" messages', () => {
      render(<InlineError message="Error 401" />);

      expect(screen.getByText(/session may have expired/)).toBeInTheDocument();
    });

    it('enhances "not found" messages', () => {
      render(<InlineError message="Resource not found" />);

      expect(
        screen.getByText(/data may have been moved or deleted/)
      ).toBeInTheDocument();
    });

    it('enhances "404" messages', () => {
      render(<InlineError message="Error 404" />);

      expect(
        screen.getByText(/data may have been moved or deleted/)
      ).toBeInTheDocument();
    });

    it('does not enhance generic messages', () => {
      render(<InlineError message="Generic error" />);

      expect(screen.getByText('Generic error')).toBeInTheDocument();
      expect(
        screen.queryByText(/Please check your internet connection/)
      ).not.toBeInTheDocument();
    });
  });

  // ===========================================================================
  // DETAILS
  // ===========================================================================

  describe('Details', () => {
    it('renders details when provided', () => {
      render(<InlineError message="Error" details="Additional context" />);

      expect(screen.getByText('Additional context')).toBeInTheDocument();
    });

    it('does not render details when null', () => {
      render(<InlineError message="Error" details={null} />);

      const detailsElement = document.querySelector('.text-xs.text-red-500');
      expect(detailsElement).not.toBeInTheDocument();
    });

    it('applies smaller text styling to details', () => {
      render(<InlineError message="Error" details="Details" />);

      const detailsElement = screen.getByText('Details');
      expect(detailsElement).toHaveClass('text-xs');
      expect(detailsElement).toHaveClass('text-red-500');
    });
  });

  // ===========================================================================
  // RETRY BUTTON
  // ===========================================================================

  describe('Retry Button', () => {
    it('does not render retry when onRetry is not provided', () => {
      render(<InlineError message="Error" />);

      expect(screen.queryByRole('button')).not.toBeInTheDocument();
    });

    it('renders retry button when onRetry is provided', () => {
      render(<InlineError message="Error" onRetry={() => {}} />);

      expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument();
    });

    it('calls onRetry when clicked', async () => {
      const onRetry = jest.fn();
      render(<InlineError message="Error" onRetry={onRetry} />);

      await userEvent.click(screen.getByRole('button'));

      expect(onRetry).toHaveBeenCalledTimes(1);
    });

    it('has underline styling', () => {
      render(<InlineError message="Error" onRetry={() => {}} />);

      const button = screen.getByRole('button');
      expect(button).toHaveClass('underline');
    });
  });

  // ===========================================================================
  // CUSTOM CLASSNAME
  // ===========================================================================

  describe('Custom ClassName', () => {
    it('applies custom className', () => {
      const { container } = render(
        <InlineError message="Error" className="custom-class" />
      );

      expect(container.firstChild).toHaveClass('custom-class');
    });
  });
});

// =============================================================================
// EMPTYSTATE TESTS
// =============================================================================

describe('EmptyState', () => {
  // ===========================================================================
  // BASIC RENDERING
  // ===========================================================================

  describe('Basic Rendering', () => {
    it('renders with default title', () => {
      render(<EmptyState />);

      expect(screen.getByText('No data available')).toBeInTheDocument();
    });

    it('renders custom title', () => {
      render(<EmptyState title="Custom Title" />);

      expect(screen.getByText('Custom Title')).toBeInTheDocument();
    });

    it('renders message when provided', () => {
      render(<EmptyState message="Additional message" />);

      expect(screen.getByText('Additional message')).toBeInTheDocument();
    });

    it('does not render message when empty', () => {
      render(<EmptyState message="" />);

      // Only title should be present
      expect(screen.getByText('No data available')).toBeInTheDocument();
    });

    it('centers content', () => {
      const { container } = render(<EmptyState />);

      expect(container.firstChild).toHaveClass('text-center');
    });
  });

  // ===========================================================================
  // ICON
  // ===========================================================================

  describe('Icon', () => {
    it('renders default icon', () => {
      const { container } = render(<EmptyState />);

      const svg = container.querySelector('svg');
      expect(svg).toBeInTheDocument();
      expect(svg).toHaveClass('text-gray-400');
    });

    it('renders custom icon when provided', () => {
      const customIcon = <span data-testid="custom-icon">Custom Icon</span>;
      render(<EmptyState icon={customIcon} />);

      expect(screen.getByTestId('custom-icon')).toBeInTheDocument();
    });

    it('replaces default icon with custom icon', () => {
      const customIcon = <span data-testid="custom-icon">Custom Icon</span>;
      const { container } = render(<EmptyState icon={customIcon} />);

      // Custom icon should be present
      expect(screen.getByTestId('custom-icon')).toBeInTheDocument();
      // Default svg should not be present
      expect(container.querySelector('svg.text-gray-400')).not.toBeInTheDocument();
    });
  });

  // ===========================================================================
  // ACTION BUTTON
  // ===========================================================================

  describe('Action Button', () => {
    it('does not render action button when action is not provided', () => {
      render(<EmptyState />);

      expect(screen.queryByRole('button')).not.toBeInTheDocument();
    });

    it('does not render action button when actionText is not provided', () => {
      render(<EmptyState action={() => {}} />);

      expect(screen.queryByRole('button')).not.toBeInTheDocument();
    });

    it('renders action button when both action and actionText provided', () => {
      render(<EmptyState action={() => {}} actionText="Take Action" />);

      expect(screen.getByRole('button', { name: 'Take Action' })).toBeInTheDocument();
    });

    it('calls action when button is clicked', async () => {
      const action = jest.fn();
      render(<EmptyState action={action} actionText="Click Me" />);

      await userEvent.click(screen.getByRole('button'));

      expect(action).toHaveBeenCalledTimes(1);
    });

    it('has primary button styling', () => {
      render(<EmptyState action={() => {}} actionText="Action" />);

      const button = screen.getByRole('button');
      expect(button).toHaveClass('bg-blue-600');
      expect(button).toHaveClass('text-white');
    });
  });

  // ===========================================================================
  // CUSTOM CLASSNAME
  // ===========================================================================

  describe('Custom ClassName', () => {
    it('applies custom className', () => {
      const { container } = render(<EmptyState className="custom-class" />);

      expect(container.firstChild).toHaveClass('custom-class');
    });

    it('preserves default padding with custom className', () => {
      const { container } = render(<EmptyState className="custom-class" />);

      expect(container.firstChild).toHaveClass('py-12');
    });
  });
});
