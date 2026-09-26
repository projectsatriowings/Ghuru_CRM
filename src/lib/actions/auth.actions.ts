"use server";

import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { signupSchema, loginSchema, SignupInput, LoginInput } from "@/lib/validations/auth";
import { formatZodError } from "@/lib/validations/helpers";

export async function signupAction(input: SignupInput) {
  const validated = signupSchema.safeParse(input);
  if (!validated.success) {
    return {
      success: false,
      error: formatZodError(validated.error),
    };
  }

  try {
    const res = await auth.api.signUpEmail({
      body: {
        name: validated.data.name,
        email: validated.data.email,
        password: validated.data.password,
      },
      headers: await headers(),
    });

    return {
      success: true,
      data: res,
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Signup failed";
    return {
      success: false,
      error: message,
    };
  }
}

export async function loginAction(input: LoginInput) {
  const validated = loginSchema.safeParse(input);
  if (!validated.success) {
    return {
      success: false,
      error: formatZodError(validated.error),
    };
  }

  try {
    const res = await auth.api.signInEmail({
      body: {
        email: validated.data.email,
        password: validated.data.password,
      },
      headers: await headers(),
    });

    return {
      success: true,
      data: res,
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Invalid email or password";
    return {
      success: false,
      error: message,
    };
  }
}

export async function logoutAction() {
  try {
    await auth.api.signOut({
      headers: await headers(),
    });
    return { success: true };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Logout failed";
    return {
      success: false,
      error: message,
    };
  }
}
