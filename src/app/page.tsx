
'use client';
import FlowBuilderClient from "@/components/flow-builder/FlowBuilderClient";
import { useAuth } from "@/components/auth/AuthProvider";
import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function Home() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
    }
  }, [user, loading, router]);

  if (loading || !user) {
    return (
        <div className="flex h-screen w-full items-center justify-center">
            <div className="text-muted-foreground">Carregando...</div>
        </div>
    );
  }

  return (
    <>
      <FlowBuilderClient />
    </>
  );
}
