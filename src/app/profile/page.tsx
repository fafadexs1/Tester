
'use client';

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/auth/AuthProvider";
import type { User } from '@/lib/types';
import Link from 'next/link';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Copy, Home, Workflow, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function ProfilePage() {
    const { user, loading } = useAuth();
    const router = useRouter();
    const { toast } = useToast();

    // Redireciona se o usuário não estiver logado após o carregamento
    useEffect(() => {
        if (!loading && !user) {
            router.push('/login');
        }
    }, [user, loading, router]);

    const apiToken = user ? `nexus_tk_${Buffer.from(user.id).toString('hex')}` : '';

    const handleCopyToken = () => {
        if (!apiToken) return;
        navigator.clipboard.writeText(apiToken).then(() => {
            toast({ title: "Token de API Copiado!" });
        }).catch(err => {
            toast({ title: "Erro ao copiar", description: "Não foi possível copiar o token.", variant: "destructive" });
            console.error("Failed to copy token: ", err);
        });
    };
    
    const handleCopyUserId = () => {
        if (!user || !user.id) return;
         navigator.clipboard.writeText(user.id).then(() => {
            toast({ title: "ID do Usuário Copiado!" });
        }).catch(err => {
            toast({ title: "Erro ao copiar", description: "Não foi possível copiar o ID.", variant: "destructive" });
            console.error("Failed to copy user ID: ", err);
        });
    };

    if (loading || !user) {
        return (
            <div className="flex h-screen w-full items-center justify-center bg-muted/40">
                <Loader2 className="h-12 w-12 animate-spin text-primary" />
            </div>
        );
    }

    return (
        <div className="flex min-h-screen w-full flex-col bg-muted/40">
            <header className="sticky top-0 z-30 flex h-16 items-center justify-between gap-4 border-b bg-background px-4 sm:px-6">
                <Link href="/" className="flex items-center gap-2 text-lg font-semibold sm:text-base">
                    <div className="w-8 h-8 bg-primary rounded-full flex items-center justify-center">
                        <Workflow className="h-5 w-5 text-primary-foreground" />
                    </div>
                    <span className="sr-only">NexusFlow</span>
                </Link>
                 <div className="ml-auto">
                     <Button asChild variant="outline">
                        <Link href="/">
                            <Home className="mr-2 h-4 w-4" /> Voltar ao Dashboard
                        </Link>
                    </Button>
                </div>
            </header>
            <main className="flex flex-1 items-center justify-center p-4">
                 <Card className="w-full max-w-2xl">
                    <CardHeader>
                        <CardTitle className="text-2xl">Perfil de Usuário</CardTitle>
                        <CardDescription>
                            Veja suas informações e gerencie suas chaves de API.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        <div className="space-y-2">
                            <Label htmlFor="userId">ID do Usuário</Label>
                             <div className="flex items-center space-x-2">
                                <Input id="userId" readOnly value={user.id} />
                                <Button variant="outline" size="icon" onClick={handleCopyUserId}>
                                    <Copy className="h-4 w-4" />
                                </Button>
                            </div>
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="username">Nome de Usuário</Label>
                            <Input id="username" readOnly value={user.username} />
                        </div>
                        <div className="space-y-2">
                            <Label>Role</Label>
                            <Input readOnly value={user.role} className="capitalize"/>
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="apiToken">Seu Token de API (exemplo)</Label>
                            <div className="flex items-center space-x-2">
                                <Input id="apiToken" readOnly type="password" value={apiToken} />
                                <Button variant="outline" size="icon" onClick={handleCopyToken}>
                                    <Copy className="h-4 w-4" />
                                </Button>
                            </div>
                            <p className="text-xs text-muted-foreground">
                                Este token é para futuras integrações de API. Mantenha-o seguro.
                            </p>
                        </div>
                    </CardContent>
                     <CardFooter>
                        <Button disabled>Salvar Alterações (desabilitado)</Button>
                    </CardFooter>
                </Card>
            </main>
        </div>
    );
}

    