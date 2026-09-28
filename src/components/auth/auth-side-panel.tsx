import { Logo } from "@/components/brand/logo";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

interface AuthSidePanelProps {
  currentStep?: 1 | 2 | 3;
  className?: string;
}

export function AuthSidePanel({
  currentStep = 1,
  className,
}: AuthSidePanelProps) {
  const steps = [
    {
      num: "01",
      title: "Organization",
      desc: "Set up your organization and company profile",
    },
    {
      num: "02",
      title: "Workspace",
      desc: "Configure unique workspace URL and settings",
    },
    {
      num: "03",
      title: "Complete",
      desc: "Invite team members and launch your CRM",
    },
  ];

  return (
    <div
      className={cn(
        "relative hidden lg:flex flex-col justify-between p-10 xl:p-14 bg-gradient-to-b from-[#081B33] via-[#0A213D] to-[#071629] text-white overflow-hidden border-r border-[#122A4A]/50 select-none",
        className
      )}
    >
      {/* Subtle architectural ambient glow */}
      <div className="absolute -top-32 -left-32 w-80 h-80 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-32 -right-32 w-80 h-80 bg-blue-600/10 rounded-full blur-3xl pointer-events-none" />

      {/* Subtle geometric line pattern */}
      <div
        className="absolute inset-0 opacity-[0.03] pointer-events-none"
        style={{
          backgroundImage: `radial-gradient(circle at 1px 1px, #ffffff 1px, transparent 0)`,
          backgroundSize: "28px 28px",
        }}
      />

      {/* Top Brand Logo */}
      <div className="relative z-10">
        <Logo variant="dark" size="md" />
      </div>

      {/* Center Value Proposition */}
      <div className="relative z-10 my-auto py-10 space-y-6">
        <div className="space-y-3">
          <span className="text-[11px] font-bold tracking-widest text-blue-400 uppercase">
            SaaS Foundation Platform
          </span>
          <h1 className="text-3xl xl:text-4xl font-bold tracking-tight text-white leading-tight">
            Smarter business. <br />
            <span className="text-slate-200">Stronger growth.</span>
          </h1>
          <p className="text-sm text-slate-400 leading-relaxed max-w-sm pt-1">
            A powerful, flexible workspace built for modern organizations to scale.
          </p>
        </div>

        {/* 3 Core Value Bullet Points */}
        <div className="space-y-3.5 pt-2">
          <div className="flex items-center gap-3">
            <span className="flex items-center justify-center h-5 w-5 rounded-full bg-blue-500/15 text-blue-400 shrink-0">
              <Check className="h-3 w-3" strokeWidth={3} />
            </span>
            <span className="text-sm text-slate-300 font-medium">
              Multi-tenant architecture
            </span>
          </div>

          <div className="flex items-center gap-3">
            <span className="flex items-center justify-center h-5 w-5 rounded-full bg-blue-500/15 text-blue-400 shrink-0">
              <Check className="h-3 w-3" strokeWidth={3} />
            </span>
            <span className="text-sm text-slate-300 font-medium">
              Role-based access control
            </span>
          </div>

          <div className="flex items-center gap-3">
            <span className="flex items-center justify-center h-5 w-5 rounded-full bg-blue-500/15 text-blue-400 shrink-0">
              <Check className="h-3 w-3" strokeWidth={3} />
            </span>
            <span className="text-sm text-slate-300 font-medium">
              Configurable workflows
            </span>
          </div>
        </div>
      </div>

      {/* Bottom Setup Progress Stepper */}
      <div className="relative z-10 pt-8 border-t border-[#132A4B]/80 space-y-3">
        <span className="text-[10px] font-bold tracking-widest text-slate-400 uppercase block mb-3">
          Setup Progress
        </span>

        <div className="space-y-2.5">
          {steps.map((step, idx) => {
            const stepNum = idx + 1;
            const isActive = stepNum === currentStep;
            const isCompleted = stepNum < currentStep;

            return (
              <div
                key={step.num}
                className={cn(
                  "flex items-start gap-3 transition-colors",
                  isActive ? "opacity-100" : isCompleted ? "opacity-70" : "opacity-40"
                )}
              >
                <div className="flex items-center gap-2 shrink-0 pt-0.5">
                  <span
                    className={cn(
                      "h-2 w-2 rounded-full",
                      isActive
                        ? "bg-blue-500 shadow-xs shadow-blue-500"
                        : isCompleted
                        ? "bg-emerald-400"
                        : "border border-slate-500 bg-transparent"
                    )}
                  />
                  <span className="font-mono text-xs font-semibold text-slate-400">
                    {step.num}
                  </span>
                </div>

                <div className="min-w-0">
                  <p
                    className={cn(
                      "text-xs font-semibold leading-tight",
                      isActive ? "text-white" : "text-slate-300"
                    )}
                  >
                    {step.title}
                  </p>
                  {isActive && (
                    <p className="text-[11px] text-slate-400 mt-0.5 leading-snug">
                      {step.desc}
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
