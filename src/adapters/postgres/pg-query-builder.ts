import type { FilterQuery, FindOptions, SortOption } from "../../types.js";
import { isOperatorObject } from "../../query/operators.js";

interface BuiltQuery {
  text: string;
  params: unknown[];
}

export function buildSelect(
  collection: string,
  options: FindOptions,
): BuiltQuery {
  const params: unknown[] = [];
  let text = `SELECT * FROM "${collection}"`;

  if (options.filter && Object.keys(options.filter).length > 0) {
    const where = buildWhere(options.filter, params);
    text += ` WHERE ${where}`;
  }

  if (options.sort) {
    text += ` ORDER BY ${buildOrderBy(options.sort)}`;
  }

  if (options.limit !== undefined) {
    params.push(options.limit);
    text += ` LIMIT $${params.length}`;
  }

  if (options.offset !== undefined) {
    params.push(options.offset);
    text += ` OFFSET $${params.length}`;
  }

  return { text, params };
}

export function buildCount(
  collection: string,
  filter?: FilterQuery,
): BuiltQuery {
  const params: unknown[] = [];
  let text = `SELECT COUNT(*) as count FROM "${collection}"`;

  if (filter && Object.keys(filter).length > 0) {
    const where = buildWhere(filter, params);
    text += ` WHERE ${where}`;
  }

  return { text, params };
}

function buildWhere(filter: FilterQuery, params: unknown[]): string {
  const conditions: string[] = [];

  for (const [field, condition] of Object.entries(filter)) {
    if (isOperatorObject(condition)) {
      for (const [op, value] of Object.entries(
        condition as Record<string, unknown>,
      )) {
        conditions.push(buildOperator(field, op, value, params));
      }
    } else {
      params.push(condition);
      conditions.push(`"${field}" = $${params.length}`);
    }
  }

  return conditions.join(" AND ");
}

function buildOperator(
  field: string,
  op: string,
  value: unknown,
  params: unknown[],
): string {
  switch (op) {
    case "$eq":
      params.push(value);
      return `"${field}" = $${params.length}`;
    case "$ne":
      params.push(value);
      return `"${field}" != $${params.length}`;
    case "$gt":
      params.push(value);
      return `"${field}" > $${params.length}`;
    case "$gte":
      params.push(value);
      return `"${field}" >= $${params.length}`;
    case "$lt":
      params.push(value);
      return `"${field}" < $${params.length}`;
    case "$lte":
      params.push(value);
      return `"${field}" <= $${params.length}`;
    case "$in":
      params.push(value);
      return `"${field}" = ANY($${params.length})`;
    case "$nin":
      params.push(value);
      return `"${field}" != ALL($${params.length})`;
    case "$like":
      params.push(value);
      return `"${field}" ILIKE $${params.length}`;
    case "$exists":
      return value
        ? `"${field}" IS NOT NULL`
        : `"${field}" IS NULL`;
    default:
      throw new Error(`Unknown operator: ${op}`);
  }
}

function buildOrderBy(sort: SortOption): string {
  return Object.entries(sort)
    .map(([field, dir]) => `"${field}" ${dir === 1 ? "ASC" : "DESC"}`)
    .join(", ");
}
