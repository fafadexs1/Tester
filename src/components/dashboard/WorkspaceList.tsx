
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
} from "@/components/ui/alert-dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { MoreHorizontal, BotMessageSquare, ArrowRight, Trash2, Pencil } from 'lucide-react';
import type { WorkspaceData } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { deleteWorkspaceAction } from '@/app/actions/databaseActions';
import { motion, AnimatePresence } from 'framer-motion';

interface WorkspaceListProps {
  workspaces: WorkspaceData[]; // Nome da prop mudado para workspaces
  onWorkspacesChange: () => void;
}

// O componente agora recebe os workspaces como uma prop e não tem mais seu próprio estado para a lista
export default function WorkspaceList({ workspaces, onWorkspacesChange }: WorkspaceListProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [workspaceToDelete, setWorkspaceToDelete] = useState<WorkspaceData | null>(null);

  const handleOpenWorkspace = (workspaceId: string) => {
    router.push(`/flow/${workspaceId}`);
  };

  const handleDeleteWorkspace = async (workspaceId: string) => {
    const result = await deleteWorkspaceAction(workspaceId);
    if (result.success) {
      onWorkspacesChange(); // Notifica o pai para recarregar
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
    setWorkspaceToDelete(null);
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
    <>
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
                    className="group flex flex-col justify-between overflow-hidden rounded-2xl border border-white/5 bg-zinc-900/40 backdrop-blur-md shadow-lg transition-all duration-300 hover:shadow-violet-500/10 hover:border-violet-500/20 hover:-translate-y-1"
                  >
                    <CardHeader className="relative pb-2">
                      <div className="absolute top-0 right-0 p-3 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-zinc-400 hover:text-white hover:bg-white/10 rounded-full">
                              <MoreHorizontal className="h-5 w-5" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="bg-zinc-950 border-white/10 text-zinc-300">
                            <DropdownMenuItem onClick={() => handleOpenWorkspace(ws.id)} className="focus:bg-white/5 focus:text-white cursor-pointer">
                              <Pencil className="mr-2 h-4 w-4" />
                              Editar
                            </DropdownMenuItem>
                            <DropdownMenuItem onSelect={(e) => { e.preventDefault(); setWorkspaceToDelete(ws); }} className="text-red-400 focus:bg-red-500/10 focus:text-red-300 cursor-pointer">
                              <Trash2 className="mr-2 h-4 w-4" />
                              Excluir
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                      <div className="mb-3 h-10 w-10 rounded-lg bg-gradient-to-br from-violet-500/20 to-fuchsia-500/20 flex items-center justify-center border border-white/5">
                        <BotMessageSquare className="h-5 w-5 text-violet-400" />
                      </div>
                      <CardTitle className="truncate font-bold text-lg text-zinc-100 group-hover:text-violet-300 transition-colors">{ws.name}</CardTitle>
                      <CardDescription className="text-xs text-zinc-500 font-medium">
                        Atualizado em {new Date(ws.updated_at || Date.now()).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })}
                      </CardDescription>
                    </CardHeader>
                    <CardFooter
                      className="p-4 pt-2"
                    >
                      <Button
                        variant="ghost"
                        className="w-full justify-between bg-white/5 hover:bg-violet-500/10 hover:text-violet-300 text-zinc-400 border border-transparent hover:border-violet-500/20 transition-all group/btn"
                        onClick={() => handleOpenWorkspace(ws.id)}
                      >
                        <span className="text-xs font-medium">Abrir Editor</span>
                        <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover/btn:translate-x-1" />
                      </Button>
                    </CardFooter>
                  </Card>
                </motion.div>
              ))}
            </div>
          ) : (
            <div className="col-span-full flex flex-col items-center justify-center rounded-3xl border border-dashed border-white/10 bg-white/5 py-24 text-center">
              <div className="h-20 w-20 rounded-full bg-zinc-900/50 flex items-center justify-center mb-6 shadow-inner border border-white/5">
                <BotMessageSquare className="w-10 h-10 text-zinc-600" />
              </div>
              <h3 className="text-2xl font-bold text-zinc-200">Nenhum fluxo encontrado</h3>
              <p className="text-zinc-500 mt-2 mb-8 max-w-sm text-sm">Parece que você ainda não criou nenhum fluxo. Comece agora mesmo!</p>
            </div>
          )}
        </AnimatePresence>
      </div>

      <AlertDialog open={!!workspaceToDelete} onOpenChange={(open) => !open && setWorkspaceToDelete(null)}>
        <AlertDialogContent className="bg-zinc-950 border-white/10">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-white">Excluir Fluxo?</AlertDialogTitle>
            <AlertDialogDescription className="text-zinc-400">
              Esta ação não pode ser desfeita. Isso excluirá permanentemente o fluxo <strong className="text-white">{workspaceToDelete?.name}</strong> e todos os seus dados.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setWorkspaceToDelete(null)} className="bg-transparent border-white/10 text-zinc-300 hover:bg-white/5 hover:text-white">Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => workspaceToDelete && handleDeleteWorkspace(workspaceToDelete.id)} className="bg-red-600 hover:bg-red-700 text-white border-none">
              Sim, excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
