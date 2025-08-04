

'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ShoppingCart, Search, Flame, Loader2, ServerCrash, Star, User, GitBranch, Share2, Download, BotMessageSquare } from "lucide-react";
import type { MarketplaceListing, WorkspaceData, NodeData, Connection } from '@/lib/types';
import { getListings, getListingDetails } from '@/app/actions/marketplaceActions';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { motion } from 'framer-motion';
import { ListWorkspaceDialog } from '@/components/marketplace/ListWorkspaceDialog';
import { loadWorkspacesForOrganizationFromDB } from '@/app/actions/databaseActions';
import { useAuth } from '@/components/auth/AuthProvider';
import Image from 'next/image';
import { useToast } from '@/hooks/use-toast';
import { DndProvider } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import Canvas from '@/components/flow-builder/Canvas';
import { GRID_SIZE } from '@/lib/constants';

// Componente para a pré-visualização em Modal
const ListingPreviewDialog = ({ listingId, children }: { listingId: string, children: React.ReactNode }) => {
    const [open, setOpen] = useState(false);
    const [listing, setListing] = useState<MarketplaceListing | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const { toast } = useToast();

    // Estado para o canvas de preview
    const [canvasOffset, setCanvasOffset] = useState({ x: 0, y: 0 });
    const [zoomLevel, setZoomLevel] = useState(1);
    const previewCanvasRef = useRef<HTMLDivElement>(null);

    const calculateInitialView = useCallback((nodes: NodeData[], containerWidth: number, containerHeight: number) => {
        if (!nodes || nodes.length === 0) {
            return { zoom: 1, offset: { x: containerWidth / 2, y: containerHeight / 3 } };
        }

        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        nodes.forEach(node => {
            minX = Math.min(minX, node.x);
            minY = Math.min(minY, node.y);
            maxX = Math.max(maxX, node.x + 320); // NODE_WIDTH
            maxY = Math.max(maxY, node.y + 150); // Approximate node height
        });

        const contentWidth = maxX - minX;
        const contentHeight = maxY - minY;

        if (contentWidth <= 0 || contentHeight <= 0) {
             return { zoom: 1, offset: { x: containerWidth / 2, y: containerHeight / 3 } };
        }

        const padding = 80;
        const zoomX = (containerWidth - padding) / contentWidth;
        const zoomY = (containerHeight - padding) / contentHeight;
        const newZoom = Math.min(zoomX, zoomY, 1); // Cap zoom at 1x for initial view

        const contentCenterX = minX + contentWidth / 2;
        const contentCenterY = minY + contentHeight / 2;

        const newOffsetX = (containerWidth / 2) - (contentCenterX * newZoom);
        const newOffsetY = (containerHeight / 2) - (contentCenterY * newZoom);
        
        return { zoom: newZoom, offset: { x: newOffsetX, y: newOffsetY } };
    }, []);

    const fetchDetails = useCallback(async () => {
        if (!open || listing) return;
        setIsLoading(true);
        try {
            const result = await getListingDetails(listingId);
            if (result.success && result.data) {
                setListing(result.data);
                setTimeout(() => {
                    if (previewCanvasRef.current) {
                        const { width, height } = previewCanvasRef.current.getBoundingClientRect();
                        const { zoom, offset } = calculateInitialView(result.data!.preview_data.nodes, width, height);
                        setZoomLevel(zoom);
                        setCanvasOffset(offset);
                    }
                }, 100);
            } else {
                toast({ title: "Erro ao carregar detalhes", description: result.error, variant: "destructive" });
                setOpen(false);
            }
        } finally {
            setIsLoading(false);
        }
    }, [listingId, open, listing, toast, calculateInitialView]);
    
    useEffect(() => {
        if (open) {
            fetchDetails();
        }
    }, [open, fetchDetails]);

    const handlePan = (e: React.MouseEvent<HTMLDivElement>) => {
        if (e.buttons !== 1) return;
        setCanvasOffset(prev => ({ x: prev.x + e.movementX, y: prev.y + e.movementY }));
    };

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>{children}</DialogTrigger>
            <DialogContent className="max-w-5xl h-[90vh] flex flex-col p-0">
                {isLoading ? (
                    <div className="flex-1 flex items-center justify-center">
                        <Loader2 className="w-8 h-8 animate-spin text-primary" />
                    </div>
                ) : listing ? (
                    <>
                    <div className="grid grid-cols-1 md:grid-cols-[1fr_320px] h-full overflow-hidden">
                        <div className="relative h-full bg-muted/30 overflow-hidden" ref={previewCanvasRef}>
                             <Canvas
                                nodes={listing.preview_data.nodes}
                                connections={listing.preview_data.connections}
                                drawingLine={null}
                                canvasOffset={canvasOffset}
                                zoomLevel={zoomLevel}
                                onDropNode={() => {}}
                                onUpdateNode={() => {}}
                                onStartConnection={() => {}}
                                onDeleteNode={() => {}}
                                onDeleteConnection={() => {}}
                                onCanvasMouseDown={handlePan}
                                highlightedConnectionId={null}
                                setHighlightedConnectionId={() => {}}
                                availableVariablesByNode={{}}
                                highlightedNodeIdBySession={null}
                                activeWorkspace={listing.preview_data as WorkspaceData}
                            />
                        </div>

                        <div className="flex flex-col border-l">
                            <DialogHeader className="p-4 border-b">
                                <DialogTitle className="text-2xl">{listing?.name}</DialogTitle>
                                {listing && (
                                    <DialogDescription asChild>
                                        <div className="flex items-center gap-4 pt-1">
                                            <div className="flex items-center text-sm text-muted-foreground">
                                                <User className="w-4 h-4 mr-1.5" />
                                                Criado por {listing.creator_username}
                                            </div>
                                            <div className="flex items-center text-sm text-muted-foreground">
                                                <Download className="w-4 h-4 mr-1.5" />
                                                {listing.downloads || 0} downloads
                                            </div>
                                        </div>
                                    </DialogDescription>
                                )}
                            </DialogHeader>
                            <ScrollArea className="flex-1">
                                <div className="p-4 space-y-4">
                                    <div>
                                        <h3 className="font-semibold text-sm">Descrição</h3>
                                        <p className="text-sm text-muted-foreground">{listing.description}</p>
                                    </div>
                                    <div>
                                        <h3 className="font-semibold text-sm mb-2">Estrutura do Fluxo ({listing.preview_data.nodes.length} nós)</h3>
                                        <ul className="space-y-1.5">
                                            {listing.preview_data.nodes.map((node: NodeData) => (
                                                <li key={node.id} className="text-xs flex items-center gap-2 text-muted-foreground">
                                                    <BotMessageSquare className="w-3.5 h-3.5 text-primary/70" />
                                                    <span className="font-medium text-foreground/80">{node.title}</span>
                                                    <Badge variant="outline" className="text-xs">{node.type}</Badge>
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                </div>
                            </ScrollArea>
                            <DialogFooter className="p-4 border-t bg-background">
                                <Button type="button" variant="secondary" onClick={() => setOpen(false)}>Fechar</Button>
                                <Button type="button" className="flex-1">
                                    <Download className="mr-2 h-4 w-4" />
                                    {parseFloat(String(listing.price)) > 0 ? `Comprar por R$${parseFloat(String(listing.price)).toFixed(2)}` : 'Obter Gratuitamente'}
                                </Button>
                            </DialogFooter>
                        </div>
                    </div>
                    </>
                ) : (
                    <div className="flex-1 flex items-center justify-center text-destructive">
                        Não foi possível carregar os detalhes do fluxo.
                    </div>
                )}
            </DialogContent>
        </Dialog>
    );
};


const ListingCard = ({ listing, index }: { listing: MarketplaceListing, index: number }) => {
    const cardVariants = {
        hidden: { opacity: 0, y: 20 },
        visible: { 
            opacity: 1, 
            y: 0, 
            transition: { delay: index * 0.05, duration: 0.3, ease: "easeOut" } 
        },
    };

    const priceValue = parseFloat(String(listing.price));
    const nodeCount = listing.preview_data?.nodes?.length || 0;
    const connectionCount = listing.preview_data?.connections?.length || 0;

    return (
        <motion.div variants={cardVariants} className="w-full">
            <ListingPreviewDialog listingId={listing.id}>
                <Card className="group hover:shadow-2xl hover:-translate-y-1 transition-all duration-300 flex flex-col cursor-pointer h-full bg-card/80 backdrop-blur-sm border-border/60">
                    <CardHeader className="p-0">
                        <div className="aspect-video w-full overflow-hidden bg-muted">
                            <Image src={`https://placehold.co/400x225.png`} alt={`Preview for ${listing.name}`} width={400} height={225} className="w-full h-full object-cover transition-transform group-hover:scale-105" data-ai-hint="flow preview" />
                        </div>
                        <div className="p-4">
                            <CardTitle className="truncate text-lg">{listing.name}</CardTitle>
                            <CardDescription className="line-clamp-2 h-[40px] mt-1">{listing.description}</CardDescription>
                        </div>
                    </CardHeader>
                    <CardContent className="flex-grow p-4 pt-0">
                         <div className="flex items-center text-xs text-muted-foreground gap-4">
                           <div className="flex items-center" title={`${nodeCount} nós`}>
                                <BotMessageSquare className="w-3.5 h-3.5 mr-1" />
                                {nodeCount}
                            </div>
                            <div className="flex items-center" title={`${connectionCount} conexões`}>
                                <GitBranch className="w-3.5 h-3.5 mr-1" />
                                {connectionCount}
                            </div>
                            <div className="flex items-center" title={`${listing.downloads || 0} downloads`}>
                                <Download className="w-3.5 h-3.5 mr-1" />
                                {listing.downloads || 0}
                            </div>
                        </div>
                    </CardContent>
                    <CardFooter className="flex justify-between items-center p-4 border-t">
                         <div className="flex items-center text-sm text-muted-foreground gap-2">
                            <Avatar className="w-7 h-7">
                               <AvatarFallback>{listing.creator_username?.slice(0, 2).toUpperCase()}</AvatarFallback>
                            </Avatar>
                            <span className="font-medium text-foreground/80">{listing.creator_username}</span>
                        </div>
                         <Badge variant={priceValue > 0 ? "secondary" : "default"} className="text-sm">
                            {priceValue > 0 ? `R$${parseFloat(String(listing.price)).toFixed(2)}` : 'Grátis'}
                        </Badge>
                    </CardFooter>
                </Card>
            </ListingPreviewDialog>
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
            // Convert numeric fields from string to number after fetching
            const parsedListings = listingsResult.data.map(listing => ({
                ...listing,
                price: parseFloat(String(listing.price)),
                rating: parseFloat(String(listing.rating)),
            }));
            setListings(parsedListings);
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
    <DndProvider backend={HTML5Backend}>
        <div className="flex-1 space-y-4 p-4 md:p-8 pt-6">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between space-y-2 md:space-y-0">
            <div>
            <h2 className="text-3xl font-bold tracking-tight">Marketplace de Fluxos</h2>
            <p className="text-muted-foreground mt-1">
                Descubra, compartilhe e implante automações poderosas criadas pela comunidade.
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
                    <ListWorkspaceDialog userWorkspaces={userWorkspaces} onListingCreated={fetchInitialData} />
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
    </DndProvider>
  );
}
