import { createClerkClient } from "@clerk/backend";

const clerkClient = createClerkClient({
  secretKey: process.env.CLERK_SECRET_KEY,
  publishableKey: process.env.VITE_CLERK_PUBLISHABLE_KEY,
});

// Returns the Clerk user ID if the request has a valid session, or null.
// Every Function calls this first — nothing touches the database
// without a verified, real user attached to it.
export async function requireUserId(request) {
  const requestState = await clerkClient.authenticateRequest(request, {
    authorizedParties: [
      process.env.URL,
      process.env.DEPLOY_PRIME_URL,
      "http://localhost:5173",
      "http://localhost:8888",
    ].filter(Boolean),
  });

  if (!requestState.isAuthenticated) return null;

  const auth = requestState.toAuth();
  return auth?.userId ?? null;
}

export function unauthorized() {
  return new Response(JSON.stringify({ error: "Unauthorized" }), {
    status: 401,
    headers: { "Content-Type": "application/json" },
  });
}
