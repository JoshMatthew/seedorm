import type { MigrationStep, NormalizedField, NormalizedSchema } from "../types.js";

export function diffSchemas(
  collection: string,
  oldSchema: NormalizedSchema | null,
  newSchema: NormalizedSchema | null,
): MigrationStep[] {
  const steps: MigrationStep[] = [];

  // Collection dropped
  if (oldSchema && !newSchema) {
    steps.push({ type: "dropCollection", collection });
    return steps;
  }

  // Collection created
  if (!oldSchema && newSchema) {
    steps.push({ type: "createCollection", collection });
    for (const [field, def] of Object.entries(newSchema)) {
      steps.push({ type: "addField", collection, field, schema: def });
      if (def.index || def.unique) {
        steps.push({ type: "addIndex", collection, field, schema: def });
      }
    }
    return steps;
  }

  if (!oldSchema || !newSchema) return steps;

  const oldFields = new Set(Object.keys(oldSchema));
  const newFields = new Set(Object.keys(newSchema));

  // Added fields
  for (const field of newFields) {
    if (!oldFields.has(field)) {
      steps.push({ type: "addField", collection, field, schema: newSchema[field]! });
      if (newSchema[field]!.index || newSchema[field]!.unique) {
        steps.push({ type: "addIndex", collection, field, schema: newSchema[field]! });
      }
    }
  }

  // Dropped fields
  for (const field of oldFields) {
    if (!newFields.has(field)) {
      if (oldSchema[field]!.index || oldSchema[field]!.unique) {
        steps.push({ type: "dropIndex", collection, field, schema: oldSchema[field]! });
      }
      steps.push({ type: "dropField", collection, field, schema: oldSchema[field]! });
    }
  }

  // Altered fields
  for (const field of newFields) {
    if (oldFields.has(field)) {
      const o = oldSchema[field]!;
      const n = newSchema[field]!;
      if (!fieldsEqual(o, n)) {
        // Handle index changes
        if ((o.index || o.unique) && !(n.index || n.unique)) {
          steps.push({ type: "dropIndex", collection, field, schema: o });
        }
        steps.push({
          type: "alterField",
          collection,
          field,
          schema: n,
          oldSchema: o,
        });
        if (!(o.index || o.unique) && (n.index || n.unique)) {
          steps.push({ type: "addIndex", collection, field, schema: n });
        }
      }
    }
  }

  return steps;
}

function fieldsEqual(a: NormalizedField, b: NormalizedField): boolean {
  return (
    a.type === b.type &&
    a.required === b.required &&
    a.unique === b.unique &&
    a.index === b.index &&
    a.min === b.min &&
    a.max === b.max &&
    a.minLength === b.minLength &&
    a.maxLength === b.maxLength &&
    JSON.stringify(a.enum) === JSON.stringify(b.enum) &&
    JSON.stringify(a.default) === JSON.stringify(b.default)
  );
}

export function invertSteps(steps: MigrationStep[]): MigrationStep[] {
  return [...steps].reverse().map((step) => {
    switch (step.type) {
      case "createCollection":
        return { ...step, type: "dropCollection" };
      case "dropCollection":
        return { ...step, type: "createCollection" };
      case "addField":
        return { ...step, type: "dropField" };
      case "dropField":
        return { ...step, type: "addField" };
      case "alterField":
        return {
          ...step,
          type: "alterField",
          schema: step.oldSchema!,
          oldSchema: step.schema,
        };
      case "addIndex":
        return { ...step, type: "dropIndex" };
      case "dropIndex":
        return { ...step, type: "addIndex" };
      default:
        return step;
    }
  });
}
