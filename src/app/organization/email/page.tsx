
'use client';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { redirect } from 'next/navigation';
import { useAuth } from '@/components/auth/AuthProvider';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useToast } from '@/hooks/use-toast';
import { Loader2, Save, Mail } from 'lucide-react';
import { getSmtpSettingsAction, saveSmtpSettingsAction } from '@/app/actions/smtpActions';
import type { SmtpSettings } from '@/lib/types';


const smtpSettingsSchema = z.object({
    host: z.string().min(1, "O host é obrigatório."),
    port: z.coerce.number().min(1, "A porta é obrigatória."),
    secure: z.boolean(),
    username: z.string().optional(),
    password: z.string().optional(),
    from_name: z.string().optional(),
    from_email: z.string().email("E-mail do remetente inválido.").optional(),
});


export default function SmtpSettingsPage() {
    const { user } = useAuth();
    const { toast } = useToast();
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    
    const { register, handleSubmit, reset, setValue, formState: { errors } } = useForm<z.infer<typeof smtpSettingsSchema>>({
        resolver: zodResolver(smtpSettingsSchema),
        defaultValues: {
            secure: true,
        },
    });

    useEffect(() => {
        if (user && user.role !== 'desenvolvedor') {
            redirect('/');
        }
        if (user?.current_organization_id) {
            setIsLoading(true);
            getSmtpSettingsAction()
                .then(result => {
                    if (result.success && result.data) {
                        reset(result.data);
                    } else if (!result.success) {
                        toast({ title: 'Erro ao carregar configurações', description: result.error, variant: 'destructive' });
                    }
                })
                .finally(() => setIsLoading(false));
        }
    }, [user, reset, toast]);

    const onSubmit = async (data: z.infer<typeof smtpSettingsSchema>) => {
        setIsSaving(true);
        const result = await saveSmtpSettingsAction(data);
        if (result.success) {
            toast({ title: 'Sucesso!', description: 'Configurações de SMTP salvas com sucesso.' });
        } else {
            toast({ title: 'Erro ao salvar', description: result.error, variant: 'destructive' });
        }
        setIsSaving(false);
    };

    if (isLoading) {
        return (
             <div className="flex-1 space-y-4 p-4 md:p-8 pt-6">
                 <div className="flex items-center justify-center p-10">
                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
            </div>
        );
    }
    
    if (user?.role !== 'desenvolvedor') {
        return null;
    }

    return (
        <form onSubmit={handleSubmit(onSubmit)} className="flex-1 space-y-4 p-4 md:p-8 pt-6">
            <div className="flex items-center justify-between space-y-2">
                <h2 className="text-3xl font-bold tracking-tight">Configurações de E-mail (SMTP)</h2>
                <Button type="submit" disabled={isSaving}>
                    {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                    Salvar Alterações
                </Button>
            </div>
            
            <Card>
                <CardHeader>
                    <CardTitle>Configuração do Servidor SMTP</CardTitle>
                    <CardDescription>
                        Forneça os detalhes do seu servidor de e-mail para habilitar o envio de e-mails transacionais e promocionais.
                        As senhas são armazenadas de forma segura (criptografadas em um cenário real).
                    </CardDescription>
                </CardHeader>
                <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                        <Label htmlFor="host">Host SMTP</Label>
                        <Input id="host" {...register("host")} placeholder="smtp.example.com" />
                        {errors.host && <p className="text-sm text-destructive">{errors.host.message}</p>}
                    </div>
                     <div className="space-y-2">
                        <Label htmlFor="port">Porta</Label>
                        <Input id="port" type="number" {...register("port")} placeholder="587" />
                        {errors.port && <p className="text-sm text-destructive">{errors.port.message}</p>}
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="username">Usuário</Label>
                        <Input id="username" {...register("username")} placeholder="seu_usuario@example.com" />
                        {errors.username && <p className="text-sm text-destructive">{errors.username.message}</p>}
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="password">Senha</Label>
                        <Input id="password" type="password" {...register("password")} />
                        {errors.password && <p className="text-sm text-destructive">{errors.password.message}</p>}
                    </div>
                     <div className="space-y-2 col-span-1 md:col-span-2">
                        <Label htmlFor="from_name">Nome do Remetente</Label>
                        <Input id="from_name" {...register("from_name")} placeholder="Nome da Sua Empresa" />
                        {errors.from_name && <p className="text-sm text-destructive">{errors.from_name.message}</p>}
                    </div>
                     <div className="space-y-2 col-span-1 md:col-span-2">
                        <Label htmlFor="from_email">E-mail do Remetente</Label>
                        <Input id="from_email" {...register("from_email")} placeholder="nao-responda@suaempresa.com" />
                        {errors.from_email && <p className="text-sm text-destructive">{errors.from_email.message}</p>}
                    </div>
                    <div className="flex items-center space-x-2">
                        <Switch id="secure" {...register("secure")} onCheckedChange={(checked) => setValue('secure', checked)} />
                        <Label htmlFor="secure">Usar Conexão Segura (SSL/TLS)</Label>
                    </div>
                </CardContent>
            </Card>
        </form>
    );
}
