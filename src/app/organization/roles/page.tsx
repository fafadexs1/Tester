
'use client';
import { Button } from "@/components/ui/button";
import { PlusCircle } from "lucide-react";

export default function RolesPage() {
    return (
        <div className="flex-1 space-y-4 p-4 md:p-8 pt-6">
            <div className="flex items-center justify-between space-y-2">
                <h2 className="text-3xl font-bold tracking-tight">Cargos e Permissões</h2>
                <Button>
                    <PlusCircle className="mr-2 h-4 w-4" /> Novo Cargo
                </Button>
            </div>
            <p className="text-muted-foreground">
                Crie e gerencie cargos para controlar o que os membros da sua organização podem ver e fazer.
            </p>
            {/* O conteúdo da página com a lista de cargos e o formulário de criação virá aqui. */}
        </div>
    );
}
