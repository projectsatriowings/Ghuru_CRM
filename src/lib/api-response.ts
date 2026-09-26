import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { AppError } from "@/lib/errors";

export function apiSuccess<T>(data: T, status: number = 200) {
  return NextResponse.json(
    {
      success: true,
      data,
    },
    { status }
  );
}

export function apiError(error: unknown) {
  if (error instanceof ZodError) {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: "VALIDATION_ERROR",
          message: "Input validation failed",
          details: error.flatten().fieldErrors,
        },
      },
      { status: 400 }
    );
  }

  if (error instanceof AppError) {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: error.code,
          message: error.message,
        },
      },
      { status: error.statusCode }
    );
  }

  console.error("Unhandled API Error:", error);

  return NextResponse.json(
    {
      success: false,
      error: {
        code: "INTERNAL_SERVER_ERROR",
        message: "An unexpected error occurred. Please try again later.",
      },
    },
    { status: 500 }
  );
}
