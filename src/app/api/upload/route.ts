import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/db";
import { memberships } from "@/db/schema";

/**
 * Token endpoint for direct browser → Vercel Blob uploads.
 * The browser calls `upload()` from @vercel/blob/client with handleUploadUrl pointing here.
 */
export async function POST(request: Request) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return NextResponse.json({ error: "Sign in first" }, { status: 401 });

  const body = (await request.json()) as HandleUploadBody;
  try {
    const json = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async (_pathname, clientPayload) => {
        const payload = clientPayload ? (JSON.parse(clientPayload) as { leagueId?: string }) : {};
        const leagueId = payload.leagueId;
        if (!leagueId) throw new Error("Missing league");
        const member = await db.query.memberships.findFirst({
          where: and(eq(memberships.leagueId, leagueId), eq(memberships.userId, userId)),
        });
        if (!member) throw new Error("Not a member of this league");
        return {
          allowedContentTypes: ["image/jpeg", "image/png", "image/webp", "image/gif"],
          maximumSizeInBytes: 8 * 1024 * 1024,
          addRandomSuffix: true,
          tokenPayload: JSON.stringify({ userId, leagueId }),
        };
      },
      onUploadCompleted: async () => {
        // Registration happens from the client after upload so it also works on localhost.
      },
    });
    return NextResponse.json(json);
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 400 });
  }
}
