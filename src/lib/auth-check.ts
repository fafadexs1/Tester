export async function checkDialogyAccess(email: string) {
    const DIALOGY_URL = process.env.NEXT_PUBLIC_DIALOGY_URL || "http://localhost:3000";
    const SECRET = process.env.DIALOGY_INTERNAL_SECRET;

    if (!SECRET) {
        console.error("[AuthCheck] DIALOGY_INTERNAL_SECRET is missing.");
        // Fail closed for security
        return { allowed: false, reason: "Configuration Error: Missing Secret" };
    }

    const targetUrl = `${DIALOGY_URL}/api/internal/verify-access`;
    console.log(`[AuthCheck] Attempting to verify access at: ${targetUrl}`);

    try {
        const response = await fetch(targetUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${SECRET}`
            },
            body: JSON.stringify({ email }),
            cache: 'no-store' // Ensure we always get fresh status
        });

        if (!response.ok) {
            console.error(`[AuthCheck] Verification failed with status: ${response.status}`);
            return { allowed: false, reason: `Verification failed: ${response.statusText}` };
        }

        const data = await response.json();

        if (data.active) {
            return { allowed: true };
        }

        return { allowed: false, reason: data.reason || "Access denied by Dialogy" };

    } catch (error) {
        console.error("[AuthCheck] Connection error:", error);

        // Development Bypass: Allow login if verification server is unreachable
        if (process.env.NODE_ENV === 'development') {
            console.warn("[AuthCheck] Development mode detected: Bypassing auth check verification failure.");
            return { allowed: true, reason: "Dev Bypass: Auth Server Unreachable" };
        }

        return { allowed: false, reason: "Could not connect to authentication server" };
    }
}
