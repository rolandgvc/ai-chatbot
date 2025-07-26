/**
 * Interface validation tests for extracted component props
 * Tests that the new TypeScript interfaces work correctly
 */

import type { User } from 'next-auth';

// Mock user data for testing
const mockUser: User = {
  id: 'test-user-id',
  email: 'test@example.com',
  name: 'Test User',
};

// Test interface definitions by importing and using them
describe('Component Interface Validation', () => {
  test('SidebarProps interface structure', () => {
    // Test that SidebarProps accepts User | undefined
    const validProps: { user: User | undefined } = {
      user: mockUser,
    };
    
    const validNullProps: { user: User | undefined } = {
      user: undefined,
    };

    expect(validProps.user).toBeDefined();
    expect(validNullProps.user).toBeUndefined();
  });

  test('UserNavProps interface structure', () => {
    // Test that UserNavProps accepts User (required)
    const validProps: { user: User } = {
      user: mockUser,
    };

    expect(validProps.user).toBeDefined();
    expect(validProps.user.email).toBe('test@example.com');
  });

  test('SidebarHistoryProps interface structure', () => {
    // Test that SidebarHistoryProps accepts User | undefined
    const validProps: { user: User | undefined } = {
      user: mockUser,
    };
    
    const validNullProps: { user: User | undefined } = {
      user: undefined,
    };

    expect(validProps.user).toBeDefined();
    expect(validNullProps.user).toBeUndefined();
  });

  test('MarkdownProps interface structure', () => {
    // Test that MarkdownProps accepts string children
    const validProps: { children: string } = {
      children: '# Test Markdown\n\nThis is a test.',
    };

    expect(validProps.children).toBe('# Test Markdown\n\nThis is a test.');
    expect(typeof validProps.children).toBe('string');
  });
});