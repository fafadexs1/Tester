
'use client';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

export default function GeneralSettingsPage() {
    return (
        <div className="flex-1 space-y-4 p-4 md:p-8 pt-6">
             <div className="flex items-center justify-between space-y-2">
                <h2 className="text-3xl font-bold tracking-tight">Configurações Gerais</h2>
            </div>
             <Card>
                <CardHeader>
                    <CardTitle>Nome da Organização</CardTitle>
                    <CardDescription>Este é o nome que será exibido para toda a sua equipe.</CardDescription>
                </CardHeader>
                <CardContent>
                    <Input defaultValue="Minha Organização" />
                </CardContent>
            </Card>
             <Card>
                <CardHeader>
                    <CardTitle>Ícone da Organização</CardTitle>
                    <CardDescription>Este ícone representa sua organização no aplicativo.</CardDescription>
                </CardHeader>
                <CardContent className="flex items-center gap-4">
                     <Avatar className="h-16 w-16">
                        <AvatarImage src="https://i.pravatar.cc/150?u=org-icon" data-ai-hint="logo organization" />
                        <AvatarFallback>MO</AvatarFallback>
                    </Avatar>
                    <Button variant="outline">Carregar Ícone</Button>
                </CardContent>
            </Card>
             <div className="flex justify-end">
                <Button>Salvar Alterações</Button>
            </div>
        </div>
    );
}
