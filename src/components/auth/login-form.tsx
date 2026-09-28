"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { signIn } from "@/lib/auth/client";
import { loginSchema } from "@/lib/validations/auth";
import { formatZodError } from "@/lib/validations/helpers";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Logo } from "@/components/brand/logo";
import { Loader2, Eye, EyeOff, AlertCircle, ArrowRight } from "lucide-react";

export function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const validation = loginSchema.safeParse({ email, password });
    if (!validation.success) {
      setError(formatZodError(validation.error));
      return;
    }

    setLoading(true);

    try {
      const res = await signIn.email({
        email: validation.data.email,
        password: validation.data.password,
      });

      if (res.error) {
        setError(res.error.message || "Invalid credentials. Please try again.");
        setLoading(false);
        return;
      }

      router.replace("/dashboard");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "An unexpected error occurred");
      setLoading(false);
    }
  }

  return (
    <div className="w-full">
      {/* Mobile-only compact logo */}
      <div className="lg:hidden mb-8">
        <Logo variant="light" size="md" />
      </div>

      <div className="space-y-2 mb-8">
        <h1 className="text-3xl sm:text-[34px] font-bold tracking-tight text-slate-900 leading-tight">
          Welcome back
        </h1>
        <p className="text-sm sm:text-base text-slate-500 leading-normal">
          Sign in to continue to your workspace.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="flex items-center gap-2.5 p-3 text-xs sm:text-sm text-red-600 bg-red-50 rounded-lg border border-red-200">
            <AlertCircle className="h-4 w-4 shrink-0 text-red-500" />
            <span>{error}</span>
          </div>
        )}

        <div className="space-y-1.5">
          <Label htmlFor="email" className="text-xs sm:text-sm font-medium text-slate-800">
            Email
          </Label>
          <Input
            id="email"
            type="email"
            placeholder="name@company.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={loading}
            required
            className="h-11 rounded-lg border-slate-200 bg-white px-3.5 text-sm placeholder:text-slate-400 focus-visible:border-blue-600 focus-visible:ring-1 focus-visible:ring-blue-600 shadow-2xs"
          />
        </div>

        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <Label htmlFor="password" className="text-xs sm:text-sm font-medium text-slate-800">
              Password
            </Label>
          </div>
          <div className="relative">
            <Input
              id="password"
              type={showPassword ? "text" : "password"}
              placeholder="Enter your password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={loading}
              required
              className="h-11 rounded-lg border-slate-200 bg-white pr-10 text-sm placeholder:text-slate-400 focus-visible:border-blue-600 focus-visible:ring-1 focus-visible:ring-blue-600 shadow-2xs"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 focus:outline-none"
              tabIndex={-1}
            >
              {showPassword ? (
                <EyeOff className="h-4 w-4" />
              ) : (
                <Eye className="h-4 w-4" />
              )}
            </button>
          </div>
        </div>

        <div className="flex items-center justify-between text-xs pt-0.5">
          <label className="flex items-center gap-2 text-slate-600 cursor-pointer select-none">
            <input
              type="checkbox"
              className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 h-4 w-4"
            />
            <span>Remember me</span>
          </label>
          <span className="text-slate-500 hover:text-slate-800 font-medium cursor-pointer transition-colors">
            Forgot password?
          </span>
        </div>

        <div className="pt-2">
          <Button
            type="submit"
            disabled={loading}
            className="w-full h-11 rounded-lg text-sm font-medium bg-blue-600 hover:bg-blue-700 text-white transition-all shadow-xs flex items-center justify-center gap-2 group cursor-pointer"
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <>
                <span>Sign in</span>
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
              </>
            )}
          </Button>
        </div>

        <div className="text-center pt-2">
          <p className="text-xs sm:text-sm text-slate-500">
            Don&apos;t have an account?{" "}
            <Link
              href="/signup"
              className="text-blue-600 hover:text-blue-700 font-medium transition-colors"
            >
              Create one
            </Link>
          </p>
        </div>
      </form>
    </div>
  );
}
