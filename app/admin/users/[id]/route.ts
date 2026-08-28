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

async function getAdminRequestContext(
  request: NextRequest
) {
  const authorizationHeader =
    request.headers.get("authorization");

  const accessToken = authorizationHeader?.startsWith("Bearer ")
    ? authorizationHeader.slice("Bearer ".length)
    : null;

  if (!accessToken) {
    return {
      errorResponse: NextResponse.json(
        {
          error: "You must be signed in.",
        },
        {
          status: 401,
        }
      ),
    };
  }

  const {
    supabaseUrl,
    supabaseAnonKey,
    serviceRoleKey,
  } = getServerEnvironment();

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
    return {
      errorResponse: NextResponse.json(
        {
          error: "Your session is invalid or has expired.",
        },
        {
          status: 401,
        }
      ),
    };
  }

  /*
   * Service-role client exists only on the server.
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
    return {
      errorResponse: NextResponse.json(
        {
          error: "Administrator access is required.",
        },
        {
          status: 403,
        }
      ),
    };
  }

  return {
    requestingUser,
    adminClient,
  };
}

export async function PATCH(
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

    const adminContext =
      await getAdminRequestContext(request);

    if ("errorResponse" in adminContext) {
      return adminContext.errorResponse;
    }

    const { adminClient } = adminContext;

    const body = (await request.json()) as {
      email?: unknown;
    };

    const newEmail =
      typeof body.email === "string"
        ? body.email.trim().toLowerCase()
        : "";

    if (
      !newEmail ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newEmail)
    ) {
      return NextResponse.json(
        {
          error: "A valid email address is required.",
        },
        {
          status: 400,
        }
      );
    }

    const { data: targetProfile, error: targetProfileError } =
      await adminClient
        .from("profiles")
        .select("id, display_name")
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
     * Update the existing Supabase Auth user rather than
     * creating a replacement account. This preserves the UUID.
     *
     * email_confirm: true is intentional for an administrator
     * correcting a known mistyped address.
     */
    const { data: updatedUserData, error: updateError } =
      await adminClient.auth.admin.updateUserById(
        targetUserId,
        {
          email: newEmail,
          email_confirm: true,
        }
      );

    if (updateError) {
      return NextResponse.json(
        {
          error: updateError.message,
        },
        {
          status: 400,
        }
      );
    }

    return NextResponse.json({
      success: true,
      user_id: targetUserId,
      email:
        updatedUserData.user?.email ?? newEmail,
      display_name:
        targetProfile.display_name || "Unnamed Player",
    });
  } catch (error) {
    console.error("Update admin user email route error:", error);

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "The user's email could not be updated.",
      },
      {
        status: 500,
      }
    );
  }
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

    const adminContext =
      await getAdminRequestContext(request);

    if ("errorResponse" in adminContext) {
      return adminContext.errorResponse;
    }

    const {
      requestingUser,
      adminClient,
    } = adminContext;

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