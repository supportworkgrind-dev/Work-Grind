import { isAxiosError } from 'axios';

type ApiErrorBody = { message?: string };

export function getApiErrorMessage(error: unknown, fallback: string): string {
  if (isAxiosError<ApiErrorBody>(error)) return error.response?.data?.message || fallback;
  return fallback;
}
