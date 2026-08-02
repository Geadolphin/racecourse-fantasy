"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import AdminSidebar from "../../components/admin/AdminSidebar";
import { supabase } from "../../lib/supabase";

export default function AdminLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const router = useRouter();

  const [checkingAccess, setCheckingAccess] = useState(true);
  const [hasAccess, setHasAccess] = useState(false);

  useEffect(() => {
    async function checkAdminAccess() {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        router.replace("/login");
        return;
      }

      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("is_admin")
        .eq("id", user.id)
        .single();

      if (profileError || !profile?.is_admin) {
        router.replace("/dashboard");
        return;
      }

      setHasAccess(true);
      setCheckingAccess(false);
    }

    checkAdminAccess();
  }, [router]);

  if (checkingAccess) {
    return (
      <main className="flex min-h-[70vh] items-center justify-center">
        <p className="text-slate-600">
          Checking administrator access...
        </p>
      </main>
    );
  }

  if (!hasAccess) {
    return null;
  }

  return (
    <div className="md:flex">
      <AdminSidebar />

      <div className="min-w-0 flex-1 bg-slate-100">
        {children}
      </div>
    </div>
  );
}