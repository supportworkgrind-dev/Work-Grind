export interface Pagination {
  page: number;
  limit: number;
  skip: number;
}

export interface PaginationOptions {
  defaultLimit: number;
  maxLimit: number;
  maxSkip?: number;
}

function parsePositiveInteger(value: unknown): number | null {
  if (typeof value !== 'string' && typeof value !== 'number') return null;
  if (typeof value === 'string' && !/^[1-9]\d*$/.test(value)) return null;

  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null;
}

export function parsePagination(
  query: { page?: unknown; limit?: unknown },
  { defaultLimit, maxLimit, maxSkip = 100_000 }: PaginationOptions,
): Pagination | null {
  const page = query.page === undefined ? 1 : parsePositiveInteger(query.page);
  const requestedLimit = query.limit === undefined ? defaultLimit : parsePositiveInteger(query.limit);
  if (page === null || requestedLimit === null) return null;

  const limit = Math.min(requestedLimit, maxLimit);
  const skip = (page - 1) * limit;
  if (!Number.isSafeInteger(skip) || skip > maxSkip) return null;

  return { page, limit, skip };
}
