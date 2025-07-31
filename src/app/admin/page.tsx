
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from '@/components/ui/button';
import { Users, Workflow, BarChart2, Home } from 'lucide-react';


export default async function AdminPage() {
    const user = await getCurrentUser();

    if (!user) {
        redirect('/login');
    }
    
    // Futuramente, você pode adicionar uma verificação de permissão aqui.
    // Ex: if (user.role !== 'admin') redirect('/');

    return (
        <div className="flex min-h-screen w-full flex-col bg-muted/40">
            <header className="sticky top-0 z-30 flex h-16 items-center gap-4 border-b bg-background px-4 sm:px-6">
                 <Link href="/" className="flex items-center gap-2 text-lg font-semibold sm:text-base mr-4">
                    <div className="w-8 h-8 bg-primary rounded-full flex items-center justify-center">
                        <Workflow className="h-5 w-5 text-primary-foreground" />
                    </div>
                    <span className="sr-only">NexusFlow</span>
                </Link>
                <h1 className="flex-1 shrink-0 whitespace-nowrap text-xl font-semibold tracking-tight sm:grow-0">
                    Painel de Administração
                </h1>
                <div className="ml-auto">
                     <Button asChild variant="outline">
                        <Link href="/">
                            <Home className="mr-2 h-4 w-4" /> Voltar ao Dashboard
                        </Link>
                    </Button>
                </div>
            </header>
            <main className="flex flex-1 flex-col gap-4 p-4 sm:px-8 sm:py-6">
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">
                                Usuários Totais
                            </CardTitle>
                            <Users className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">125</div>
                            <p className="text-xs text-muted-foreground">
                                +5 nos últimos 30 dias
                            </p>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">
                                Workspaces Ativos
                            </CardTitle>
                            <Workflow className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">342</div>
                            <p className="text-xs text-muted-foreground">
                                +12% desde o mês passado
                            </p>
                        </CardContent>
                    </Card>
                     <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">
                                Sessões em Andamento
                            </CardTitle>
                            <BarChart2 className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">45</div>
                            <p className="text-xs text-muted-foreground">
                                Média de 15 min por sessão
                            </p>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">
                                Eventos de Webhook (24h)
                            </CardTitle>
                             <BarChart2 className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">1,234</div>
                            <p className="text-xs text-muted-foreground">
                                Taxa de sucesso de 99.8%
                            </p>
                        </CardContent>
                    </Card>
                </div>
                 <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
                    <Card className="col-span-full lg:col-span-4">
                        <CardHeader>
                            <CardTitle>Visão Geral dos Workspaces</CardTitle>
                        </CardHeader>
                        <CardContent className="pl-2">
                           <p className="text-muted-foreground">Gráfico ou tabela de workspaces virá aqui.</p>
                        </CardContent>
                    </Card>
                     <Card className="col-span-full lg:col-span-3">
                        <CardHeader>
                            <CardTitle>Usuários Recentes</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <p className="text-muted-foreground">Lista de usuários recentes virá aqui.</p>
                        </CardContent>
                    </Card>
                </div>
            </main>
        </div>
    );
}
