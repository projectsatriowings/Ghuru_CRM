import Link from "next/link";
import { cn } from "@/lib/utils";

interface LogoProps {
  variant?: "dark" | "light"; // "dark" = for dark navy backgrounds, "light" = for light backgrounds
  size?: "sm" | "md" | "lg";
  href?: string;
  className?: string;
}

export function Logo({
  variant = "light",
  size = "md",
  href = "/",
  className,
}: LogoProps) {
  const isDark = variant === "dark";

  const sizeConfig = {
    sm: {
      icon: "h-6 w-6 text-xs rounded-md",
      title: "text-sm",
    },
    md: {
      icon: "h-7 w-7 text-xs rounded-md",
      title: "text-base",
    },
    lg: {
      icon: "h-8 w-8 text-sm rounded-lg",
      title: "text-lg",
    },
  }[size];

  const content = (
    <div className={cn("inline-flex items-center gap-2.5 select-none", className)}>
      {/* Compact G Icon Mark */}
      <div
        className={cn(
          "flex items-center justify-center font-bold text-white shadow-xs shrink-0 bg-blue-600 transition-transform",
          sizeConfig.icon
        )}
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="w-4 h-4"
        >
          <path d="M19 12a7 7 0 1 1-2.05-4.95L20 4" />
          <path d="M14 12h6" />
        </svg>
      </div>

      <span
        className={cn(
          "font-semibold tracking-tight leading-none",
          sizeConfig.title,
          isDark ? "text-white" : "text-slate-900"
        )}
      >
        Ghuru <span className="text-blue-500 font-medium">CRM</span>
      </span>
    </div>
  );

  if (href) {
    return (
      <Link href={href} className="inline-flex transition-opacity hover:opacity-90">
        {content}
      </Link>
    );
  }

  return content;
}
