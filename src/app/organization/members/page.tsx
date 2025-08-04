
'use client';
import { useState, useEffect, useCallback, useMemo } from 'react';
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
import { MoreHorizontal, PlusCircle, Trash2, Loader2, Crown, ShieldCheck } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardDescription, CardHeader, CardTitle, CardContent, CardFooter } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import type { OrganizationUser, Team, Role } from '@/lib/types';
import { getUsersForOrganizationAction, getTeamsForOrganizationAction, createTeamAction, inviteUserToOrganizationAction, getRolesForOrganizationAction } from '@/app/actions/organizationActions';
import { useAuth } from '@/components/auth/AuthProvider';
import { useToast } from '@/hooks/use-toast';
import { Combobox } from '@/components/ui/combobox';


export default function MembersPage() {
    const { user } = useAuth();
    const { toast } = useToast();

    const [members, setMembers] = useState<OrganizationUser[]>([]);
    const [teams, setTeams] = useState<Team[]>([]);
    const [roles, setRoles] = useState<Role[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);
    
    const [openInviteDialog, setOpenInviteDialog] = useState(false);
    const [openCreateTeamDialog, setOpenCreateTeamDialog] = useState(false);
    const [openCreateRoleDialog, setOpenCreateRoleDialog] = useState(false);


    const fetchData = useCallback(async () => {
        if (!user?.current_organization_id) return;
        setIsLoading(true);
        try {
            const [membersResult, teamsResult, rolesResult] = await Promise.all([
                getUsersForOrganizationAction(user.current_organization_id),
                getTeamsForOrganizationAction(user.current_organization_id),
                getRolesForOrganizationAction()
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

            if (rolesResult.success && rolesResult.data) {
                setRoles(rolesResult.data);
            } else {
                 toast({ title: "Erro ao buscar cargos", description: rolesResult.error, variant: "destructive" });
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

    const handleInviteSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        setIsSubmitting(true);
        const formData = new FormData(event.currentTarget);
        const result = await inviteUserToOrganizationAction(formData);

        if (result.success) {
            toast({ title: "Sucesso!", description: "Usuário convidado para a organização." });
            setOpenInviteDialog(false);
            fetchData();
        } else {
            toast({ title: "Erro ao Convidar", description: result.error, variant: "destructive" });
        }
        setIsSubmitting(false);
    };

    const handleCreateTeamSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        setIsSubmitting(true);
        const formData = new FormData(event.currentTarget);
        const result = await createTeamAction(formData);

        if (result.success) {
            toast({ title: "Sucesso!", description: "Time criado com sucesso." });
            setOpenCreateTeamDialog(false);
            fetchData();
        } else {
            toast({ title: "Erro ao Criar Time", description: result.error, variant: "destructive" });
        }
        setIsSubmitting(false);
    };

    const memberOptions = useMemo(() => {
        return members.map(member => ({
            value: member.id,
            label: member.username
        }));
    }, [members]);


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
                <h2 className="text-3xl font-bold tracking-tight">Gerenciamento de Acesso</h2>
                 <Dialog open={openInviteDialog} onOpenChange={setOpenInviteDialog}>
                    <DialogTrigger asChild>
                        <Button>
                            <PlusCircle className="mr-2 h-4 w-4" /> Convidar Membro
                        </Button>
                    </DialogTrigger>
                    <DialogContent>
                        <form onSubmit={handleInviteSubmit}>
                            <DialogHeader>
                                <DialogTitle>Convidar Novo Membro</DialogTitle>
                                <DialogDescription>
                                    Digite o nome de usuário do membro existente para adicioná-lo à sua organização.
                                </DialogDescription>
                            </DialogHeader>
                            <div className="py-4 space-y-4">
                                <div>
                                    <Label htmlFor="username">Nome de Usuário</Label>
                                    <Input id="username" name="username" placeholder="nome.de.usuario" required />
                                </div>
                                <div>
                                    <Label htmlFor="roleId">Atribuir Cargo</Label>
                                    <Select name="roleId" required>
                                        <SelectTrigger id="roleId">
                                            <SelectValue placeholder="Selecione um cargo" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {roles.map(role => (
                                                <SelectItem key={role.id} value={role.id}>{role.name}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>
                            <DialogFooter>
                                <Button type="button" variant="outline" onClick={() => setOpenInviteDialog(false)} disabled={isSubmitting}>Cancelar</Button>
                                <Button type="submit" disabled={isSubmitting}>
                                    {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>}
                                    Convidar
                                </Button>
                            </DialogFooter>
                        </form>
                    </DialogContent>
                </Dialog>
            </div>
            
            <Tabs defaultValue="members" className="mt-4">
                <TabsList>
                    <TabsTrigger value="members">Membros ({members.length})</TabsTrigger>
                    <TabsTrigger value="teams">Times ({teams.length})</TabsTrigger>
                    <TabsTrigger value="roles">Cargos ({roles.length})</TabsTrigger>
                </TabsList>
                <TabsContent value="members" className="mt-4">
                    <Card>
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Nome</TableHead>
                                    <TableHead>Cargo</TableHead>
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
                                            <div className="flex items-center gap-2">
                                                <p>{member.username}</p>
                                                {member.is_owner && (
                                                    <Badge variant="outline" className="text-amber-600 border-amber-500">
                                                        <Crown className="w-3 h-3 mr-1" />
                                                        Proprietário
                                                    </Badge>
                                                )}
                                            </div>
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        <Badge variant="secondary">{member.role || 'Sem cargo'}</Badge>
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
                 <TabsContent value="teams" className="mt-4">
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
                         <Dialog open={openCreateTeamDialog} onOpenChange={setOpenCreateTeamDialog}>
                            <DialogTrigger asChild>
                                <Button variant="outline" className="h-full min-h-[150px] border-dashed flex flex-col items-center justify-center gap-2 text-muted-foreground hover:text-foreground hover:bg-muted">
                                    <PlusCircle className="w-8 h-8"/>
                                    Criar Novo Time
                                </Button>
                            </DialogTrigger>
                             <DialogContent>
                                <form onSubmit={handleCreateTeamSubmit}>
                                    <DialogHeader>
                                        <DialogTitle>Criar Novo Time</DialogTitle>
                                        <DialogDescription>
                                           Organize membros em times para facilitar a gestão de permissões.
                                        </DialogDescription>
                                    </DialogHeader>
                                    <div className="py-4 space-y-4">
                                        <div>
                                            <Label htmlFor="team-name">Nome do Time</Label>
                                            <Input id="team-name" name="name" required/>
                                        </div>
                                         <div>
                                            <Label htmlFor="team-description">Descrição (Opcional)</Label>
                                            <Textarea id="team-description" name="description" />
                                        </div>
                                        <div>
                                            <Label>Adicionar Membros</Label>
                                            <Combobox
                                                options={memberOptions}
                                                placeholder="Selecione os membros..."
                                                searchPlaceholder="Buscar membro..."
                                                notFoundMessage="Nenhum membro encontrado."
                                                name="members"
                                            />
                                        </div>
                                    </div>
                                    <DialogFooter>
                                        <Button type="button" variant="outline" onClick={() => setOpenCreateTeamDialog(false)} disabled={isSubmitting}>Cancelar</Button>
                                        <Button type="submit" disabled={isSubmitting}>
                                            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                            Criar Time
                                        </Button>
                                    </DialogFooter>
                                </form>
                            </DialogContent>
                        </Dialog>
                    </div>
                </TabsContent>
                <TabsContent value="roles" className="mt-4">
                    <Card>
                        <CardHeader>
                            <div className="flex justify-between items-start">
                                <div>
                                    <CardTitle>Cargos e Permissões</CardTitle>
                                    <CardDescription>Crie e gerencie cargos para controlar o acesso na sua organização.</CardDescription>
                                </div>
                                 <Button onClick={() => setOpenCreateRoleDialog(true)} disabled>
                                    <PlusCircle className="mr-2 h-4 w-4" /> Novo Cargo
                                </Button>
                            </div>
                        </CardHeader>
                        <CardContent>
                           <Table>
                               <TableHeader>
                                   <TableRow>
                                       <TableHead>Cargo</TableHead>
                                       <TableHead>Descrição</TableHead>
                                       <TableHead>Permissões</TableHead>
                                       <TableHead><span className="sr-only">Ações</span></TableHead>
                                   </TableRow>
                               </TableHeader>
                               <TableBody>
                                   {roles.map(role => (
                                       <TableRow key={role.id}>
                                           <TableCell className="font-medium flex items-center gap-2">
                                                {role.name}
                                                {role.is_system_role && <Badge variant="outline">Sistema</Badge>}
                                            </TableCell>
                                           <TableCell className="text-muted-foreground">{role.description}</TableCell>
                                           <TableCell>
                                               <Badge variant="secondary">{role.permissions.length} permissões</Badge>
                                           </TableCell>
                                           <TableCell className="text-right">
                                                <Button variant="ghost" size="icon" disabled>
                                                    <MoreHorizontal className="h-4 w-4" />
                                                </Button>
                                           </TableCell>
                                       </TableRow>
                                   ))}
                               </TableBody>
                           </Table>
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>
        </div>
    );
}

    