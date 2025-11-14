"use server";

import { NextResponse, type NextRequest } from "next/server";
import { loadWorkspacesForOrganizationFromDB } from "@/app/actions/databaseActions";
import { getCurrentUser } from "@/lib/auth";

interface RouteParams {
  organizationId: string;
}

export async function GET(_request: NextRequest, context: { params: RouteParams }) {
  const organizationId = context.params?.organizationId;
  if (!organizationId) {
    return NextResponse.json({ error: "ID da organização é obrigatório." }, { status: 400 });
  }

  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }

  if (user.current_organization_id !== organizationId) {
    return NextResponse.json({ error: "Acesso negado a esta organização." }, { status: 403 });
  }

  try {
    const workspaces = await loadWorkspacesForOrganizationFromDB(organizationId);
    return NextResponse.json(workspaces, { status: 200 });
  } catch (error: any) {
    console.error(
      `[API Organizations] Falha ao carregar workspaces para org ${organizationId}:`,
      error
    );
    return NextResponse.json(
      { error: "Erro ao carregar os workspaces.", details: error.message },
      { status: 500 }
    );
  }
}
