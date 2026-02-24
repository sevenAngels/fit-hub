import { createClient } from "@supabase/supabase-js";
import { NextRequest } from "next/server";

import type { Database } from "@/src/lib/database.types";
import { getEnv } from "@/src/lib/env";
import { ApiRouteError } from "@/src/lib/http";

type AuthUser = {
  id: string;
  email: string | null;
  token: string;
};

let adminClient: ReturnType<typeof createClient<Database>> | null = null;
let anonClient: ReturnType<typeof createClient<Database>> | null = null;

function getClients() {
  if (adminClient && anonClient) {
    return { adminClient, anonClient };
  }

  const env = getEnv();

  adminClient = createClient<Database>(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });

  anonClient = createClient<Database>(env.SUPABASE_URL, env.SUPABASE_ANON_KEY, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });

  return { adminClient, anonClient };
}

function readBearerToken(request: NextRequest) {
  const header = request.headers.get("authorization") ?? request.headers.get("Authorization");
  if (!header) {
    throw new ApiRouteError(401, "UNAUTHORIZED", "Authorization header is required.");
  }

  const [scheme, token] = header.split(" ");
  if (scheme?.toLowerCase() !== "bearer" || !token) {
    throw new ApiRouteError(401, "UNAUTHORIZED", "Bearer token is required.");
  }

  return token;
}

export async function requireUser(request: NextRequest): Promise<AuthUser> {
  const { anonClient } = getClients();
  const token = readBearerToken(request);
  const { data, error } = await anonClient.auth.getUser(token);

  if (error || !data.user) {
    throw new ApiRouteError(401, "UNAUTHORIZED", "Authentication required.");
  }

  return {
    id: data.user.id,
    email: data.user.email ?? null,
    token
  };
}

export function getAdminClient() {
  const { adminClient } = getClients();
  return adminClient;
}
