"use server";

import { NextRequest, NextResponse } from "next/server";
import {
  deleteCapability,
  getCapabilityById,
  getOrganizationsForUser,
  loadWorkspaceFromDB,
  updateCapability,
} from "@/app/actions/databaseActions";
import { getCurrentUser } from "@/lib/auth";
import { UpdateCapabilitySchema } from "@/lib/mcp/capabilitySchema";
import type { CapabilityContract } from "@/lib/types";

interface RouteParams {
  capabilityId: string;
}

const slugify = (value: string): string =>
  value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");

async function assertCapabilityAccess(userId: string, capabilityId: string, allowDeveloper: boolean) {
  const capabilityResult = await getCapabilityById(capabilityId);
  if (capabilityResult.error || !capabilityResult.data) {
    return { error: "Capability not found.", status: 404 } as const;
  }

  const workspace = await loadWorkspaceFromDB(capabilityResult.data.workspace_id);
  if (!workspace) {
    return { error: "Workspace not found.", status: 404 } as const;
  }

  if (allowDeveloper) {
    return { capability: capabilityResult.data } as const;
  }

  const orgs = await getOrganizationsForUser(userId);
  const isMember = orgs.some(org => org.id === workspace.organization_id);
  if (!isMember) {
    return { error: "Access denied to this capability.", status: 403 } as const;
  }

  return { capability: capabilityResult.data } as const;
}

export async function GET(_request: NextRequest, context: { params: Promise<RouteParams> }) {
  const params = await context.params;
  const capabilityId = params?.capabilityId;
  if (!capabilityId) {
    return NextResponse.json({ error: "Capability ID is required." }, { status: 400 });
  }

  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  const access = await assertCapabilityAccess(user.id, capabilityId, user.role === "desenvolvedor");
  if ("error" in access) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  return NextResponse.json(access.capability, { status: 200 });
}

export async function PATCH(request: NextRequest, context: { params: Promise<RouteParams> }) {
  const params = await context.params;
  const capabilityId = params?.capabilityId;
  if (!capabilityId) {
    return NextResponse.json({ error: "Capability ID is required." }, { status: 400 });
  }

  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  const access = await assertCapabilityAccess(user.id, capabilityId, user.role === "desenvolvedor");
  if ("error" in access) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  const payload = await request.json();
  const validation = UpdateCapabilitySchema.safeParse(payload);
  if (!validation.success) {
    return NextResponse.json(
      { error: "Invalid payload.", issues: validation.error.issues },
      { status: 400 }
    );
  }

  const updates: {
    name?: string;
    slug?: string;
    version?: string;
    status?: "draft" | "active" | "deprecated";
    riskLevel?: "low" | "medium" | "high";
    contract?: CapabilityContract;
  } = {};

  if (validation.data.name) {
    updates.name = validation.data.name;
    updates.slug = slugify(validation.data.name);
  }
  if (validation.data.version) {
    updates.version = validation.data.version;
  }
  if (validation.data.status) {
    updates.status = validation.data.status;
  }
  if (validation.data.contract) {
    updates.contract = validation.data.contract;
    updates.riskLevel = validation.data.contract.riskLevel;
  }

  if (updates.slug !== undefined && !updates.slug) {
    return NextResponse.json({ error: "Capability name is invalid for slug." }, { status: 400 });
  }

  const result = await updateCapability(capabilityId, updates);
  if (result.error) {
    const statusCode = result.error.includes("not found") ? 404 : 500;
    return NextResponse.json({ error: result.error }, { status: statusCode });
  }

  return NextResponse.json(result.data, { status: 200 });
}

export async function DELETE(_request: NextRequest, context: { params: Promise<RouteParams> }) {
  const params = await context.params;
  const capabilityId = params?.capabilityId;
  if (!capabilityId) {
    return NextResponse.json({ error: "Capability ID is required." }, { status: 400 });
  }

  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  const access = await assertCapabilityAccess(user.id, capabilityId, user.role === "desenvolvedor");
  if ("error" in access) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  const result = await deleteCapability(capabilityId);
  if (!result.success) {
    const statusCode = result.error?.includes("not found") ? 404 : 500;
    return NextResponse.json({ error: result.error ?? "Delete failed." }, { status: statusCode });
  }

  return NextResponse.json({ success: true }, { status: 200 });
}
