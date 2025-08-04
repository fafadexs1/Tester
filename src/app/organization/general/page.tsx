
'use client';
import { useState } from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import { useRouter } from 'next/navigation';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { deleteOrganizationAction } from '@/app/actions/organizationActions';
import { useToast } from "@/hooks/use-toast";
import { Loader2, AlertTriangle } from 'lucide-react';
import type { Organization } from '@/lib/types';


export default function GeneralSettingsPage() {
    const { currentOrganization, organizations, setCurrentOrganization } = useAuth();
    const router = useRouter();
    const { toast } = useToast();
    const [isDeleting, setIsDeleting] = useState(false);
    const [confirmationText, setConfirmationText] = useState("");
    
    const handleDeleteOrganization = async () => {
        if (!currentOrganization) return;
        if (confirmationText !== currentOrganization.name) {
            toast({
                title: "Confirmação incorreta",
                description: "O nome da organização digitado não confere.",
                variant: "destructive",
            });
            return;
        }

        setIsDeleting(true);
        const result = await deleteOrganizationAction(currentOrganization.id);
        
        if (result.success) {
            toast({
                title: "Organização Excluída",
                description: `A organização "${currentOrganization.name}" foi excluída com sucesso.`,
            });
             // Força a recarga para o AuthProvider e AppShell reavaliarem a organização
            window.location.href = '/';
        } else {
            toast({
                title: "Erro ao Excluir",
                description: result.error,
                variant: "destructive",
            });
            setIsDeleting(false);
        }
    };

    return (
        <div className="flex-1 space-y-6 p-4 md:p-8 pt-6">
             <div className="flex items-center justify-between space-y-2">
                <h2 className="text-3xl font-bold tracking-tight">Configurações Gerais</h2>
            </div>
             <Card>
                <CardHeader>
                    <CardTitle>Nome da Organização</CardTitle>
                    <CardDescription>Este é o nome que será exibido para toda a sua equipe.</CardDescription>
                </CardHeader>
                <CardContent>
                    <Input defaultValue={currentOrganization?.name || ''} disabled />
                </CardContent>
                 <CardFooter>
                    <Button disabled>Salvar Alterações</Button>
                </CardFooter>
            </Card>
             <Card>
                <CardHeader>
                    <CardTitle>Ícone da Organização</CardTitle>
                    <CardDescription>Este ícone representa sua organização no aplicativo.</CardDescription>
                </CardHeader>
                <CardContent className="flex items-center gap-4">
                     <Avatar className="h-16 w-16">
                        <AvatarImage src={`https://i.pravatar.cc/150?u=${currentOrganization?.id || 'org'}`} data-ai-hint="logo organization" />
                        <AvatarFallback>{currentOrganization?.name?.slice(0, 2).toUpperCase() || 'OG'}</AvatarFallback>
                    </Avatar>
                    <Button variant="outline" disabled>Carregar Ícone</Button>
                </CardContent>
            </Card>

            <Card className="border-destructive/50">
                <CardHeader>
                    <CardTitle className="text-destructive flex items-center gap-2">
                        <AlertTriangle />
                        Zona de Perigo
                    </CardTitle>
                     <CardDescription>
                        Ações perigosas que não podem ser desfeitas. Tenha certeza absoluta antes de prosseguir.
                    </CardDescription>
                </CardHeader>
                <CardContent className="flex justify-between items-center">
                    <div>
                        <p className="font-semibold">Excluir esta organização</p>
                        <p className="text-sm text-muted-foreground">Isso excluirá permanentemente a organização, incluindo todos os fluxos e dados associados.</p>
                    </div>
                     <AlertDialog>
                        <AlertDialogTrigger asChild>
                            <Button variant="destructive" disabled={!currentOrganization?.is_owner}>
                                {currentOrganization?.is_owner ? 'Excluir Organização' : 'Apenas o proprietário pode excluir'}
                            </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                            <AlertDialogHeader>
                                <AlertDialogTitle>Você tem certeza absoluta?</AlertDialogTitle>
                                <AlertDialogDescription>
                                    Esta ação é irreversível. Todos os dados, incluindo fluxos, membros, e configurações, serão permanentemente excluídos. Para confirmar, digite <strong className="text-foreground">{currentOrganization?.name}</strong> abaixo.
                                </AlertDialogDescription>
                            </AlertDialogHeader>
                             <div className="py-2">
                                <Label htmlFor="org-name-confirmation" className="sr-only">Nome da Organização</Label>
                                <Input
                                    id="org-name-confirmation"
                                    value={confirmationText}
                                    onChange={(e) => setConfirmationText(e.target.value)}
                                    placeholder="Digite o nome da organização aqui"
                                />
                            </div>
                            <AlertDialogFooter>
                                <AlertDialogCancel onClick={() => setConfirmationText('')}>Cancelar</AlertDialogCancel>
                                <Button
                                    variant="destructive"
                                    onClick={handleDeleteOrganization}
                                    disabled={isDeleting || confirmationText !== currentOrganization?.name}
                                >
                                    {isDeleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                    Eu entendo, excluir esta organização
                                </Button>
                            </AlertDialogFooter>
                        </AlertDialogContent>
                    </AlertDialog>
                </CardContent>
            </Card>

        </div>
    );
}
