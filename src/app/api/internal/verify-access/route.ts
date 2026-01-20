import { NextResponse } from 'next/server';

export async function POST(request: Request) {
    const SECRET = process.env.DIALOGY_INTERNAL_SECRET;

    if (!SECRET) {
        console.error("[VerifyAccess] DIALOGY_INTERNAL_SECRET is not defined in environment variables.");
        return NextResponse.json({ active: false, reason: "Server Configuration Error" }, { status: 500 });
    }

    const authHeader = request.headers.get('authorization');

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return NextResponse.json({ active: false, reason: "Missing Authorization Header" }, { status: 401 });
    }

    const token = authHeader.split(' ')[1];

    if (token !== SECRET) {
        return NextResponse.json({ active: false, reason: "Invalid Token" }, { status: 403 });
    }

    // verification successful
    return NextResponse.json({ active: true });
}
