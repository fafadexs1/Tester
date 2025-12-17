'use client';

import { useEffect, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { ssoLoginAction } from '@/app/actions/authActions';
import { useAuth } from '@/components/auth/AuthProvider';
import { Loader2 } from 'lucide-react';

export default function AuthListener() {
    const searchParams = useSearchParams();
    const router = useRouter();
    const { user, refreshAuth } = useAuth();
    const [isProcessing, setIsProcessing] = useState(false);

    useEffect(() => {
        const authParam = searchParams.get('auth');

        if (authParam && !user && !isProcessing) {
            const handleAuth = async () => {
                setIsProcessing(true);
                try {
                    const decoded = JSON.parse(atob(decodeURIComponent(authParam)));
                    const { user: incomingUser } = decoded;

                    if (incomingUser) {
                        console.log("[AuthListener] Found URL Auth Param. Attempting SSO login...");

                        const result = await ssoLoginAction(incomingUser);

                        if (result.success) {
                            console.log("[AuthListener] SSO Login successful. Refreshing session...");
                            await refreshAuth();
                            // Clean URL
                            const newUrl = new URL(window.location.href);
                            newUrl.searchParams.delete('auth');
                            router.replace(newUrl.pathname + newUrl.search);
                        } else {
                            console.error("[AuthListener] SSO Login failed:", result.error);
                        }
                    }
                } catch (error) {
                    console.error("[AuthListener] Failed to parse URL auth param", error);
                } finally {
                    setIsProcessing(false);
                }
            };

            handleAuth();
        }
    }, [searchParams, user, isProcessing, refreshAuth, router]);

    if (isProcessing) {
        return (
            <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-background/80 backdrop-blur-sm">
                <div className="flex flex-col items-center gap-4">
                    <Loader2 className="h-10 w-10 animate-spin text-primary" />
                    <span className="text-lg font-medium text-muted-foreground">Estabelecendo conexão neural...</span>
                </div>
            </div>
        );
    }

    return null;
}
