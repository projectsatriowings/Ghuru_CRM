import { Logo } from "@/components/brand/logo";
import { Building2, ShieldCheck, SlidersHorizontal } from "lucide-react";

export function AuthSidePanel() {
  return (
    <div className="relative hidden lg:flex flex-col justify-between w-1/2 p-12 bg-gradient-to-br from-[#06152B] via-[#0A2246] to-[#0E2F5E] text-white overflow-hidden rounded-l-2xl border-r border-[#163561]/50">
      {/* Subtle ambient lighting orb */}
      <div className="absolute -top-24 -left-24 w-96 h-96 bg-blue-500/15 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-24 -right-24 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />

      {/* Top Brand Logo */}
      <div className="relative z-10">
        <Logo variant="dark" size="lg" />
      </div>

      {/* Center Value Proposition */}
      <div className="relative z-10 my-auto py-8">
        <h1 className="text-3xl xl:text-4xl font-extrabold tracking-tight text-white leading-tight">
          Manage Your <br />
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 via-blue-200 to-white">
            Organization, Your Way
          </span>
        </h1>
        <p className="mt-4 text-sm text-slate-300 leading-relaxed max-w-sm">
          A powerful, customizable CRM platform built for modern businesses.
        </p>

        {/* 3 Core Pillars */}
        <div className="mt-10 space-y-5">
          <div className="flex items-start gap-4">
            <div className="flex items-center justify-center h-10 w-10 rounded-xl bg-blue-600/20 border border-blue-500/30 text-blue-400 shrink-0">
              <Building2 className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-white">Multi-tenant Architecture</h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Keep your data strictly isolated and secure
              </p>
            </div>
          </div>

          <div className="flex items-start gap-4">
            <div className="flex items-center justify-center h-10 w-10 rounded-xl bg-blue-600/20 border border-blue-500/30 text-blue-400 shrink-0">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-white">Role-Based Access Control</h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Granular control over who can do what
              </p>
            </div>
          </div>

          <div className="flex items-start gap-4">
            <div className="flex items-center justify-center h-10 w-10 rounded-xl bg-blue-600/20 border border-blue-500/30 text-blue-400 shrink-0">
              <SlidersHorizontal className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-white">Flexible Configuration</h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Adapt the platform cleanly to your business needs
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Subtitle / Trust Footer */}
      <div className="relative z-10 pt-6 border-t border-white/10 flex items-center justify-between text-xs text-slate-400">
        <span>SaaS Foundation Platform</span>
        <span className="flex items-center gap-1.5 font-medium text-slate-300">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
          Enterprise Grade
        </span>
      </div>
    </div>
  );
}
