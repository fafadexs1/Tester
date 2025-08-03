
'use client';
import { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar as CalendarIcon, ListFilter, User, Clock, FileText } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { format } from "date-fns";

const mockLogs = [
    { id: 'log1', user: { name: 'João Silva', avatar: '/avatars/01.png' }, action: 'publicou o fluxo "Boas-vindas Cliente".', timestamp: new Date('2025-08-02T22:15:00Z'), type: 'publish' },
    { id: 'log2', user: { name: 'Maria Oliveira', avatar: '/avatars/02.png' }, action: 'convidou pedro.costa@email.com para a organização com a função de Editor de Fluxo.', timestamp: new Date('2025-08-02T18:30:00Z'), type: 'invite' },
    { id: 'log3', user: { name: 'Ana Souza', avatar: '/avatars/03.png' }, action: 'editou o nó API de Pagamento no fluxo "Compra Finalizada".', timestamp: new Date('2025-08-01T11:50:00Z'), type: 'edit' },
    { id: 'log4', user: { name: 'Carlos Pereira', avatar: '/avatars/04.png' }, action: 'alterou as configurações de integração do Chatwoot.', timestamp: new Date('2025-08-01T09:05:00Z'), type: 'settings' },
    { id: 'log5', user: { name: 'João Silva', avatar: '/avatars/01.png' }, action: 'criou o fluxo "Follow-up de Carrinho".', timestamp: new Date('2025-07-31T15:20:00Z'), type: 'create' },
];


export default function AuditLogPage() {
    const [date, setDate] = useState<Date | undefined>(undefined);

    return (
        <div className="flex-1 space-y-4 p-4 md:p-8 pt-6">
            <div className="flex items-center justify-between space-y-2">
                <h2 className="text-3xl font-bold tracking-tight">Logs de Auditoria</h2>
            </div>

            <div className="border rounded-lg p-4 space-y-4">
                 <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
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
                            {date ? format(date, "PPP") : <span>Selecione uma data</span>}
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
                    <Select>
                        <SelectTrigger>
                            <User className="mr-2 h-4 w-4" />
                            <SelectValue placeholder="Todos os Membros" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="joao">João Silva</SelectItem>
                            <SelectItem value="maria">Maria Oliveira</SelectItem>
                            <SelectItem value="ana">Ana Souza</SelectItem>
                        </SelectContent>
                    </Select>
                     <Select>
                        <SelectTrigger>
                            <ListFilter className="mr-2 h-4 w-4" />
                            <SelectValue placeholder="Todos os Tipos de Ação" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="publish">Publicação de Fluxo</SelectItem>
                            <SelectItem value="edit">Edição de Fluxo</SelectItem>
                            <SelectItem value="create">Criação de Fluxo</SelectItem>
                            <SelectItem value="invite">Convite de Membro</SelectItem>
                            <SelectItem value="settings">Alteração de Configuração</SelectItem>
                        </SelectContent>
                    </Select>
                     <Button>Filtrar</Button>
                </div>
            </div>

            <div className="space-y-4">
                {mockLogs.map(log => (
                    <div key={log.id} className="flex items-start space-x-4 p-4 rounded-lg bg-card border">
                        <Avatar>
                            <AvatarImage src={`https://i.pravatar.cc/40?u=${log.user.name}`} data-ai-hint="avatar person" />
                            <AvatarFallback>{log.user.name.charAt(0)}</AvatarFallback>
                        </Avatar>
                        <div className="flex-1">
                            <p className="text-sm">
                                <span className="font-semibold">{log.user.name}</span> {log.action}
                            </p>
                            <div className="flex items-center text-xs text-muted-foreground mt-1">
                                <Clock className="w-3 h-3 mr-1.5" />
                                {format(log.timestamp, "dd 'de' MMMM, yyyy - HH:mm")}
                            </div>
                        </div>
                         <Button variant="ghost" size="icon" className="w-8 h-8">
                            <FileText className="w-4 h-4" />
                            <span className="sr-only">Ver Detalhes</span>
                        </Button>
                    </div>
                ))}
            </div>
        </div>
    );
}
