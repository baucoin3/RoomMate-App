/**
 * Shared API response types.
 * Use these generics on all axios calls and route handler return types.
 */

export type ApiSuccess<T> = { data: T; error: null }
export type ApiError = { data: null; error: string }
export type ApiResult<T> = ApiSuccess<T> | ApiError
