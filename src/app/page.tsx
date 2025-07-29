
'use client';
import FlowBuilderClient from "@/components/flow-builder/FlowBuilderClient";
import { useAuth } from "@/components/auth/AuthProvider";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export default function Home() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [hasMounted, setHasMounted] = useState(false);

  useEffect(() => {
    setHasMounted(true);
  }, []);

  useEffect(() => {
    if (hasMounted && !loading && !user) {
      router.push('/login');
    }
  }, [user, loading, router, hasMounted]);

  if (!hasMounted || loading || !user) {
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
