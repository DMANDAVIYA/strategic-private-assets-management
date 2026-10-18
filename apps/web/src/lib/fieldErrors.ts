type Issue = { code: string; path: ReadonlyArray<PropertyKey> };

export type FieldMessages = Record<string, { default: string } & Partial<Record<string, string>>>;

export function fieldErrorsFrom(issues: ReadonlyArray<Issue>, messages: FieldMessages): Record<string, string> {
  const errors: Record<string, string> = {};
  for (const issue of issues) {
    const field = String(issue.path[0] ?? "");
    const table = messages[field];
    if (table === undefined || errors[field] !== undefined) {
      continue;
    }
    errors[field] = table[issue.code] ?? table.default;
  }
  return errors;
}
