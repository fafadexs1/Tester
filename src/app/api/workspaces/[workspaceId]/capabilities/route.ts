"use server";

import { NextRequest, NextResponse } from "next/server";
import {
  createCapability,
  getOrganizationsForUser,
  getCapabilitiesForWorkspace,
  loadWorkspaceFromDB,
} from "@/app/actions/databaseActions";
import { getCurrentUser } from "@/lib/auth";
import { NewCapabilitySchema } from "@/lib/mcp/capabilitySchema";

interface RouteParams {
  workspaceId: string;
}

const slugify = (value: string): string =>
  value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");

async function assertWorkspaceAccess(userId: string, workspaceId: string, allowDeveloper: boolean) {
  const workspace = await loadWorkspaceFromDB(workspaceId);
  if (!workspace) {
    return { error: "Workspace not found.", status: 404 } as const;
  }

  if (allowDeveloper) {
    return { workspace } as const;
  }

  const orgs = await getOrganizationsForUser(userId);
  const isMember = orgs.some(org => org.id === workspace.organization_id);
  if (!isMember) {
    return { error: "Access denied to this workspace.", status: 403 } as const;
  }

  return { workspace } as const;
}
export async function GET(_request: NextRequest, context: { params: Promise<RouteParams> }) {
  const params = await context.params;
  const workspaceId = params?.workspaceId;
  if (!workspaceId) {
    return NextResponse.json({ error: "Workspace ID is required." }, { status: 400 });
  }

  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  const access = await assertWorkspaceAccess(user.id, workspaceId, user.role === "desenvolvedor");
  if ("error" in access) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  try {
    const capabilities = await getCapabilitiesForWorkspace(workspaceId);
    return NextResponse.json(capabilities, { status: 200 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Failed to fetch capabilities" }, { status: 500 });
  }
}

export async function POST(request: NextRequest, context: { params: Promise<RouteParams> }) {
  const params = await context.params;
  const workspaceId = params?.workspaceId;
  if (!workspaceId) {
    return NextResponse.json({ error: "Workspace ID is required." }, { status: 400 });
  }

  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  const access = await assertWorkspaceAccess(user.id, workspaceId, user.role === "desenvolvedor");
  if ("error" in access) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  const payload = await request.json();
  const validation = NewCapabilitySchema.safeParse(payload);
  if (!validation.success) {
    return NextResponse.json(
      { error: "Invalid payload.", issues: validation.error.issues },
      { status: 400 }
    );
  }

  const { name, version, status, contract } = validation.data;
  const slug = slugify(name);
  if (!slug) {
    return NextResponse.json({ error: "Capability name is invalid for slug." }, { status: 400 });
  }

  const created = await createCapability({
    workspaceId,
    name,
    slug,
    version: version ?? "v1",
    status: status ?? "draft",
    riskLevel: contract.riskLevel,
    contract,
    createdById: user.id,
  });

  if (created.error) {
    const statusCode = created.error.includes("already exists") ? 409 : 500;
    return NextResponse.json({ error: created.error }, { status: statusCode });
  }

  return NextResponse.json(created.data, { status: 201 });
}
