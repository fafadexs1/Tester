
'use client';
import { useState, useEffect, useCallback } from 'react';
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MoreHorizontal, PlusCircle, Trash2, Loader2 } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardDescription, CardHeader, CardTitle, CardContent, CardFooter } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import type { OrganizationUser, Team } from '@/lib/types';
import { getUsersForOrganization, getTeamsForOrganization } from '@/app/actions/organizationActions';
import { useAuth } from '@/components/auth/AuthProvider';
import { useToast } from '@/hooks/use-toast';

export default function MembersPage() {
    const { user } = useAuth();
    const { toast } = useToast();

    const [members, setMembers] = useState<OrganizationUser[]>([]);
    const [teams, setTeams] = useState<Team[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [openInvite, setOpenInvite] = useState(false);

    const fetchData = useCallback(async () => {
        if (!user?.current_organization_id) return;
        setIsLoading(true);
        try {
            const [membersResult, teamsResult] = await Promise.all([
                getUsersForOrganization(user.current_organization_id),
                getTeamsForOrganization(user.current_organization_id)
            ]);

            if (membersResult.success && membersResult.data) {
                setMembers(membersResult.data);
            } else {
                toast({ title: "Erro ao buscar membros", description: membersResult.error, variant: "destructive" });
            }

            if (teamsResult.success && teamsResult.data) {
                setTeams(teamsResult.data);
            } else {
                toast({ title: "Erro ao buscar times", description: teamsResult.error, variant: "destructive" });
            }

        } catch (error: any) {
            toast({ title: "Erro de Conexão", description: "Não foi possível carregar os dados da organização.", variant: "destructive" });
        } finally {
            setIsLoading(false);
        }
    }, [user?.current_organization_id, toast]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    if (isLoading) {
        return (
            <div className="flex-1 space-y-4 p-4 md:p-8 pt-6 flex items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
        );
    }

    return (
        <div className="flex-1 space-y-4 p-4 md:p-8 pt-6">
            <div className="flex items-center justify-between space-y-2">
                <h2 className="text-3xl font-bold tracking-tight">Membros e Times</h2>
                <Dialog open={openInvite} onOpenChange={setOpenInvite}>
                    <DialogTrigger asChild>
                        <Button>
                            <PlusCircle className="mr-2 h-4 w-4" /> Convidar Membro
                        </Button>
                    </DialogTrigger>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>Convidar Novo(s) Membro(s) (Em breve)</DialogTitle>
                            <DialogDescription>
                                Digite os emails, atribua uma função e adicione a times se desejar.
                            </DialogDescription>
                        </DialogHeader>
                        <div className="py-4 space-y-4">
                            <div>
                                <Label htmlFor="emails">Email(s)</Label>
                                <Textarea id="emails" placeholder="Digite um ou mais emails, separados por vírgula." disabled />
                            </div>
                             <div>
                                <Label htmlFor="role">Atribuir Função</Label>
                                <Select defaultValue="editor" disabled>
                                    <SelectTrigger id="role">
                                        <SelectValue placeholder="Selecione uma função" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="editor">Editor de Fluxo</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                        <DialogFooter>
                            <Button variant="outline" onClick={() => setOpenInvite(false)}>Cancelar</Button>
                            <Button onClick={() => setOpenInvite(false)} disabled>Enviar Convites</Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            </div>
            
            <Tabs defaultValue="members">
                <TabsList>
                    <TabsTrigger value="members">Membros ({members.length})</TabsTrigger>
                    <TabsTrigger value="teams">Times ({teams.length})</TabsTrigger>
                </TabsList>
                <TabsContent value="members">
                    <Card>
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Nome</TableHead>
                                    <TableHead>Função</TableHead>
                                    <TableHead>Status</TableHead>
                                    <TableHead><span className="sr-only">Ações</span></TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {members.map((member) => (
                                <TableRow key={member.id}>
                                    <TableCell className="font-medium">
                                        <div className="flex items-center gap-3">
                                            <Avatar>
                                                <AvatarImage src={`https://i.pravatar.cc/40?u=${member.username}`} data-ai-hint="avatar person" />
                                                <AvatarFallback>{member.username.slice(0,2).toUpperCase()}</AvatarFallback>
                                            </Avatar>
                                            <div>
                                                <p>{member.username}</p>
                                                {/* Email não está no model OrganizationUser, precisaria adicionar se necessário */}
                                            </div>
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        <Select defaultValue={member.role.toLowerCase().replace(/ /g, '-')} disabled>
                                            <SelectTrigger className="w-[180px]">
                                                <SelectValue placeholder="Selecione a função" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="admin">Admin</SelectItem>
                                                <SelectItem value="editor-de-fluxo">Editor de Fluxo</SelectItem>
                                                <SelectItem value="publicador">Publicador</SelectItem>
                                                <SelectItem value="visualizador">Visualizador</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </TableCell>
                                     <TableCell>
                                        <Badge variant='outline' className={'bg-green-500/20 text-green-700 border-green-400'}>
                                            Ativo
                                        </Badge>
                                    </TableCell>
                                    <TableCell>
                                        <DropdownMenu>
                                        <DropdownMenuTrigger asChild>
                                            <Button aria-haspopup="true" size="icon" variant="ghost">
                                            <MoreHorizontal className="h-4 w-4" />
                                            <span className="sr-only">Toggle menu</span>
                                            </Button>
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent align="end">
                                            <DropdownMenuItem disabled>Ver Atividade</DropdownMenuItem>
                                            <DropdownMenuItem disabled className="text-destructive focus:text-destructive">Remover da Organização</DropdownMenuItem>
                                        </DropdownMenuContent>
                                        </DropdownMenu>
                                    </TableCell>
                                </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </Card>
                </TabsContent>
                 <TabsContent value="teams">
                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                        {teams.map(team => (
                            <Card key={team.id}>
                                <CardHeader>
                                    <CardTitle>{team.name}</CardTitle>
                                    <CardDescription>{team.description || 'Sem descrição.'}</CardDescription>
                                </CardHeader>
                                <CardContent>
                                     <div className="flex -space-x-2 overflow-hidden">
                                        {team.members.map(member => (
                                             <Avatar key={member.id} className="inline-block h-8 w-8 rounded-full ring-2 ring-background">
                                                <AvatarImage src={`https://i.pravatar.cc/40?u=${member.username}`} data-ai-hint="avatar person" />
                                                <AvatarFallback>{member.username.slice(0,2).toUpperCase()}</AvatarFallback>
                                            </Avatar>
                                        ))}
                                    </div>
                                </CardContent>
                                 <CardFooter className="flex justify-end gap-2">
                                    <Button variant="outline" disabled>Editar</Button>
                                    <Button variant="ghost" className="text-destructive hover:text-destructive hover:bg-destructive/10" disabled>Excluir</Button>
                                </CardFooter>
                            </Card>
                        ))}
                         <Button variant="outline" className="h-full min-h-[150px] border-dashed flex flex-col items-center justify-center gap-2 text-muted-foreground hover:text-foreground hover:bg-muted" disabled>
                            <PlusCircle className="w-8 h-8"/>
                            Criar Novo Time (Em breve)
                        </Button>
                    </div>
                </TabsContent>
            </Tabs>
        </div>
    );
}
