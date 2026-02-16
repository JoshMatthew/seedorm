import type { FilterOperators } from "../types.js";

type OperatorFn = (fieldValue: unknown, operand: unknown) => boolean;

const operators: Record<string, OperatorFn> = {
  $eq: (val, op) => val === op,

  $ne: (val, op) => val !== op,

  $gt: (val, op) => {
    if (typeof val === "number" && typeof op === "number") return val > op;
    if (typeof val === "string" && typeof op === "string") return val > op;
    return false;
  },

  $gte: (val, op) => {
    if (typeof val === "number" && typeof op === "number") return val >= op;
    if (typeof val === "string" && typeof op === "string") return val >= op;
    return false;
  },

  $lt: (val, op) => {
    if (typeof val === "number" && typeof op === "number") return val < op;
    if (typeof val === "string" && typeof op === "string") return val < op;
    return false;
  },

  $lte: (val, op) => {
    if (typeof val === "number" && typeof op === "number") return val <= op;
    if (typeof val === "string" && typeof op === "string") return val <= op;
    return false;
  },

  $in: (val, op) => {
    if (!Array.isArray(op)) return false;
    return op.includes(val);
  },

  $nin: (val, op) => {
    if (!Array.isArray(op)) return true;
    return !op.includes(val);
  },

  $like: (val, op) => {
    if (typeof val !== "string" || typeof op !== "string") return false;
    // Convert SQL-like pattern to regex: % → .*, _ → .
    const escaped = op.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const pattern = escaped.replace(/%/g, ".*").replace(/_/g, ".");
    return new RegExp(`^${pattern}$`, "i").test(val);
  },

  $exists: (val, op) => {
    const exists = val !== undefined && val !== null;
    return op ? exists : !exists;
  },
};

export function applyOperator(
  key: string,
  fieldValue: unknown,
  operand: unknown,
): boolean {
  const fn = operators[key];
  if (!fn) throw new Error(`Unknown operator: ${key}`);
  return fn(fieldValue, operand);
}

export function isOperatorObject(value: unknown): value is FilterOperators {
  if (value === null || typeof value !== "object" || Array.isArray(value))
    return false;
  return Object.keys(value as object).some((k) => k.startsWith("$"));
}

export const OPERATORS = Object.keys(operators);
