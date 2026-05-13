import { NextResponse } from "next/server";

export function errorResponse(
  message: string,
  status: number,
  details?: Record<string, unknown>
) {
  return NextResponse.json(
    { error: message, ...(details && { details }) },
    { status }
  );
}

export function successResponse(data: unknown, status: number = 200) {
  return NextResponse.json(data, { status });
}

export function validateRequest<T>(
  data: unknown,
  schema: { parse: (data: unknown) => T }
): { valid: true; data: T } | { valid: false; error: string } {
  try {
    const parsed = schema.parse(data);
    return { valid: true, data: parsed };
  } catch (e) {
    return {
      valid: false,
      error: e instanceof Error ? e.message : "Validation failed",
    };
  }
}
