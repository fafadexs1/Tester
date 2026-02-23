import { NextResponse } from 'next/server';
import { findUserByEmail } from '@/app/actions/databaseActions';

const simpleHash = (pass: string) => `hashed_${pass}`;
const verifyPassword = (pass: string, hash: string) => hash === simpleHash(pass);

export async function POST(request: Request) {
    const secret = (process.env.DIALOGY_INTERNAL_SECRET || '').trim();
    if (!secret) {
        console.error('[InternalSSOVerify] DIALOGY_INTERNAL_SECRET is not configured.');
        return NextResponse.json({ error: 'Server configuration error.' }, { status: 500 });
    }

    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return NextResponse.json({ error: 'Missing authorization header.' }, { status: 401 });
    }

    const token = authHeader.slice('Bearer '.length).trim();
    if (!token || token !== secret) {
        return NextResponse.json({ error: 'Invalid authorization token.' }, { status: 403 });
    }

    try {
        const body = await request.json();
        const email = String(body?.email || '').trim().toLowerCase();
        const password = String(body?.password || '');

        if (!email || !password) {
            return NextResponse.json({ error: 'Email and password are required.' }, { status: 400 });
        }

        const user = await findUserByEmail(email);
        if (!user) {
            return NextResponse.json({ error: 'User not found for this email.' }, { status: 404 });
        }

        const isValid = verifyPassword(password, user.password_hash || '');
        if (!isValid) {
            return NextResponse.json({ error: 'Invalid credentials.' }, { status: 401 });
        }

        return NextResponse.json({
            valid: true,
            user: {
                id: user.id,
                email: user.email,
                username: user.username,
                full_name: (user as any).full_name || (user as any).fullName || user.username,
            }
        });
    } catch (error) {
        console.error('[InternalSSOVerify] Unexpected error:', error);
        return NextResponse.json({ error: 'Unexpected server error.' }, { status: 500 });
    }
}
