
'use client';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckCircle } from 'lucide-react';

export default function BillingPage() {
    return (
        <div className="flex-1 space-y-4 p-4 md:p-8 pt-6">
            <div className="flex items-center justify-between space-y-2">
                <h2 className="text-3xl font-bold tracking-tight">Billing e Assinatura</h2>
            </div>
            
             <Card>
                <CardHeader>
                    <CardTitle>Plano Atual</CardTitle>
                    <CardDescription>Você está atualmente no plano Pro.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="p-6 bg-secondary/30 rounded-lg">
                        <h3 className="text-2xl font-bold text-primary">Plano Pro</h3>
                        <p className="text-4xl font-extrabold mt-2">$49<span className="text-lg font-medium text-muted-foreground">/mês</span></p>
                        <p className="text-muted-foreground mt-1">Sua próxima cobrança será em 15 de Setembro de 2025.</p>
                    </div>
                     <ul className="space-y-2 text-sm text-muted-foreground">
                        <li className="flex items-center"><CheckCircle className="w-4 h-4 mr-2 text-green-500" /> 10 Membros de equipe</li>
                        <li className="flex items-center"><CheckCircle className="w-4 h-4 mr-2 text-green-500" /> Workspaces ilimitados</li>
                        <li className="flex items-center"><CheckCircle className="w-4 h-4 mr-2 text-green-500" /> Logs de auditoria (90 dias)</li>
                        <li className="flex items-center"><CheckCircle className="w-4 h-4 mr-2 text-green-500" /> Suporte prioritário por email</li>
                    </ul>
                </CardContent>
                <CardFooter className="border-t pt-6">
                    <Button>Gerenciar Assinatura</Button>
                </CardFooter>
            </Card>
        </div>
    );
}
