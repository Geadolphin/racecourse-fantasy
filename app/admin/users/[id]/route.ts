import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";

function getServerEnvironment() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseAnonKey || !serviceRoleKey) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, or SUPABASE_SERVICE_ROLE_KEY."
    );
  }

  return {
    supabaseUrl,
    supabaseAnonKey,
    serviceRoleKey,
  };
}

export async function DELETE(
  request: NextRequest,
  context: {
    params: Promise<{
      id: string;
    }>;
  }
) {
  try {
    const { id: targetUserId } = await context.params;

    if (!targetUserId) {
      return NextResponse.json(
        {
          error: "A user ID is required.",
        },
        {
          status: 400,
        }
      );
    }

    const authorizationHeader =
      request.headers.get("authorization");

    const accessToken = authorizationHeader?.startsWith("Bearer ")
      ? authorizationHeader.slice("Bearer ".length)
      : null;

    if (!accessToken) {
      return NextResponse.json(
        {
          error: "You must be signed in.",
        },
        {
          status: 401,
        }
      );
    }

    const {
      supabaseUrl,
      supabaseAnonKey,
      serviceRoleKey,
    } = getServerEnvironment();

    /*
     * Verify the access token directly with Supabase Auth.
     */
    const authClient = createClient(
      supabaseUrl,
      supabaseAnonKey,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    );

    const {
      data: { user: requestingUser },
      error: requestingUserError,
    } = await authClient.auth.getUser(accessToken);

    if (requestingUserError || !requestingUser) {
      return NextResponse.json(
        {
          error: "Your session is invalid or has expired.",
        },
        {
          status: 401,
        }
      );
    }

    if (requestingUser.id === targetUserId) {
      return NextResponse.json(
        {
          error: "You cannot deregister your own account.",
        },
        {
          status: 400,
        }
      );
    }

    /*
     * The service-role client must exist only on the server.
     * It bypasses RLS, so never expose its key to browser code.
     */
    const adminClient = createClient(
      supabaseUrl,
      serviceRoleKey,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    );

    const { data: requestingProfile, error: profileError } =
      await adminClient
        .from("profiles")
        .select("is_admin")
        .eq("id", requestingUser.id)
        .maybeSingle();

    if (
      profileError ||
      !requestingProfile ||
      requestingProfile.is_admin !== true
    ) {
      return NextResponse.json(
        {
          error: "Administrator access is required.",
        },
        {
          status: 403,
        }
      );
    }

    const { data: targetProfile, error: targetProfileError } =
      await adminClient
        .from("profiles")
        .select("id, display_name, is_admin")
        .eq("id", targetUserId)
        .maybeSingle();

    if (targetProfileError) {
      return NextResponse.json(
        {
          error: targetProfileError.message,
        },
        {
          status: 500,
        }
      );
    }

    if (!targetProfile) {
      return NextResponse.json(
        {
          error: "The user profile could not be found.",
        },
        {
          status: 404,
        }
      );
    }

    /*
     * Hard-delete the Auth account.
     *
     * This may fail when database or Storage relationships prevent
     * deletion. The error is returned to the admin instead of hiding it.
     */
    const { error: deleteError } =
      await adminClient.auth.admin.deleteUser(
        targetUserId,
        false
      );

    if (deleteError) {
      return NextResponse.json(
        {
          error: deleteError.message,
        },
        {
          status: 400,
        }
      );
    }

    /*
     * If profiles.id references auth.users with ON DELETE CASCADE,
     * this does nothing. If the profile remains, remove it explicitly.
     *
     * Existing competition tables may still prevent this deletion.
     * In that case the request returns an informative error.
     */
    const { error: profileDeleteError } = await adminClient
      .from("profiles")
      .delete()
      .eq("id", targetUserId);

    if (profileDeleteError) {
      return NextResponse.json(
        {
          error:
            "The Auth account was deleted, but the profile could not be removed: " +
            profileDeleteError.message,
        },
        {
          status: 409,
        }
      );
    }

    return NextResponse.json({
      success: true,
      deleted_user_id: targetUserId,
      display_name:
        targetProfile.display_name || "Unnamed Player",
    });
  } catch (error) {
    console.error("Delete admin user route error:", error);

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "The user could not be deregistered.",
      },
      {
        status: 500,
      }
    );
  }
}