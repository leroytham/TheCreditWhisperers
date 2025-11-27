import type { User, SelectedAccount } from '../../types';

/**
 * Create a mock User object
 *
 * @example
 * ```ts
 * const user = createUser(); // Default user
 * const customUser = createUser({ email: 'custom@example.com' });
 * ```
 */
export function createUser(overrides: Partial<User> = {}): User {
  return {
    email: 'test@example.com',
    name: 'Test User',
    ...overrides,
  };
}

/**
 * Create a mock SelectedAccount object
 *
 * @example
 * ```ts
 * const account = createSelectedAccount();
 * const customAccount = createSelectedAccount({
 *   accountName: 'My Portfolio',
 *   accountNumber: 'ACC123',
 * });
 * ```
 */
export function createSelectedAccount(
  overrides: Partial<SelectedAccount> = {}
): SelectedAccount {
  return {
    username: 'test@example.com',
    accountName: 'Test Portfolio',
    accountNumber: 'ACC001',
    ...overrides,
  };
}

/**
 * Create multiple users
 *
 * @example
 * ```ts
 * const users = createUsers(3);
 * // Returns array of 3 users with emails: user1@example.com, user2@example.com, etc.
 * ```
 */
export function createUsers(count: number, overrides: Partial<User> = {}): User[] {
  return Array.from({ length: count }, (_, i) =>
    createUser({
      email: `user${i + 1}@example.com`,
      name: `Test User ${i + 1}`,
      ...overrides,
    })
  );
}
