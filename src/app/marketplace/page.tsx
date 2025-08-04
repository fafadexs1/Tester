
'use client';

import { useState, useEffect, useCallback } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ShoppingCart, Search, Flame, Loader2, ServerCrash, Star } from "lucide-react";
import type { MarketplaceListing, WorkspaceData } from '@/lib/types';
import { getListings } from '@/app/actions/marketplaceActions';
import { useRouter } from 'next/navigation';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { motion } from 'framer-motion';
import { ListWorkspaceDialog } from '@/components/marketplace/ListWorkspaceDialog';
import { loadWorkspacesForOrganizationFromDB } from '@/app/actions/databaseActions';
import { useAuth } from '@/components/auth/AuthProvider';

const ListingCard = ({ listing, index }: { listing: MarketplaceListing, index: number }) => {
    const router = useRouter();

    const cardVariants = {
        hidden: { opacity: 0, y: 20 },
        visible: { 
            opacity: 1, 
            y: 0, 
            transition: { delay: index * 0.05 } 
        },
    };

    return (
        <motion.div variants={cardVariants}>
            <Card 
                className="hover:shadow-lg transition-shadow duration-300 flex flex-col cursor-pointer h-full"
                onClick={() => router.push(`/marketplace/${listing.id}`)}
            >
                <CardHeader>
                    <CardTitle className="truncate">{listing.name}</CardTitle>
                    <CardDescription className="line-clamp-2 h-[40px]">{listing.description}</CardDescription>
                </CardHeader>
                <CardContent className="flex-grow">
                     <div className="flex items-center text-sm text-muted-foreground">
                        <Avatar className="w-6 h-6 mr-2">
                           <AvatarFallback>{listing.creator_username?.slice(0, 2).toUpperCase()}</AvatarFallback>
                        </Avatar>
                        <span>{listing.creator_username}</span>
                    </div>
                </CardContent>
                <CardFooter className="flex justify-between items-center">
                    <div className="flex items-center gap-1">
                        <Star className="w-4 h-4 text-yellow-400" />
                        <span className="text-sm font-medium">{listing.rating?.toFixed(1) || '0.0'}</span>
                        <span className="text-xs text-muted-foreground">({listing.downloads || 0})</span>
                    </div>
                    <Badge variant={listing.price > 0 ? "secondary" : "default"}>
                        {listing.price > 0 ? `R$${listing.price.toFixed(2)}` : 'Grátis'}
                    </Badge>
                </CardFooter>
            </Card>
        </motion.div>
    );
};

export default function MarketplacePage() {
  const [listings, setListings] = useState<MarketplaceListing[]>([]);
  const [userWorkspaces, setUserWorkspaces] = useState<WorkspaceData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { user, currentOrganization } = useAuth();

  const fetchInitialData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
        const listingsResult = await getListings();
        if (listingsResult.success && listingsResult.data) {
            setListings(listingsResult.data);
        } else {
            throw new Error(listingsResult.error || "Não foi possível carregar os fluxos do marketplace.");
        }

        if (user && currentOrganization) {
            const workspacesResult = await loadWorkspacesForOrganizationFromDB(currentOrganization.id);
            setUserWorkspaces(workspacesResult);
        }

    } catch (e: any) {
        setError(e.message || "Ocorreu um erro de conexão.");
    } finally {
        setIsLoading(false);
    }
  }, [user, currentOrganization]);

  useEffect(() => {
    fetchInitialData();
  }, [fetchInitialData]);

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
          <ListWorkspaceDialog userWorkspaces={userWorkspaces} onListingCreated={fetchInitialData} />
        </div>
      </div>
      
      <div className="flex-1 mt-6">
        {isLoading ? (
            <div className="flex justify-center items-center py-20">
                <Loader2 className="w-10 h-10 animate-spin text-primary" />
            </div>
        ) : error ? (
            <div className="col-span-full flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-destructive/50 bg-destructive/10 py-24 text-center">
                <ServerCrash className="w-16 h-16 text-destructive mb-4" />
                <h3 className="text-2xl font-bold">Erro ao Carregar</h3>
                <p className="text-muted-foreground mt-2 mb-6 max-w-md">
                  {error}
                </p>
            </div>
        ) : listings.length === 0 ? (
            <div className="col-span-full flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-muted-foreground/30 py-24 text-center">
                <ShoppingCart className="w-16 h-16 text-primary mb-4" />
                <h3 className="text-2xl font-bold">O Marketplace está Vazio!</h3>
                <p className="text-muted-foreground mt-2 mb-6 max-w-md">
                  Ainda não há fluxos disponíveis. Seja o primeiro a vender um fluxo e inspire a comunidade!
                </p>
                 <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Flame className="w-4 h-4 text-amber-500" />
                    <span>Prepare-se para inovar.</span>
                </div>
            </div>
        ) : (
            <motion.div 
                className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
                initial="hidden"
                animate="visible"
            >
                {listings.map((listing, index) => (
                    <ListingCard key={listing.id} listing={listing} index={index} />
                ))}
            </motion.div>
        )}
      </div>
    </div>
  );
}
