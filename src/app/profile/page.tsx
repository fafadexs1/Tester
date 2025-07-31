
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import Link from 'next/link';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Copy, Home, Workflow } from "lucide-react";


export default async function ProfilePage() {
    const user = await getCurrentUser();

    if (!user) {
        redirect('/login');
    }

    // Gerar um token de API de exemplo
    const apiToken = `nexus_tk_${Buffer.from(user.username).toString('hex')}_${new Date().getFullYear()}`;

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
                            <Input id="userId" readOnly value={user.username} />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="apiToken">Seu Token de API</Label>
                            <div className="flex items-center space-x-2">
                                <Input id="apiToken" readOnly type="password" value={apiToken} />
                                <Button variant="outline" size="icon" onClick={() => {
                                    // A cópia precisa ser feita no cliente, mas podemos preparar a estrutura
                                    // Esta é uma simulação, a lógica real estaria em um client component.
                                }}>
                                    <Copy className="h-4 w-4" />
                                </Button>
                            </div>
                            <p className="text-xs text-muted-foreground">
                                Este token é para futuras integrações de API. Mantenha-o seguro.
                            </p>
                        </div>
                    </CardContent>
                     <CardFooter>
                        <Button>Salvar Alterações</Button>
                    </CardFooter>
                </Card>
            </main>
        </div>
    );
}

