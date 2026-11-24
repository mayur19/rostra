import type { ZodType, ZodTypeDef } from 'zod';
import { validationFailed } from './errors.js';

/** Parses untrusted input with a zod schema, converting failures to a 422 AppError. */
export function parse<T>(schema: ZodType<T, ZodTypeDef, unknown>, input: unknown): T {
  const result = schema.safeParse(input);
  if (!result.success) {
    throw validationFailed(
      result.error.issues.map((issue) => ({ path: issue.path.join('.'), message: issue.message })),
    );
  }
  return result.data;
}
