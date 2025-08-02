
import { NextResponse } from 'next/server';
import { getChatwootInstancesForUserAction } from '@/app/actions/instanceActions';
import { getCurrentUser } from '@/lib/auth';

export async function GET() {
    const user = await getCurrentUser();
    if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const result = await getChatwootInstancesForUserAction();

    if (result.error) {
        return NextResponse.json({ error: result.error }, { status: 500 });
    }

    return NextResponse.json(result.data, { status: 200 });
}

    