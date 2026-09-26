import Link from "next/link";
import { cn } from "@/lib/utils";

interface LogoProps {
  variant?: "dark" | "light"; // "dark" = for dark navy backgrounds, "light" = for white/light backgrounds
  size?: "sm" | "md" | "lg";
  showSubtitle?: boolean;
  href?: string;
  className?: string;
}

export function Logo({
  variant = "light",
  size = "md",
  showSubtitle = false,
  href = "/",
  className,
}: LogoProps) {
  const isDark = variant === "dark";

  const sizeConfig = {
    sm: {
      icon: "h-7 w-7 text-xs rounded-lg",
      title: "text-base",
      subtitle: "text-[9px]",
    },
    md: {
      icon: "h-9 w-9 text-sm rounded-xl",
      title: "text-lg",
      subtitle: "text-[10px]",
    },
    lg: {
      icon: "h-11 w-11 text-base rounded-xl",
      title: "text-xl",
      subtitle: "text-xs",
    },
  }[size];

  const content = (
    <div className={cn("inline-flex items-center gap-3", className)}>
      {/* Modern Gradient Icon Mark */}
      <div
        className={cn(
          "flex items-center justify-center font-bold font-sans text-white shadow-sm shrink-0 bg-gradient-to-tr from-blue-700 via-blue-600 to-blue-500 ring-1 ring-white/20",
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
          className="w-1/2 h-1/2"
        >
          <path d="M19 12a7 7 0 1 1-2.05-4.95L20 4" />
          <path d="M14 12h6" />
        </svg>
      </div>

      <div className="flex flex-col">
        <span
          className={cn(
            "font-extrabold tracking-tight leading-none",
            sizeConfig.title,
            isDark ? "text-white" : "text-slate-900"
          )}
        >
          Ghuru <span className="text-blue-500">CRM</span>
        </span>
        {showSubtitle && (
          <span
            className={cn(
              "font-semibold uppercase tracking-widest leading-tight mt-1",
              sizeConfig.subtitle,
              isDark ? "text-slate-400" : "text-slate-500"
            )}
          >
            Smarter Business. Stronger Growth.
          </span>
        )}
      </div>
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
