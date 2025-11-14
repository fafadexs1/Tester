"use server";

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  getListings as fetchListingsFromDB,
  loadWorkspaceFromDB,
  runQuery,
} from "@/app/actions/databaseActions";
import { getCurrentUser } from "@/lib/auth";
import { revalidatePath } from "next/cache";

const ListWorkspaceSchema = z.object({
  workspaceId: z.string().uuid("ID do fluxo inválido."),
  description: z
    .string()
    .min(10, "A descrição deve ter pelo menos 10 caracteres.")
    .max(500, "A descrição não pode exceder 500 caracteres."),
  tags: z.string().optional(),
});

export async function GET() {
  const result = await fetchListingsFromDB();
  if (result.error) {
    return NextResponse.json(
      { error: result.error },
      {
        status: 500,
      }
    );
  }

  return NextResponse.json(result.data ?? [], { status: 200 });
}

export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Usuário não autenticado." }, { status: 401 });
  }

  const payload = await request.json();
  const validation = ListWorkspaceSchema.safeParse(payload);

  if (!validation.success) {
    return NextResponse.json(
      {
        error: "Dados inválidos.",
        issues: validation.error.issues,
      },
      { status: 400 }
    );
  }

  const { workspaceId, description, tags } = validation.data;

  try {
    const workspace = await loadWorkspaceFromDB(workspaceId);
    if (!workspace) {
      return NextResponse.json({ error: "Fluxo não encontrado." }, { status: 404 });
    }

    if (workspace.owner_id !== user.id) {
      return NextResponse.json(
        { error: "Você não tem permissão para vender este fluxo." },
        { status: 403 }
      );
    }

    const tagsArray = tags
      ? tags
          .split(",")
          .map((tag) => tag.trim())
          .filter(Boolean)
      : [];

    const query = `
      INSERT INTO marketplace_listings (name, description, price, creator_id, workspace_id, preview_data, tags)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      ON CONFLICT (workspace_id) DO UPDATE SET
        name = EXCLUDED.name,
        description = EXCLUDED.description,
        tags = EXCLUDED.tags,
        updated_at = NOW();
    `;

    await runQuery(query, [
      workspace.name,
      description,
      0.0,
      user.id,
      workspaceId,
      JSON.stringify({
        nodes: workspace.nodes,
        connections: workspace.connections,
      }),
      tagsArray,
    ]);

    revalidatePath("/marketplace");
    return NextResponse.json({ success: true }, { status: 201 });
  } catch (error: any) {
    if (error.code === "23505" && error.constraint === "marketplace_listings_workspace_id_key") {
      return NextResponse.json(
        { error: "Este fluxo já está listado no marketplace." },
        { status: 409 }
      );
    }
    console.error("[API Marketplace] Erro ao listar fluxo:", error);
    return NextResponse.json(
      { error: "Erro de servidor ao listar fluxo.", details: error.message },
      { status: 500 }
    );
  }
}
