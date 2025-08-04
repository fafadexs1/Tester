
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ShoppingCart, Search, Flame } from "lucide-react";

export default function MarketplacePage() {
  return (
    <div className="flex-1 space-y-4 p-4 md:p-8 pt-6">
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between space-y-2 md:space-y-0">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Marketplace de Fluxos</h2>
          <p className="text-muted-foreground mt-1">
            Descubra, compartilhe e venda automações poderosas.
          </p>
        </div>
        <div className="flex w-full md:w-auto space-x-2">
          <Button variant="outline">
            <Search className="mr-2 h-4 w-4" />
            Buscar Fluxos
          </Button>
          <Button>
             Vender meu Fluxo
          </Button>
        </div>
      </div>
      
      <div className="flex-1 mt-6">
        <Card className="col-span-full flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-muted-foreground/30 py-24 text-center">
            <ShoppingCart className="w-16 h-16 text-primary mb-4" />
            <h3 className="text-2xl font-bold">O Marketplace está Chegando!</h3>
            <p className="text-muted-foreground mt-2 mb-6 max-w-md">
              Em breve, este será o seu espaço para encontrar os melhores fluxos de automação criados pela comunidade e também para monetizar suas próprias criações.
            </p>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Flame className="w-4 h-4 text-amber-500" />
                <span>Prepare-se para inovar.</span>
            </div>
        </Card>
      </div>
    </div>
  );
}
