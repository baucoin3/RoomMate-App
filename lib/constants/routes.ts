/**
 * All application route paths.
 * Never hardcode route strings in components or route handlers — import from here.
 *
 * Usage:
 *   import { ROUTES } from '@/lib/constants/routes'
 *   router.push(ROUTES.DASHBOARD)
 */

export const ROUTES = {
  HOME: '/',
  LOGIN: '/login',
  REGISTER: '/register',
  DASHBOARD: '/dashboard',
  HOUSEHOLD: (id: string) => `/dashboard/${id}`,
  HOUSEHOLD_SHOPPING: (id: string) => `/dashboard/${id}/shopping`,
  HOUSEHOLD_RECIPES: (id: string) => `/dashboard/${id}/recipes`,
  HOUSEHOLD_FINANCES: (id: string) => `/dashboard/${id}/finances`,
  HOUSEHOLD_SETTINGS: (id: string) => `/dashboard/${id}/settings`,
  RECIPE_DETAIL: (householdId: string, recipeId: string) => `/dashboard/${householdId}/recipes/${recipeId}`,
  RECIPE_NEW: (householdId: string) => `/dashboard/${householdId}/recipes/new`,
  RECIPE_EDIT: (householdId: string, recipeId: string) => `/dashboard/${householdId}/recipes/${recipeId}/edit`,
  HOUSEHOLD_RECEIPTS: (id: string) => `/dashboard/${id}/receipts`,
  RECEIPT_NEW: (id: string) => `/dashboard/${id}/receipts/new`,
} as const

export type AppRoute = string

/** Route groups used in middleware path matching */
export const PROTECTED_ROUTES = [ROUTES.DASHBOARD] as const
export const AUTH_ROUTES = [ROUTES.LOGIN, ROUTES.REGISTER] as const
