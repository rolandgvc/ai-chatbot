/**
 * Shared TypeScript interfaces for icon components
 */

// Standard icon props with optional size parameter
export interface IconProps {
  size?: number;
  className?: string;
}

// For icons that require a size parameter
export interface RequiredSizeIconProps {
  size: number;
  className?: string;
}

// For icons that don't accept any props
export interface NoPropsIcon {
  // No props needed - these icons use fixed styling
}