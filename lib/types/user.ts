/**
 * Shared domain types for users and auth.
 * Import from here — never redefine User in individual page/component files.
 */

export interface User {
  id: string
  email: string
}

export interface UserProfile extends User {
  displayName?: string
  avatarUrl?: string
  createdAt: string
}
