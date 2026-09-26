import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";

export default async function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  try {
    const reqHeaders = await headers();
    const session = await auth.api.getSession({
      headers: reqHeaders,
    });

    if (session?.user) {
      redirect("/dashboard");
    }
  } catch {
    // Continue to auth page if not logged in
  }

  return (
    <div className="min-h-screen w-full flex items-center justify-center p-4 bg-muted/30">
      <div className="w-full max-w-md">{children}</div>
    </div>
  );
}
