"use server";

import { NextResponse, type NextRequest } from "next/server";
import { getListingDetails as getListingDetailsFromDB } from "@/app/actions/databaseActions";

interface RouteParams {
  listingId: string;
}

export async function GET(_request: NextRequest, context: { params: Promise<RouteParams> }) {
  const params = await context.params;
  const listingId = params?.listingId;

  if (!listingId) {
    return NextResponse.json({ error: "ID da listagem não informado." }, { status: 400 });
  }

  const result = await getListingDetailsFromDB(listingId);
  if (result.error) {
    const status = result.error.includes("não encontrado") ? 404 : 500;
    return NextResponse.json({ error: result.error }, { status });
  }

  if (!result.data) {
    return NextResponse.json({ error: "Fluxo não encontrado." }, { status: 404 });
  }

  return NextResponse.json(result.data, { status: 200 });
}
