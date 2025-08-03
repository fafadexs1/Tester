
'use client';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { BotMessageSquare, MessageCircle } from "lucide-react";

export default function IntegrationsPage() {
    return (
        <div className="flex-1 space-y-4 p-4 md:p-8 pt-6">
            <div className="flex items-center justify-between space-y-2">
                <h2 className="text-3xl font-bold tracking-tight">Integrações</h2>
            </div>

            <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                    <div className="space-y-1.5">
                        <CardTitle className="flex items-center gap-2"><BotMessageSquare className="w-5 h-5 text-teal-500" /> API Evolution</CardTitle>
                        <CardDescription>Conecte-se com a API do WhatsApp para enviar e receber mensagens.</CardDescription>
                    </div>
                    <Button>Gerenciar</Button>
                </CardHeader>
            </Card>

            <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                    <div className="space-y-1.5">
                        <CardTitle className="flex items-center gap-2"><MessageCircle className="w-5 h-5 text-blue-500" /> Chatwoot</CardTitle>
                        <CardDescription>Integre com sua plataforma de atendimento ao cliente Chatwoot.</CardDescription>
                    </div>
                     <Button>Gerenciar</Button>
                </CardHeader>
            </Card>

             <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                    <div className="space-y-1.5">
                        <CardTitle>Supabase</CardTitle>
                        <CardDescription>Conecte um banco de dados Supabase para ler e escrever dados nos fluxos.</CardDescription>
                    </div>
                     <Button>Gerenciar</Button>
                </CardHeader>
            </Card>
        </div>
    );
}
