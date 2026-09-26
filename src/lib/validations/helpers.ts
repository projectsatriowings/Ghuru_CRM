import { ZodError } from "zod";

export function formatZodError(error: ZodError): string {
  if (error.issues && error.issues.length > 0) {
    return error.issues[0].message;
  }
  return "Validation failed";
}
