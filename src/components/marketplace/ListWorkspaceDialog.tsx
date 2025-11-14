
'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogClose,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Store } from 'lucide-react';
import type { WorkspaceData } from '@/lib/types';
const API_ENDPOINT = '/api/marketplace/listings';

interface ListWorkspaceDialogProps {
  userWorkspaces: WorkspaceData[];
  onListingCreated: () => void;
}

export function ListWorkspaceDialog({ userWorkspaces, onListingCreated }: ListWorkspaceDialogProps) {
  const [open, setOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSubmitting(true);

    const formData = new FormData(event.currentTarget);
    const payload = {
      workspaceId: formData.get('workspaceId'),
      description: formData.get('description'),
      tags: formData.get('tags'),
    };

    try {
      const response = await fetch(API_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const result = await response.json();

      if (!response.ok) {
        if (result?.issues) {
          const errorMessages = result.issues
            .map((issue: any) => `${issue.path.join('.')}: ${issue.message}`)
            .join('\n');
          toast({
            title: 'Erro de Validação',
            description: <pre className="whitespace-pre-wrap">{errorMessages}</pre>,
            variant: 'destructive',
          });
        } else {
          toast({
            title: 'Erro ao Listar',
            description: result?.error || 'Não foi possível listar o fluxo agora.',
            variant: 'destructive',
          });
        }
        return;
      }

      toast({ title: 'Sucesso!', description: 'Seu fluxo foi listado no marketplace.' });
      onListingCreated();
      setOpen(false);
    } catch (error: any) {
      console.error('[Marketplace] Falha ao listar fluxo:', error);
      toast({
        title: 'Erro ao Listar',
        description: 'Não foi possível contactar o servidor.',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Store className="mr-2 h-4 w-4" /> Vender meu Fluxo
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Listar um Fluxo no Marketplace</DialogTitle>
            <DialogDescription>
              Compartilhe seu trabalho com a comunidade. A primeira versão do seu fluxo será sempre gratuita.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid w-full items-center gap-1.5">
              <Label htmlFor="workspaceId">Selecione o Fluxo</Label>
              <Select name="workspaceId" required>
                <SelectTrigger>
                  <SelectValue placeholder="Escolha um dos seus fluxos" />
                </SelectTrigger>
                <SelectContent>
                  {userWorkspaces.map((ws) => (
                    <SelectItem key={ws.id} value={ws.id}>
                      {ws.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid w-full items-center gap-1.5">
              <Label htmlFor="description">Descrição</Label>
              <Textarea
                id="description"
                name="description"
                placeholder="Descreva o que seu fluxo faz, seus principais casos de uso e benefícios."
                required
                minLength={10}
              />
            </div>
            <div className="grid w-full items-center gap-1.5">
              <Label htmlFor="tags">Tags (separadas por vírgula)</Label>
              <Input
                id="tags"
                name="tags"
                placeholder="Ex: atendimento, vendas, whatsapp"
              />
            </div>
            <div className="grid w-full items-center gap-1.5">
              <Label htmlFor="price">Preço da Versão Inicial</Label>
              <Input id="price" value="Grátis" disabled />
              <p className="text-xs text-muted-foreground">
                Futuramente, você poderá cobrar por atualizações através de um modelo de assinatura.
              </p>
            </div>
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline" disabled={isSubmitting}>
                Cancelar
              </Button>
            </DialogClose>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Listar Fluxo
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
