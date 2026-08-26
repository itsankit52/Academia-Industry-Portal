import { DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE } from '@aip/config';
import type { Paginated } from '@aip/types';

export interface PaginationInput {
  page?: number;
  pageSize?: number;
  sortBy?: string;
  sortDir?: 'asc' | 'desc';
}

export interface PaginationResult {
  page: number;
  pageSize: number;
  skip: number;
  limit: number;
  sort: Record<string, 1 | -1>;
}

export function applyPagination(input: PaginationInput = {}): PaginationResult {
  const page = Math.max(1, Math.floor(input.page ?? 1));
  const rawSize = Math.floor(input.pageSize ?? DEFAULT_PAGE_SIZE);
  const pageSize = Math.max(1, Math.min(MAX_PAGE_SIZE, rawSize));
  const skip = (page - 1) * pageSize;

  const sortField = input.sortBy?.trim() || 'createdAt';
  const sortDir: 1 | -1 = input.sortDir === 'asc' ? 1 : -1;

  return {
    page,
    pageSize,
    skip,
    limit: pageSize,
    sort: { [sortField]: sortDir },
  };
}

export function buildPaginated<T>(
  items: T[],
  total: number,
  page: number,
  pageSize: number,
): Paginated<T> {
  const totalPages = pageSize > 0 ? Math.max(1, Math.ceil(total / pageSize)) : 1;
  return { items, page, pageSize, total, totalPages };
}
