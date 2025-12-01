"""
Alert Condition Validators

Factory pattern for validating alert conditions.
Provides reusable validators for both Pydantic models and schemas.
"""

from typing import Any, Callable, Dict, List, Optional, Set
from enum import Enum


class AlertCondition(str, Enum):
    """Price alert condition types."""
    ABOVE = "above"
    BELOW = "below"
    PERCENT_INCREASE = "percent_increase"
    PERCENT_DECREASE = "percent_decrease"


# Define required fields per condition type
CONDITION_REQUIREMENTS: Dict[AlertCondition, Set[str]] = {
    AlertCondition.ABOVE: {"target_price"},
    AlertCondition.BELOW: {"target_price"},
    AlertCondition.PERCENT_INCREASE: {"percent_change", "base_price"},
    AlertCondition.PERCENT_DECREASE: {"percent_change", "base_price"},
}


def validate_condition_requirements(
    condition: AlertCondition,
    values: Dict[str, Any]
) -> List[str]:
    """
    Validate that required fields are present for a given condition.

    Args:
        condition: The alert condition type
        values: Dictionary of field values

    Returns:
        List of validation error messages (empty if valid)
    """
    errors = []
    required_fields = CONDITION_REQUIREMENTS.get(condition, set())

    for field in required_fields:
        if field not in values or values[field] is None:
            errors.append(f"{field} is required for {condition.value} condition")

    return errors


def create_condition_validator() -> Callable:
    """
    Factory function that creates a Pydantic validator for condition fields.

    Returns a validator function compatible with Pydantic's @validator decorator.

    Usage:
        @validator('condition')
        def validate_condition_fields(cls, v, values):
            return _validate_condition(v, values)
    """
    def _validate_condition(condition: AlertCondition, values: Dict[str, Any]) -> AlertCondition:
        """Validate that required fields are present for the condition."""
        errors = validate_condition_requirements(condition, values)
        if errors:
            raise ValueError("; ".join(errors))
        return condition

    return _validate_condition


def check_price_condition(
    condition: AlertCondition,
    current_price: float,
    target_price: Optional[float] = None,
    base_price: Optional[float] = None,
    percent_change: Optional[float] = None,
) -> bool:
    """
    Check if an alert condition is met for a given price.

    Args:
        condition: The type of alert condition
        current_price: The current stock price
        target_price: Target price for ABOVE/BELOW conditions
        base_price: Base price for percentage calculations
        percent_change: Required percentage change threshold

    Returns:
        True if the condition is met, False otherwise
    """
    if condition == AlertCondition.ABOVE:
        return target_price is not None and current_price >= target_price

    elif condition == AlertCondition.BELOW:
        return target_price is not None and current_price <= target_price

    elif condition == AlertCondition.PERCENT_INCREASE:
        if base_price and percent_change is not None:
            actual_change = ((current_price - base_price) / base_price) * 100
            return actual_change >= percent_change
        return False

    elif condition == AlertCondition.PERCENT_DECREASE:
        if base_price and percent_change is not None:
            actual_change = ((current_price - base_price) / base_price) * 100
            return actual_change <= -abs(percent_change)
        return False

    return False


# Create the validator instance for direct use
_condition_validator = create_condition_validator()


def validate_alert_condition(condition: AlertCondition, values: Dict[str, Any]) -> AlertCondition:
    """
    Validate alert condition fields.

    This is the main entry point for condition validation.
    Can be used directly in Pydantic validators.

    Example:
        @validator('condition')
        def validate_condition_fields(cls, v, values):
            return validate_alert_condition(v, values)
    """
    return _condition_validator(condition, values)
