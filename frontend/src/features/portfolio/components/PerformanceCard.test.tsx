/**
 * Test Suite for PerformanceCard Component
 * Tests the fixed benchmark bar rendering with correct placement, colors, and scaling
 */

import React from 'react';
import { render, screen, within, waitFor, fireEvent } from '@testing-library/react';
import { act } from 'react';
import '@testing-library/jest-dom';
import PerformanceCard from './PerformanceCard';
import { useSelectedAccount } from '../../../hooks/useSelectedAccount';
import { usePortfolioOverview } from '../hooks/usePortfolioOverview';

// Mock the hooks
jest.mock('../../../hooks/useSelectedAccount');
jest.mock('../hooks/usePortfolioOverview');

const mockUseSelectedAccount = useSelectedAccount as jest.Mock;
const mockUsePortfolioOverview = usePortfolioOverview as jest.Mock;

describe('PerformanceCard', () => {
  const mockOnViewPerformance = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();

    // Default mock for useSelectedAccount
    mockUseSelectedAccount.mockReturnValue({
      selectedAccount: { accountName: 'Test Account', accountNumber: '123' }
    });
  });

  describe('Benchmark Bar Rendering - Bug Fixes', () => {
    it('should render S&P 500 bar in correct section when portfolio positive and S&P 500 negative', () => {
      // Portfolio +5%, S&P 500 -3%
      const mockData = {
        performance: [
          {
            period: 'MTD',
            return: 5.23,
            sp500: -3.45,
            isPositive: true, // Backend only checks portfolio
            outperformance: 8.68,
            portfolio_value_current: 105230,
            holdings_count: 5
          }
        ],
        account_name: 'Test Account',
        calculation_date: '2024-01-15'
      };

      mockUsePortfolioOverview.mockReturnValue({
        performance: mockData,
        performanceLoading: false,
        performanceError: null,
        refetchPerformance: jest.fn()
      });

      const { container } = render(<PerformanceCard onViewPerformance={mockOnViewPerformance} />);

      // Portfolio bar should be in positive section (top)
      const positiveSection = container.querySelector('.flex-1.relative.flex.justify-around.items-end') as HTMLElement;
      expect(positiveSection).toBeInTheDocument();
      expect(within(positiveSection).getByText('+5.23%')).toBeInTheDocument();

      // S&P 500 bar should be in negative section (bottom) with correct label
      const negativeSection = container.querySelector('.flex-1.relative.flex.justify-around.items-start') as HTMLElement;
      expect(negativeSection).toBeInTheDocument();
      expect(within(negativeSection).getByText('-3.45%')).toBeInTheDocument();

      // Should NOT have "+-3.45%" (the bug we fixed)
      expect(screen.queryByText('+-3.45%')).not.toBeInTheDocument();
    });

    it('should render S&P 500 bar in correct section when portfolio negative and S&P 500 positive', () => {
      // Portfolio -5%, S&P 500 +3%
      const mockData = {
        performance: [
          {
            period: 'YTD',
            return: -5.12,
            sp500: 3.78,
            isPositive: false,
            outperformance: -8.90,
            portfolio_value_current: 94880,
            holdings_count: 8
          }
        ],
        account_name: 'Test Account',
        calculation_date: '2024-01-15'
      };

      mockUsePortfolioOverview.mockReturnValue({
        performance: mockData,
        performanceLoading: false,
        performanceError: null,
        refetchPerformance: jest.fn()
      });

      const { container } = render(<PerformanceCard onViewPerformance={mockOnViewPerformance} />);

      // Portfolio bar should be in negative section (bottom)
      const negativeSection = container.querySelector('.flex-1.relative.flex.justify-around.items-start') as HTMLElement;
      expect(negativeSection).toBeInTheDocument();
      expect(within(negativeSection).getByText('-5.12%')).toBeInTheDocument();

      // S&P 500 bar should be in positive section (top)
      const positiveSection = container.querySelector('.flex-1.relative.flex.justify-around.items-end') as HTMLElement;
      expect(positiveSection).toBeInTheDocument();
      expect(within(positiveSection).getByText('+3.78%')).toBeInTheDocument();
    });

    it('should render both bars positive when both positive', () => {
      const mockData = {
        performance: [
          {
            period: '1Y',
            return: 12.34,
            sp500: 8.90,
            isPositive: true,
            outperformance: 3.44,
            portfolio_value_current: 112340,
            holdings_count: 10
          }
        ],
        account_name: 'Test Account',
        calculation_date: '2024-01-15'
      };

      mockUsePortfolioOverview.mockReturnValue({
        performance: mockData,
        performanceLoading: false,
        performanceError: null,
        refetchPerformance: jest.fn()
      });

      const { container } = render(<PerformanceCard onViewPerformance={mockOnViewPerformance} />);

      // Both should be in positive section - query only the visible <p> labels
      const positiveSection = container.querySelector('.flex-1.relative.flex.justify-around.items-end') as HTMLElement;
      const labels = positiveSection.querySelectorAll('p.font-bold');
      const labelTexts = Array.from(labels).map(label => label.textContent);

      expect(labelTexts.some(text => text.match(/\+12\.34%/))).toBe(true);
      expect(labelTexts.some(text => text.match(/\+8\.9%/))).toBe(true); // JavaScript drops trailing zero
    });

    it('should render both bars negative when both negative', () => {
      const mockData = {
        performance: [
          {
            period: 'MTD',
            return: -8.23,
            sp500: -4.56,
            isPositive: false,
            outperformance: -3.67,
            portfolio_value_current: 91770,
            holdings_count: 6
          }
        ],
        account_name: 'Test Account',
        calculation_date: '2024-01-15'
      };

      mockUsePortfolioOverview.mockReturnValue({
        performance: mockData,
        performanceLoading: false,
        performanceError: null,
        refetchPerformance: jest.fn()
      });

      const { container } = render(<PerformanceCard onViewPerformance={mockOnViewPerformance} />);

      // Both should be in negative section
      const negativeSection = container.querySelector('.flex-1.relative.flex.justify-around.items-start') as HTMLElement;
      expect(within(negativeSection).getByText('-8.23%')).toBeInTheDocument();
      expect(within(negativeSection).getByText('-4.56%')).toBeInTheDocument();
    });
  });

  describe('Label Formatting', () => {
    it('should not display "+-X%" for negative S&P 500 in positive section', () => {
      const mockData = {
        performance: [
          {
            period: 'MTD',
            return: 5.0,
            sp500: -2.5,
            isPositive: true,
            outperformance: 7.5,
            portfolio_value_current: 105000,
            holdings_count: 5
          }
        ]
      };

      mockUsePortfolioOverview.mockReturnValue({
        performance: mockData,
        performanceLoading: false,
        performanceError: null,
        refetchPerformance: jest.fn()
      });

      const { container } = render(<PerformanceCard onViewPerformance={mockOnViewPerformance} />);

      // Should display "-2.5%" correctly, not "+-2.5%"
      const labels = container.querySelectorAll('p.font-bold');
      const labelTexts = Array.from(labels).map(label => label.textContent);

      expect(labelTexts.some(text => text.match(/-2\.5%/))).toBe(true);
      expect(labelTexts.some(text => text.match(/\+-2\.5%/))).toBe(false);
    });

    it('should format positive benchmark values with "+" prefix', () => {
      const mockData = {
        performance: [
          {
            period: 'YTD',
            return: 3.5,
            sp500: 4.25,
            isPositive: true,
            outperformance: -0.75,
            portfolio_value_current: 103500,
            holdings_count: 7
          }
        ]
      };

      mockUsePortfolioOverview.mockReturnValue({
        performance: mockData,
        performanceLoading: false,
        performanceError: null,
        refetchPerformance: jest.fn()
      });

      const { container } = render(<PerformanceCard onViewPerformance={mockOnViewPerformance} />);

      const labels = container.querySelectorAll('p.font-bold');
      const labelTexts = Array.from(labels).map(label => label.textContent);

      expect(labelTexts.some(text => text.match(/\+4\.25%/))).toBe(true);
    });
  });

  describe('Bar Height Scaling', () => {
    it('should scale bars dynamically based on maximum value in dataset', () => {
      const mockData = {
        performance: [
          {
            period: 'MTD',
            return: 50.00, // High return
            sp500: 5.00,
            isPositive: true,
            outperformance: 45.00,
            portfolio_value_current: 150000,
            holdings_count: 5
          },
          {
            period: 'YTD',
            return: 10.00,
            sp500: 8.00,
            isPositive: true,
            outperformance: 2.00,
            portfolio_value_current: 110000,
            holdings_count: 5
          }
        ],
        account_name: 'Test Account',
        calculation_date: '2024-01-15'
      };

      mockUsePortfolioOverview.mockReturnValue({
        performance: mockData,
        performanceLoading: false,
        performanceError: null,
        refetchPerformance: jest.fn()
      });

      const { container } = render(<PerformanceCard onViewPerformance={mockOnViewPerformance} />);

      // Y-axis should show dynamic max (rounded to nearest 10)
      const yAxisLabels = container.querySelectorAll('.text-gray-600.font-semibold span, .text-gray-800.font-bold');
      const yAxisTexts = Array.from(yAxisLabels).map(label => label.textContent);

      expect(yAxisTexts.some(text => text.match(/\+50%/))).toBe(true); // Not fixed "+30%"
      expect(yAxisTexts.some(text => text.match(/\+30%/))).toBe(false);

      // Bars should be rendered (check for bar containers)
      const positiveSection = container.querySelector('.flex-1.relative.flex.justify-around.items-end') as HTMLElement;
      const bars = within(positiveSection).getAllByTitle(/Portfolio:|S&P 500:/);
      expect(bars.length).toBeGreaterThan(0);
    });

    it('should distinguish small returns visually', () => {
      const mockData = {
        performance: [
          {
            period: 'Period1',
            return: 1.00,
            sp500: 0.50,
            isPositive: true,
            outperformance: 0.50,
            portfolio_value_current: 101000,
            holdings_count: 5
          },
          {
            period: 'Period2',
            return: 3.00,
            sp500: 2.50,
            isPositive: true,
            outperformance: 0.50,
            portfolio_value_current: 103000,
            holdings_count: 5
          }
        ],
        account_name: 'Test Account',
        calculation_date: '2024-01-15'
      };

      mockUsePortfolioOverview.mockReturnValue({
        performance: mockData,
        performanceLoading: false,
        performanceError: null,
        refetchPerformance: jest.fn()
      });

      const { container } = render(<PerformanceCard onViewPerformance={mockOnViewPerformance} />);

      // Both periods should have bars rendered
      const labels = container.querySelectorAll('p.font-bold');
      const labelTexts = Array.from(labels).map(label => label.textContent);

      expect(labelTexts.some(text => text.match(/\+1%/))).toBe(true); // Drops trailing zeros
      expect(labelTexts.some(text => text.match(/\+3%/))).toBe(true);

      // Y-axis should adapt to small range (3% rounds to nearest 5 = 5%)
      const yAxisLabels = container.querySelectorAll('.text-gray-600.font-semibold span, .text-gray-800.font-bold');
      const yAxisTexts = Array.from(yAxisLabels).map(label => label.textContent);
      expect(yAxisTexts.some(text => text.match(/\+5%/))).toBe(true);
    });
  });

  describe('Color Classes', () => {
    it('should apply green color to positive S&P 500 values', () => {
      const mockData = {
        performance: [
          {
            period: 'MTD',
            return: 5.0,
            sp500: 3.5,
            isPositive: true,
            outperformance: 1.5,
            portfolio_value_current: 105000,
            holdings_count: 5
          }
        ]
      };

      mockUsePortfolioOverview.mockReturnValue({
        performance: mockData,
        performanceLoading: false,
        performanceError: null,
        refetchPerformance: jest.fn()
      });

      const { container } = render(<PerformanceCard onViewPerformance={mockOnViewPerformance} />);

      // Find the S&P 500 label (second <p> in positive section)
      const positiveSection = container.querySelector('.flex-1.relative.flex.justify-around.items-end') as HTMLElement;
      const sp500Labels = positiveSection.querySelectorAll('p.text-green-600');

      expect(sp500Labels.length).toBeGreaterThan(0);
      expect(sp500Labels[sp500Labels.length - 1].textContent).toMatch(/\+3\.5%/);
    });

    it('should apply red color to negative S&P 500 values', () => {
      const mockData = {
        performance: [
          {
            period: 'MTD',
            return: 5.0,
            sp500: -2.5,
            isPositive: true,
            outperformance: 7.5,
            portfolio_value_current: 105000,
            holdings_count: 5
          }
        ]
      };

      mockUsePortfolioOverview.mockReturnValue({
        performance: mockData,
        performanceLoading: false,
        performanceError: null,
        refetchPerformance: jest.fn()
      });

      const { container } = render(<PerformanceCard onViewPerformance={mockOnViewPerformance} />);

      // Find the S&P 500 label (in negative section)
      const negativeSection = container.querySelector('.flex-1.relative.flex.justify-around.items-start') as HTMLElement;
      const sp500Labels = negativeSection.querySelectorAll('p.text-red-600');

      expect(sp500Labels.length).toBeGreaterThan(0);
      expect(sp500Labels[0].textContent).toMatch(/-2\.5%/);
    });
  });

  describe('Loading and Error States', () => {
    it('should display loading spinner when loading', () => {
      mockUsePortfolioOverview.mockReturnValue({
        performance: null,
        performanceLoading: true,
        performanceError: null,
        refetchPerformance: jest.fn()
      });

      render(<PerformanceCard onViewPerformance={mockOnViewPerformance} />);

      expect(screen.getByText('Calculating performance...')).toBeInTheDocument();
    });

    it('should display error message when error occurs', () => {
      mockUsePortfolioOverview.mockReturnValue({
        performance: null,
        performanceLoading: false,
        performanceError: { message: 'Failed to fetch data' },
        refetchPerformance: jest.fn()
      });

      render(<PerformanceCard onViewPerformance={mockOnViewPerformance} />);

      expect(screen.getByText('Failed to fetch data')).toBeInTheDocument();
    });
  });

  describe('Bug Fix #1: Adaptive Axis Rounding', () => {
    it('should use 1% rounding for very small returns (< 1%)', () => {
      const mockData = {
        performance: [
          {
            period: 'MTD',
            return: 0.2,
            sp500: 0.1,
            isPositive: true,
            outperformance: 0.1,
            portfolio_value_current: 100200,
            holdings_count: 5
          }
        ],
        account_name: 'Test Account',
        calculation_date: '2024-01-15'
      };

      mockUsePortfolioOverview.mockReturnValue({
        performance: mockData,
        performanceLoading: false,
        performanceError: null,
        refetchPerformance: jest.fn()
      });

      const { container } = render(<PerformanceCard onViewPerformance={mockOnViewPerformance} />);

      // Y-axis should show ±1%, not ±10%
      const yAxisLabels = container.querySelectorAll('.text-gray-600.font-semibold span, .text-gray-800.font-bold');
      const yAxisTexts = Array.from(yAxisLabels).map(label => label.textContent);

      expect(yAxisTexts.some(text => text.match(/\+1%/))).toBe(true);
      expect(yAxisTexts.some(text => text.match(/\+10%/))).toBe(false);
    });

    it('should use 5% rounding for medium returns (1-5%)', () => {
      const mockData = {
        performance: [
          {
            period: 'YTD',
            return: 3.2,
            sp500: 2.8,
            isPositive: true,
            outperformance: 0.4,
            portfolio_value_current: 103200,
            holdings_count: 5
          }
        ],
        account_name: 'Test Account',
        calculation_date: '2024-01-15'
      };

      mockUsePortfolioOverview.mockReturnValue({
        performance: mockData,
        performanceLoading: false,
        performanceError: null,
        refetchPerformance: jest.fn()
      });

      const { container } = render(<PerformanceCard onViewPerformance={mockOnViewPerformance} />);

      // Y-axis should show ±5%
      const yAxisLabels = container.querySelectorAll('.text-gray-600.font-semibold span, .text-gray-800.font-bold');
      const yAxisTexts = Array.from(yAxisLabels).map(label => label.textContent);

      expect(yAxisTexts.some(text => text.match(/\+5%/))).toBe(true);
    });

    it('should use 10% rounding for large returns (> 5%)', () => {
      const mockData = {
        performance: [
          {
            period: '1Y',
            return: 12.5,
            sp500: 8.3,
            isPositive: true,
            outperformance: 4.2,
            portfolio_value_current: 112500,
            holdings_count: 5
          }
        ],
        account_name: 'Test Account',
        calculation_date: '2024-01-15'
      };

      mockUsePortfolioOverview.mockReturnValue({
        performance: mockData,
        performanceLoading: false,
        performanceError: null,
        refetchPerformance: jest.fn()
      });

      const { container } = render(<PerformanceCard onViewPerformance={mockOnViewPerformance} />);

      // Y-axis should show ±20% (rounded to nearest 10)
      const yAxisLabels = container.querySelectorAll('.text-gray-600.font-semibold span, .text-gray-800.font-bold');
      const yAxisTexts = Array.from(yAxisLabels).map(label => label.textContent);

      expect(yAxisTexts.some(text => text.match(/\+20%/))).toBe(true);
    });
  });

  describe('Bug Fix #2: S&P Toggle Recalculates Scale', () => {
    it('should recalculate scale when S&P 500 is toggled off', async () => {
      const mockData = {
        performance: [
          {
            period: 'MTD',
            return: 5.0,
            sp500: 50.0, // Large S&P spike
            isPositive: true,
            outperformance: -45.0,
            portfolio_value_current: 105000,
            holdings_count: 5
          }
        ],
        account_name: 'Test Account',
        calculation_date: '2024-01-15'
      };

      mockUsePortfolioOverview.mockReturnValue({
        performance: mockData,
        performanceLoading: false,
        performanceError: null,
        refetchPerformance: jest.fn()
      });

      const { container } = render(<PerformanceCard onViewPerformance={mockOnViewPerformance} />);

      // Initially with S&P 500 shown, axis should be scaled to 50% (nearest 10 = 50)
      let yAxisLabels = container.querySelectorAll('.text-gray-600.font-semibold span, .text-gray-800.font-bold');
      let yAxisTexts = Array.from(yAxisLabels).map(label => label.textContent);
      expect(yAxisTexts.some(text => text.match(/\+50%/))).toBe(true);

      // Toggle S&P 500 off
      const toggleButton = screen.getByText(/S&P 500 Comparison|Show S&P 500/);
      fireEvent.click(toggleButton);

      // Wait for state update and re-render - check that scale has changed
      await waitFor(() => {
        yAxisLabels = container.querySelectorAll('.text-gray-600.font-semibold span, .text-gray-800.font-bold');
        yAxisTexts = Array.from(yAxisLabels).map(label => label.textContent);
        // After toggle, +50% should be gone (indicates scale recalculation)
        expect(yAxisTexts.some(text => text.match(/\+50%/))).toBe(false);
      });

      // Verify +5% is now shown (adaptive rounding of 5.0)
      expect(yAxisTexts.some(text => text.match(/\+5%/))).toBe(true);
    });

    it('should apply smooth transitions to bar heights', () => {
      const mockData = {
        performance: [
          {
            period: 'MTD',
            return: 5.0,
            sp500: 3.0,
            isPositive: true,
            outperformance: 2.0,
            portfolio_value_current: 105000,
            holdings_count: 5
          }
        ],
        account_name: 'Test Account',
        calculation_date: '2024-01-15'
      };

      mockUsePortfolioOverview.mockReturnValue({
        performance: mockData,
        performanceLoading: false,
        performanceError: null,
        refetchPerformance: jest.fn()
      });

      const { container } = render(<PerformanceCard onViewPerformance={mockOnViewPerformance} />);

      // Find bar elements and check for transition style
      const positiveSection = container.querySelector('.flex-1.relative.flex.justify-around.items-end') as HTMLElement;
      const bars = positiveSection.querySelectorAll('div[title*="Portfolio:"], div[title*="S&P 500:"]');

      bars.forEach(bar => {
        const style = bar.getAttribute('style');
        expect(style).toContain('transition');
        expect(style).toContain('300ms');
        expect(style).toContain('ease');
      });
    });
  });

  describe('Bug Fix #3: Zero Return Handling', () => {
    it('should render zero portfolio return as thin gray line with plain "0%" label', () => {
      const mockData = {
        performance: [
          {
            period: 'MTD',
            return: 0.0,
            sp500: 5.0,
            isPositive: false, // Backend marks 0 as non-positive
            outperformance: -5.0,
            portfolio_value_current: 100000,
            holdings_count: 5
          }
        ],
        account_name: 'Test Account',
        calculation_date: '2024-01-15'
      };

      mockUsePortfolioOverview.mockReturnValue({
        performance: mockData,
        performanceLoading: false,
        performanceError: null,
        refetchPerformance: jest.fn()
      });

      const { container } = render(<PerformanceCard onViewPerformance={mockOnViewPerformance} />);

      // Should show plain "0%" label in positive section
      const positiveSection = container.querySelector('.flex-1.relative.flex.justify-around.items-end') as HTMLElement;
      expect(within(positiveSection).getByText('0%')).toBeInTheDocument();

      // Should NOT show "+0%" or "-0%"
      expect(screen.queryByText('+0%')).not.toBeInTheDocument();
      expect(screen.queryByText('-0%')).not.toBeInTheDocument();

      // Label should have gray color (neutral)
      const zeroLabel = within(positiveSection).getByText('0%');
      expect(zeroLabel).toHaveClass('text-gray-600');
    });

    it('should render zero S&P 500 return as thin gray line with plain "0%" label', () => {
      const mockData = {
        performance: [
          {
            period: 'YTD',
            return: 5.0,
            sp500: 0.0,
            isPositive: true,
            outperformance: 5.0,
            portfolio_value_current: 105000,
            holdings_count: 5
          }
        ],
        account_name: 'Test Account',
        calculation_date: '2024-01-15'
      };

      mockUsePortfolioOverview.mockReturnValue({
        performance: mockData,
        performanceLoading: false,
        performanceError: null,
        refetchPerformance: jest.fn()
      });

      const { container } = render(<PerformanceCard onViewPerformance={mockOnViewPerformance} />);

      // S&P 500 zero should show "0%" in positive section
      const positiveSection = container.querySelector('.flex-1.relative.flex.justify-around.items-end') as HTMLElement;
      const labels = within(positiveSection).getAllByText('0%');
      expect(labels.length).toBeGreaterThan(0);

      // At least one label should be gray (S&P 500 zero)
      const grayLabels = labels.filter(label => label.className.includes('text-gray-600'));
      expect(grayLabels.length).toBeGreaterThan(0);
    });

    it('should not render zero return in negative section', () => {
      const mockData = {
        performance: [
          {
            period: 'MTD',
            return: 0.0,
            sp500: -3.0,
            isPositive: false,
            outperformance: 3.0,
            portfolio_value_current: 100000,
            holdings_count: 5
          }
        ],
        account_name: 'Test Account',
        calculation_date: '2024-01-15'
      };

      mockUsePortfolioOverview.mockReturnValue({
        performance: mockData,
        performanceLoading: false,
        performanceError: null,
        refetchPerformance: jest.fn()
      });

      const { container } = render(<PerformanceCard onViewPerformance={mockOnViewPerformance} />);

      // Zero should be in positive section, not negative
      const negativeSection = container.querySelector('.flex-1.relative.flex.justify-around.items-start') as HTMLElement;
      expect(within(negativeSection).queryByText('0%')).not.toBeInTheDocument();

      // Zero should be in positive section
      const positiveSection = container.querySelector('.flex-1.relative.flex.justify-around.items-end') as HTMLElement;
      expect(within(positiveSection).getByText('0%')).toBeInTheDocument();
    });

    it('should handle both portfolio and S&P 500 being zero', () => {
      const mockData = {
        performance: [
          {
            period: 'MTD',
            return: 0.0,
            sp500: 0.0,
            isPositive: false,
            outperformance: 0.0,
            portfolio_value_current: 100000,
            holdings_count: 5
          }
        ],
        account_name: 'Test Account',
        calculation_date: '2024-01-15'
      };

      mockUsePortfolioOverview.mockReturnValue({
        performance: mockData,
        performanceLoading: false,
        performanceError: null,
        refetchPerformance: jest.fn()
      });

      const { container } = render(<PerformanceCard onViewPerformance={mockOnViewPerformance} />);

      // Both should show "0%" in positive section
      const positiveSection = container.querySelector('.flex-1.relative.flex.justify-around.items-end') as HTMLElement;
      const zeroLabels = within(positiveSection).getAllByText('0%');
      expect(zeroLabels.length).toBe(2); // Portfolio and S&P 500

      // Both should be gray (neutral)
      zeroLabels.forEach(label => {
        expect(label).toHaveClass('text-gray-600');
      });
    });

    it('should not show zero as green or red', () => {
      const mockData = {
        performance: [
          {
            period: 'MTD',
            return: 0.0,
            sp500: 0.0,
            isPositive: false,
            outperformance: 0.0,
            portfolio_value_current: 100000,
            holdings_count: 5
          }
        ],
        account_name: 'Test Account',
        calculation_date: '2024-01-15'
      };

      mockUsePortfolioOverview.mockReturnValue({
        performance: mockData,
        performanceLoading: false,
        performanceError: null,
        refetchPerformance: jest.fn()
      });

      const { container } = render(<PerformanceCard onViewPerformance={mockOnViewPerformance} />);

      // Zero labels should not have green or red classes
      const positiveSection = container.querySelector('.flex-1.relative.flex.justify-around.items-end') as HTMLElement;
      const greenLabels = positiveSection.querySelectorAll('.text-green-600, .text-green-700');
      const redLabels = positiveSection.querySelectorAll('.text-red-600, .text-red-700');

      // Filter out non-zero labels
      const greenTexts = Array.from(greenLabels).map(label => label.textContent);
      const redTexts = Array.from(redLabels).map(label => label.textContent);

      expect(greenTexts.every(text => !text.match(/^0%$/))).toBe(true);
      expect(redTexts.every(text => !text.match(/^0%$/))).toBe(true);
    });
  });
});
