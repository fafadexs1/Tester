'use client';
import { useState, useEffect, useCallback } from 'react';
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar as CalendarIcon, ListFilter, User, Clock, FileText, Workflow, LogIn, UserPlus } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { ptBR } from 'date-fns/locale';
import { useAuth } from '@/components/auth/AuthProvider';
import { getAuditLogsAction } from '@/app/actions/organizationActions';
import type { AuditLog, OrganizationUser, WorkspaceData } from '@/lib/types';
import { getUsersForOrganizationAction } from '@/app/actions/organizationActions';
import { loadWorkspacesForOrganizationFromDB } from '@/app/actions/databaseActions';
import { useToast } from '@/hooks/use-toast';
import { Loader2 } from 'lucide-react';

const actionIcons: Record<string, React.ReactNode> = {
    'user_login': <LogIn className="w-4 h-4 text-green-500" />,
    'user_register': <UserPlus className="w-4 h-4 text-blue-500" />,
    'create_workspace': <Workflow className="w-4 h-4 text-purple-500" />,
    'default': <FileText className="w-4 h-4 text-gray-500" />,
};

const formatActionText = (log: AuditLog): React.ReactNode => {
    const user = <span className="font-semibold">{log.user?.username || 'Sistema'}</span>;
    switch (log.action) {
        case 'user_login':
            return <>{user} fez login no sistema.</>;
        case 'user_register':
            return <>{user} se registrou no sistema.</>;
        case 'create_workspace':
            return <>{user} criou o fluxo "{log.details.workspaceName || log.details.workspaceId}".</>;
        default:
            return <>{user} realizou a ação: <span className="font-mono text-xs bg-muted px-1 rounded">{log.action}</span>.</>;
    }
};

export default function AuditLogPage() {
    const { user, currentOrganization } = useAuth();
    const { toast } = useToast();
    const [logs, setLogs] = useState<AuditLog[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    
    // Filter states
    const [date, setDate] = useState<Date | undefined>();
    const [selectedMember, setSelectedMember] = useState<string>('all');
    const [selectedAction, setSelectedAction] = useState<string>('all');
    const [selectedWorkspace, setSelectedWorkspace] = useState<string>('all');

    // Data for filters
    const [members, setMembers] = useState<OrganizationUser[]>([]);
    const [workspaces, setWorkspaces] = useState<WorkspaceData[]>([]);

    const fetchFilterData = useCallback(async () => {
        if (!currentOrganization?.id) return;
        
        try {
            const [usersResult, workspacesResult] = await Promise.all([
                getUsersForOrganizationAction(currentOrganization.id),
                loadWorkspacesForOrganizationFromDB(currentOrganization.id)
            ]);

            if (usersResult.success && usersResult.data) {
                setMembers(usersResult.data);
            } else {
                 toast({ title: "Erro ao buscar membros", variant: "destructive", description: usersResult.error });
            }
            // Não há verificação de sucesso para workspaces, assumindo que sempre retorna um array
            setWorkspaces(workspacesResult);

        } catch (error) {
            toast({ title: "Erro ao carregar dados de filtro", variant: "destructive" });
        }
    }, [currentOrganization?.id, toast]);

    const fetchLogs = useCallback(async () => {
        setIsLoading(true);
        try {
            const filters = {
                date: date ? format(date, 'yyyy-MM-dd') : undefined,
                userId: selectedMember !== 'all' ? selectedMember : undefined,
                actionType: selectedAction !== 'all' ? selectedAction : undefined,
                workspaceId: selectedWorkspace !== 'all' ? selectedWorkspace : undefined,
            };
            const result = await getAuditLogsAction(filters);
            if (result.success && result.data) {
                setLogs(result.data);
            } else {
                toast({ title: 'Erro ao carregar logs', description: result.error, variant: 'destructive' });
            }
        } finally {
            setIsLoading(false);
        }
    }, [date, selectedMember, selectedAction, selectedWorkspace, toast]);

    useEffect(() => {
        fetchFilterData();
    }, [fetchFilterData]);

     useEffect(() => {
        fetchLogs();
    }, [fetchLogs]);


    return (
        <div className="flex-1 space-y-4 p-4 md:p-8 pt-6">
            <div className="flex items-center justify-between space-y-2">
                <h2 className="text-3xl font-bold tracking-tight">Logs de Auditoria</h2>
            </div>

            <div className="border rounded-lg p-4 space-y-4">
                 <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
                    <Popover>
                        <PopoverTrigger asChild>
                        <Button
                            variant={"outline"}
                            className={cn(
                            "w-full justify-start text-left font-normal",
                            !date && "text-muted-foreground"
                            )}
                        >
                            <CalendarIcon className="mr-2 h-4 w-4" />
                            {date ? format(date, "PPP", { locale: ptBR }) : <span>Filtrar por data</span>}
                        </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0">
                        <Calendar
                            mode="single"
                            selected={date}
                            onSelect={setDate}
                            initialFocus
                        />
                        </PopoverContent>
                    </Popover>
                    <Select value={selectedMember} onValueChange={setSelectedMember}>
                        <SelectTrigger>
                            <User className="mr-2 h-4 w-4" />
                            <SelectValue placeholder="Todos os Membros" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">Todos os Membros</SelectItem>
                            {members.map(member => (
                                <SelectItem key={member.id} value={member.id}>{member.username}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                     <Select value={selectedWorkspace} onValueChange={setSelectedWorkspace}>
                        <SelectTrigger>
                            <Workflow className="mr-2 h-4 w-4" />
                            <SelectValue placeholder="Todos os Workspaces" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">Todos os Workspaces</SelectItem>
                             {workspaces.map(ws => (
                                <SelectItem key={ws.id} value={ws.id}>{ws.name}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                     <Select value={selectedAction} onValueChange={setSelectedAction}>
                        <SelectTrigger>
                            <ListFilter className="mr-2 h-4 w-4" />
                            <SelectValue placeholder="Todos os Tipos de Ação" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">Todas as Ações</SelectItem>
                            <SelectItem value="user_login">Login</SelectItem>
                            <SelectItem value="user_register">Registro</SelectItem>
                            <SelectItem value="create_workspace">Criação de Fluxo</SelectItem>
                        </SelectContent>
                    </Select>
                     <Button onClick={fetchLogs} disabled={isLoading}>
                        {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : 'Filtrar'}
                    </Button>
                </div>
            </div>

            <div className="space-y-2">
                {isLoading ? (
                    <div className="flex justify-center items-center py-10">
                        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                    </div>
                ) : logs.length === 0 ? (
                     <div className="text-center py-10 text-muted-foreground">
                        <FileText className="mx-auto h-12 w-12" />
                        <p className="mt-4">Nenhum log encontrado para os filtros selecionados.</p>
                    </div>
                ) : (
                    logs.map(log => (
                        <div key={log.id} className="flex items-start space-x-4 p-4 rounded-lg bg-card border">
                            <Avatar>
                                {actionIcons[log.action] || actionIcons['default']}
                            </Avatar>
                            <div className="flex-1">
                                <p className="text-sm">
                                    {formatActionText(log)}
                                </p>
                                <div className="flex items-center text-xs text-muted-foreground mt-1">
                                    <Clock className="w-3 h-3 mr-1.5" />
                                    {format(new Date(log.created_at), "dd 'de' MMMM, yyyy - HH:mm:ss", { locale: ptBR })}
                                </div>
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
}
