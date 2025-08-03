
'use client';
import { useState } from 'react';
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
import { MoreHorizontal, PlusCircle, Trash2 } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardDescription, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';


const mockMembers = [
    { id: 1, name: 'João Silva', email: 'joao.silva@example.com', role: 'Admin', teams: ['Marketing', 'Vendas'], status: 'ativo' },
    { id: 2, name: 'Maria Oliveira', email: 'maria.oliveira@example.com', role: 'Editor de Fluxo', teams: ['Marketing'], status: 'ativo' },
    { id: 3, name: 'Carlos Pereira', email: 'carlos.pereira@example.com', role: 'Publicador', teams: ['Desenvolvimento'], status: 'ativo' },
    { id: 4, name: 'Ana Souza', email: 'ana.souza@example.com', role: 'Visualizador', teams: [], status: 'ativo' },
    { id: 5, name: 'pedro.costa@example.com', email: 'pedro.costa@example.com', role: 'Editor de Fluxo', teams: [], status: 'pendente' },
];

const mockTeams = [
    { id: 1, name: 'Marketing', description: 'Responsável por campanhas e fluxos de aquisição.', members: mockMembers.slice(0, 2) },
    { id: 2, name: 'Desenvolvimento', description: 'Equipe técnica para fluxos complexos e integrações.', members: [mockMembers[2]] },
    { id: 3, name: 'Vendas', description: 'Focados em fluxos de qualificação de leads.', members: [mockMembers[0]] },
];

export default function MembersPage() {
    const [openInvite, setOpenInvite] = useState(false);
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
                            <DialogTitle>Convidar Novo(s) Membro(s)</DialogTitle>
                            <DialogDescription>
                                Digite os emails, atribua uma função e adicione a times se desejar.
                            </DialogDescription>
                        </DialogHeader>
                        <div className="py-4 space-y-4">
                            <div>
                                <Label htmlFor="emails">Email(s)</Label>
                                <Textarea id="emails" placeholder="Digite um ou mais emails, separados por vírgula." />
                            </div>
                             <div>
                                <Label htmlFor="role">Atribuir Função</Label>
                                <Select defaultValue="editor">
                                    <SelectTrigger id="role">
                                        <SelectValue placeholder="Selecione uma função" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="editor">Editor de Fluxo</SelectItem>
                                        <SelectItem value="publisher">Publicador</SelectItem>
                                        <SelectItem value="viewer">Visualizador</SelectItem>
                                        <SelectItem value="admin">Admin</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                             <div>
                                <Label htmlFor="teams">Adicionar a Times (Opcional)</Label>
                                <Input id="teams" placeholder="Busque por times..." />
                            </div>
                             <div>
                                <Label htmlFor="message">Mensagem Personalizada (Opcional)</Label>
                                <Textarea id="message" placeholder="Junte-se a nós para construir fluxos incríveis!" />
                            </div>
                        </div>
                        <DialogFooter>
                            <Button variant="outline" onClick={() => setOpenInvite(false)}>Cancelar</Button>
                            <Button onClick={() => setOpenInvite(false)}>Enviar Convites</Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            </div>
            
            <Tabs defaultValue="members">
                <TabsList>
                    <TabsTrigger value="members">Membros</TabsTrigger>
                    <TabsTrigger value="teams">Times</TabsTrigger>
                </TabsList>
                <TabsContent value="members">
                    <Card>
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Nome</TableHead>
                                    <TableHead>Função</TableHead>
                                    <TableHead>Time(s)</TableHead>
                                    <TableHead>Status</TableHead>
                                    <TableHead><span className="sr-only">Ações</span></TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {mockMembers.map((member) => (
                                <TableRow key={member.id}>
                                    <TableCell className="font-medium">
                                        <div className="flex items-center gap-3">
                                            <Avatar>
                                                <AvatarImage src={`https://i.pravatar.cc/40?u=${member.email}`} data-ai-hint="avatar person" />
                                                <AvatarFallback>{member.name.slice(0,2)}</AvatarFallback>
                                            </Avatar>
                                            <div>
                                                <p>{member.name}</p>
                                                <p className="text-sm text-muted-foreground">{member.email}</p>
                                            </div>
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        <Select defaultValue={member.role.toLowerCase().replace(/ /g, '-')}>
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
                                        <div className="flex gap-1 flex-wrap">
                                            {member.teams.map(team => <Badge key={team} variant="secondary">{team}</Badge>)}
                                        </div>
                                    </TableCell>
                                     <TableCell>
                                        <Badge variant={member.status === 'ativo' ? 'default' : 'outline'} className={member.status === 'ativo' ? 'bg-green-500/20 text-green-700 border-green-400' : ''}>
                                            {member.status.charAt(0).toUpperCase() + member.status.slice(1)}
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
                                            <DropdownMenuItem>Ver Atividade</DropdownMenuItem>
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
                 <TabsContent value="teams">
                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                        {mockTeams.map(team => (
                            <Card key={team.id}>
                                <CardHeader>
                                    <CardTitle>{team.name}</CardTitle>
                                    <CardDescription>{team.description}</CardDescription>
                                </CardHeader>
                                <CardContent>
                                     <div className="flex -space-x-2 overflow-hidden">
                                        {team.members.map(member => (
                                             <Avatar key={member.id} className="inline-block h-8 w-8 rounded-full ring-2 ring-background">
                                                <AvatarImage src={`https://i.pravatar.cc/40?u=${member.email}`} data-ai-hint="avatar person" />
                                                <AvatarFallback>{member.name.slice(0,2)}</AvatarFallback>
                                            </Avatar>
                                        ))}
                                    </div>
                                </CardContent>
                                 <CardContent className="flex justify-end gap-2">
                                    <Button variant="outline">Editar</Button>
                                    <Button variant="ghost" className="text-destructive hover:text-destructive hover:bg-destructive/10">Excluir</Button>
                                </CardContent>
                            </Card>
                        ))}
                         <Button variant="outline" className="h-full min-h-[150px] border-dashed flex flex-col items-center justify-center gap-2 text-muted-foreground hover:text-foreground hover:bg-muted">
                            <PlusCircle className="w-8 h-8"/>
                            Criar Novo Time
                        </Button>
                    </div>
                </TabsContent>
            </Tabs>
        </div>
    );
}
