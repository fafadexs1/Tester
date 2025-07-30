
'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
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
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { MoreHorizontal, BotMessageSquare, PlusCircle, ArrowRight, Trash2, Pencil } from 'lucide-react';
import type { WorkspaceData } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { deleteWorkspaceAction } from '@/app/actions/databaseActions';
import { motion, AnimatePresence } from 'framer-motion';

interface WorkspaceListProps {
  initialWorkspaces: WorkspaceData[];
}

export default function WorkspaceList({ initialWorkspaces }: WorkspaceListProps) {
  const [workspaces, setWorkspaces] = useState<WorkspaceData[]>(initialWorkspaces);
  const router = useRouter();
  const { toast } = useToast();

  const handleOpenWorkspace = (workspaceId: string) => {
    router.push(`/flow/${workspaceId}`);
  };

  const handleDeleteWorkspace = async (workspaceId: string) => {
    const result = await deleteWorkspaceAction(workspaceId);
    if (result.success) {
      setWorkspaces(prev => prev.filter(ws => ws.id !== workspaceId));
      toast({
        title: "Fluxo Excluído",
        description: "O fluxo foi excluído com sucesso.",
      });
    } else {
      toast({
        title: "Erro ao Excluir",
        description: result.error || "Não foi possível excluir o fluxo.",
        variant: "destructive",
      });
    }
  };

  const cardVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: (i: number) => ({
      opacity: 1,
      y: 0,
      transition: {
        delay: i * 0.05,
        type: 'spring',
        stiffness: 300,
        damping: 20,
      },
    }),
    exit: { opacity: 0, scale: 0.9, transition: { duration: 0.2 } },
  };

  return (
    <div>
      <AnimatePresence>
        {workspaces.length > 0 ? (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {workspaces.map((ws, i) => (
              <motion.div
                key={ws.id}
                custom={i}
                variants={cardVariants}
                initial="hidden"
                animate="visible"
                exit="exit"
                layout
              >
                <Card 
                  className="group flex flex-col justify-between overflow-hidden rounded-xl shadow-sm transition-all duration-300 hover:shadow-lg hover:-translate-y-1 border-border/60 bg-card/80 backdrop-blur-sm"
                >
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <CardTitle className="truncate pr-4 font-semibold text-lg">{ws.name}</CardTitle>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground group-hover:text-foreground">
                            <MoreHorizontal className="h-5 w-5" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => handleOpenWorkspace(ws.id)}>
                            <Pencil className="mr-2 h-4 w-4" />
                            Editar
                          </DropdownMenuItem>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <DropdownMenuItem onSelect={(e) => e.preventDefault()} className="text-destructive focus:bg-destructive/10 focus:text-destructive">
                                <Trash2 className="mr-2 h-4 w-4" />
                                Excluir
                              </DropdownMenuItem>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Você tem certeza?</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Esta ação não pode ser desfeita. Isso excluirá permanentemente o fluxo <strong className="text-foreground">{ws.name}</strong> e todos os seus dados.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                <AlertDialogAction onClick={() => handleDeleteWorkspace(ws.id)} className="bg-destructive hover:bg-destructive/90">
                                  Sim, excluir
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                    <CardDescription>
                      {`Atualizado em: ${new Date(ws.updated_at || Date.now()).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })}`}
                    </CardDescription>
                  </CardHeader>
                  <CardFooter 
                    className="flex items-center justify-end p-4 bg-muted/20 transition-colors group-hover:bg-muted/40 cursor-pointer"
                    onClick={() => handleOpenWorkspace(ws.id)}
                  >
                     <div className="flex items-center text-sm font-medium text-primary">
                          Abrir Editor
                          <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
                      </div>
                  </CardFooter>
                </Card>
              </motion.div>
            ))}
          </div>
        ) : (
          <div className="col-span-full flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-muted-foreground/30 py-24 text-center">
              <BotMessageSquare className="w-16 h-16 text-muted-foreground/70 mb-4"/>
              <h3 className="text-xl font-semibold">Nenhum fluxo encontrado</h3>
              <p className="text-muted-foreground mt-2 mb-6 max-w-sm">Parece que você ainda não criou nenhum fluxo. Que tal começar agora?</p>
              <Link href="/flow/new">
                <Button className="flex items-center gap-2">
                    <PlusCircle className="h-5 w-5" />
                    Criar seu Primeiro Fluxo
                </Button>
              </Link>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
