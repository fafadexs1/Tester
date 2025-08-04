

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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MoreHorizontal, PlusCircle, Trash2, Loader2, Crown, ShieldCheck, Edit, UserPlus, Users, Key, AlertCircle } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardDescription, CardHeader, CardTitle, CardContent, CardFooter } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import type { OrganizationUser, Team, Role, Permission } from '@/lib/types';
import { getUsersForOrganizationAction, getTeamsForOrganizationAction, createTeamAction, inviteUserToOrganizationAction, getRolesForOrganizationAction, getPermissionsAction, createRoleAction, updateRoleAction, deleteRoleAction } from '@/app/actions/organizationActions';
import { useAuth } from '@/components/auth/AuthProvider';
import { useToast } from '@/hooks/use-toast';
import { Combobox } from '@/components/ui/combobox';
import { useSearchParams } from 'next/navigation';


export default function MembersPage() {
    const { user } = useAuth();
    const { toast } = useToast();
    const searchParams = useSearchParams();
    const initialTab = searchParams.get('tab') || 'members';

    const [members, setMembers] = useState<OrganizationUser[]>([]);
    const [teams, setTeams] = useState<Team[]>([]);
    const [roles, setRoles] = useState<Role[]>([]);
    const [permissions, setPermissions] = useState<Permission[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);
    
    const [openInviteDialog, setOpenInviteDialog] = useState(false);
    const [openCreateTeamDialog, setOpenCreateTeamDialog] = useState(false);
    const [editingRole, setEditingRole] = useState<Role | null>(null);
    const [roleToDelete, setRoleToDelete] = useState<Role | null>(null);

    const fetchData = useCallback(async () => {
        if (!user?.current_organization_id) return;
        setIsLoading(true);
        try {
            const [membersResult, teamsResult, rolesResult, permissionsResult] = await Promise.all([
                getUsersForOrganizationAction(user.current_organization_id),
                getTeamsForOrganizationAction(user.current_organization_id),
                getRolesForOrganizationAction(),
                getPermissionsAction(),
            ]);

            if (membersResult.success && membersResult.data) setMembers(membersResult.data);
            else toast({ title: "Erro ao buscar membros", description: membersResult.error, variant: "destructive" });

            if (teamsResult.success && teamsResult.data) setTeams(teamsResult.data);
            else toast({ title: "Erro ao buscar times", description: teamsResult.error, variant: "destructive" });

            if (rolesResult.success && rolesResult.data) setRoles(rolesResult.data);
            else toast({ title: "Erro ao buscar cargos", description: rolesResult.error, variant: "destructive" });

            if (permissionsResult.success && permissionsResult.data) setPermissions(permissionsResult.data);
            else toast({ title: "Erro ao buscar permissões", description: permissionsResult.error, variant: "destructive" });

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

    const handleRoleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        setIsSubmitting(true);
        const formData = new FormData(event.currentTarget);
        
        const result = editingRole?.id
            ? await updateRoleAction(formData)
            : await createRoleAction(formData);
        
        if (result.success) {
            toast({ title: "Sucesso!", description: `Cargo ${editingRole?.id ? 'atualizado' : 'criado'} com sucesso.` });
            setEditingRole(null);
            fetchData();
        } else {
            toast({ title: "Erro ao Salvar Cargo", description: result.error, variant: "destructive" });
        }
        setIsSubmitting(false);
    };

    const handleDeleteRole = async () => {
        if (!roleToDelete) return;
        setIsSubmitting(true);
        const result = await deleteRoleAction(roleToDelete.id);
        if (result.success) {
            toast({ title: "Sucesso!", description: `O cargo "${roleToDelete.name}" foi excluído.` });
            setRoleToDelete(null);
            fetchData();
        } else {
            toast({ title: "Erro ao Excluir", description: result.error, variant: "destructive" });
        }
        setIsSubmitting(false);
    }

    const memberOptions = useMemo(() => {
        return members.map(member => ({
            value: member.id,
            label: member.username
        }));
    }, [members]);

    const permissionsBySubject = useMemo(() => {
        return permissions.reduce((acc, permission) => {
            const subject = permission.subject;
            if (!acc[subject]) {
                acc[subject] = [];
            }
            acc[subject].push(permission);
            return acc;
        }, {} as Record<string, Permission[]>);
    }, [permissions]);


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
                            <UserPlus className="mr-2 h-4 w-4" /> Convidar Membro
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
            
            <Tabs defaultValue={initialTab} className="mt-4">
                <TabsList>
                    <TabsTrigger value="members"><Users className="mr-2 h-4 w-4" />Membros ({members.length})</TabsTrigger>
                    <TabsTrigger value="teams"><Users className="mr-2 h-4 w-4" />Times ({teams.length})</TabsTrigger>
                    <TabsTrigger value="roles"><Key className="mr-2 h-4 w-4" />Cargos ({roles.length})</TabsTrigger>
                </TabsList>

                {/* MEMBERS TAB */}
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
                                            <div>
                                                <div className="flex items-center gap-2">
                                                    <p>{member.full_name || member.username}</p>
                                                    {member.is_owner && (
                                                        <Badge variant="outline" className="text-amber-600 border-amber-500">
                                                            <Crown className="w-3 h-3 mr-1" />
                                                            Proprietário
                                                        </Badge>
                                                    )}
                                                </div>
                                                <p className="text-xs text-muted-foreground">{member.email}</p>
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
                                            <Button aria-haspopup="true" size="icon" variant="ghost" disabled={member.is_owner}>
                                            <MoreHorizontal className="h-4 w-4" />
                                            <span className="sr-only">Toggle menu</span>
                                            </Button>
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent align="end">
                                            <DropdownMenuItem>Editar Cargo</DropdownMenuItem>
                                            <DropdownMenuItem className="text-destructive focus:text-destructive">Remover da Organização</DropdownMenuItem>
                                        </DropdownMenuContent>
                                        </DropdownMenu>
                                    </TableCell>
                                </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </Card>
                </TabsContent>

                 {/* TEAMS TAB */}
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

                {/* ROLES TAB */}
                <TabsContent value="roles" className="mt-4">
                    <Card>
                        <CardHeader>
                            <div className="flex justify-between items-start">
                                <div>
                                    <CardTitle>Cargos e Permissões</CardTitle>
                                    <CardDescription>Crie e gerencie cargos para controlar o acesso na sua organização.</CardDescription>
                                </div>
                                 <Button onClick={() => setEditingRole({} as Role)}>
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
                                       <TableHead className="text-right">Ações</TableHead>
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
                                                <Button variant="ghost" size="icon" onClick={() => setEditingRole(role)} disabled={role.is_system_role}>
                                                    <Edit className="h-4 w-4" />
                                                </Button>
                                                <Button variant="ghost" size="icon" onClick={() => setRoleToDelete(role)} disabled={role.is_system_role} className="text-destructive hover:text-destructive">
                                                    <Trash2 className="h-4 w-4" />
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

            {/* Role Editor Dialog */}
            <Dialog open={!!editingRole} onOpenChange={(open) => !open && setEditingRole(null)}>
                <DialogContent className="sm:max-w-2xl max-h-[90vh] flex flex-col">
                    <form onSubmit={handleRoleSubmit}>
                        <DialogHeader>
                            <DialogTitle>{editingRole?.id ? 'Editar Cargo' : 'Criar Novo Cargo'}</DialogTitle>
                            <DialogDescription>
                                Defina um nome, descrição e as permissões para este cargo.
                            </DialogDescription>
                        </DialogHeader>
                        <div className="py-4 space-y-4 flex-1 overflow-y-auto pr-6 -mr-6">
                            <input type="hidden" name="roleId" value={editingRole?.id || ''} />
                            <div>
                                <Label htmlFor="role-name">Nome do Cargo</Label>
                                <Input id="role-name" name="name" defaultValue={editingRole?.name} required />
                            </div>
                            <div>
                                <Label htmlFor="role-description">Descrição</Label>
                                <Textarea id="role-description" name="description" defaultValue={editingRole?.description} />
                            </div>
                            <div>
                                <Label>Permissões</Label>
                                <div className="space-y-4 mt-2">
                                    {Object.entries(permissionsBySubject).map(([subject, perms]) => (
                                        <div key={subject}>
                                            <h4 className="font-semibold text-sm mb-2">{subject}</h4>
                                            <div className="grid grid-cols-2 md:grid-cols-3 gap-x-4 gap-y-2 pl-2">
                                                {perms.map(perm => (
                                                    <div key={perm.id} className="flex items-center space-x-2">
                                                        <Checkbox
                                                            id={`perm-${perm.id}`}
                                                            name="permissions"
                                                            value={perm.id}
                                                            defaultChecked={editingRole?.permissions?.includes(perm.id)}
                                                        />
                                                        <label htmlFor={`perm-${perm.id}`} className="text-sm font-normal leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70" title={perm.description}>
                                                            {perm.description}
                                                        </label>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                        <DialogFooter>
                            <Button type="button" variant="outline" onClick={() => setEditingRole(null)} disabled={isSubmitting}>Cancelar</Button>
                            <Button type="submit" disabled={isSubmitting}>
                                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                Salvar Cargo
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

             {/* Role Delete Confirmation */}
            <AlertDialog open={!!roleToDelete} onOpenChange={(open) => !open && setRoleToDelete(null)}>
                <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>Tem certeza?</AlertDialogTitle>
                    <AlertDialogDescription>
                    Esta ação não pode ser desfeita. Isso excluirá permanentemente o cargo <strong>{roleToDelete?.name}</strong>. Nenhum usuário será removido, mas você precisará atribuir um novo cargo a eles.
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel onClick={() => setRoleToDelete(null)}>Cancelar</AlertDialogCancel>
                    <AlertDialogAction onClick={handleDeleteRole} className="bg-destructive hover:bg-destructive/90">
                        {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : 'Sim, Excluir Cargo'}
                    </AlertDialogAction>
                </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
