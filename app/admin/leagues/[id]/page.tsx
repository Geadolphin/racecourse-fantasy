"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  useParams,
  useRouter,
} from "next/navigation";

import { supabase } from "@/lib/supabase";

type LeagueRecord = {
  id: string;
  name: string;
  join_code: string;
  created_at: string;
  owner_user_id: string;
  season_id: string;
};

type SeasonRecord = {
  id: string;
  name: string;
  year: number;
};

type ProfileRecord = {
  id: string;
  display_name: string | null;
};

type MemberRecord = {
  league_id: string;
  user_id: string;
  joined_at: string;
};

type MemberRow = {
  user_id: string;
  display_name: string;
  joined_at: string;
  is_owner: boolean;
};

type AvailableUser = {
  id: string;
  display_name: string | null;
};

export default function AdminLeagueDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();

  const leagueId = params.id;

  const [loading, setLoading] = useState(true);

  const [league, setLeague] =
    useState<LeagueRecord | null>(null);

  const [season, setSeason] =
    useState<SeasonRecord | null>(null);

  const [ownerName, setOwnerName] =
    useState("Unknown owner");

  const [members, setMembers] =
    useState<MemberRow[]>([]);

  const [error, setError] = useState("");

  const [removingUserId, setRemovingUserId] =
    useState<string | null>(null);

  const [deletingLeague, setDeletingLeague] =
    useState(false);

  const [availableUsers, setAvailableUsers] =
    useState<AvailableUser[]>([]);

  const [addMemberOpen, setAddMemberOpen] =
    useState(false);

  const [memberSearch, setMemberSearch] =
    useState("");

  const [addingUserId, setAddingUserId] =
    useState<string | null>(null);

  async function loadLeague() {
    setLoading(true);
    setError("");

    const {
      data: leagueData,
      error: leagueError,
    } = await supabase
      .from("leagues")
      .select(`
        id,
        name,
        join_code,
        created_at,
        owner_user_id,
        season_id
      `)
      .eq("id", leagueId)
      .single();

    if (leagueError || !leagueData) {
      setError(
        leagueError?.message ||
          "League not found."
      );

      setLoading(false);
      return;
    }

    const loadedLeague =
      leagueData as LeagueRecord;

    const [
      {
        data: seasonData,
        error: seasonError,
      },
      {
        data: membersData,
        error: membersError,
      },
    ] = await Promise.all([
      supabase
        .from("seasons")
        .select("id, name, year")
        .eq(
          "id",
          loadedLeague.season_id
        )
        .single(),

      supabase
        .from("league_members")
        .select(
          "league_id, user_id, joined_at"
        )
        .eq(
          "league_id",
          loadedLeague.id
        )
        .order(
          "joined_at",
          { ascending: true }
        ),
    ]);

    if (seasonError || membersError) {
      console.error({
        seasonError,
        membersError,
      });

      setError(
        seasonError?.message ||
          membersError?.message ||
          "Unable to load league details."
      );

      setLoading(false);
      return;
    }

    const loadedMembers =
      (membersData ?? []) as MemberRecord[];

    const memberUserIds =
      loadedMembers.map(
        (member) => member.user_id
      );

    const {
      data: profilesData,
      error: profilesError,
    } =
      memberUserIds.length > 0
        ? await supabase
            .from("profiles")
            .select("id, display_name")
            .in("id", memberUserIds)
        : {
            data: [],
            error: null,
          };

    if (profilesError) {
      setError(
        profilesError.message ||
          "Unable to load member profiles."
      );

      setLoading(false);
      return;
    }

    const profileRecords =
      (profilesData ??
        []) as ProfileRecord[];

    const profilesById =
      new Map(
        profileRecords.map(
          (profile) => [
            profile.id,
            profile,
          ]
        )
      );

    const memberRows: MemberRow[] =
      loadedMembers.map(
        (member) => ({
          user_id: member.user_id,

          display_name:
            profilesById
              .get(member.user_id)
              ?.display_name
              ?.trim() ||
            "Unknown user",

          joined_at:
            member.joined_at,

          is_owner:
            member.user_id ===
            loadedLeague.owner_user_id,
        })
      );

    const owner =
      profilesById.get(
        loadedLeague.owner_user_id
      );

    setLeague(loadedLeague);

    setSeason(
      seasonData as SeasonRecord
    );

    setOwnerName(
      owner?.display_name?.trim() ||
        "Unknown owner"
    );

    setMembers(memberRows);

    const {
      data: allProfilesData,
      error: allProfilesError,
    } = await supabase
      .from("profiles")
      .select("id, display_name")
      .order("display_name", { ascending: true });

    if (allProfilesError) {
      console.error(
        "Admin available users load error:",
        allProfilesError
      );

      setAvailableUsers([]);
    } else {
      setAvailableUsers(
        (allProfilesData ?? []) as AvailableUser[]
      );
    }

    setLoading(false);
  }

  useEffect(() => {
    if (leagueId) {
      void loadLeague();
    }

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [leagueId]);

  const memberUserIds = useMemo(
    () => new Set(members.map((member) => member.user_id)),
    [members]
  );

  const filteredAvailableUsers = useMemo(() => {
    const term = memberSearch.trim().toLowerCase();

    return availableUsers
      .filter((user) => !memberUserIds.has(user.id))
      .filter((user) => {
        if (!term) {
          return true;
        }

        return (
          user.display_name
            ?.toLowerCase()
            .includes(term) ?? false
        );
      })
      .slice(0, 50);
  }, [
    availableUsers,
    memberSearch,
    memberUserIds,
  ]);

  async function handleAddMember(user: AvailableUser) {
    if (!league) {
      return;
    }

    setAddingUserId(user.id);
    setError("");

    const { error: addError } =
      await supabase.rpc(
        "admin_add_private_league_member",
        {
          p_league_id: league.id,
          p_user_id: user.id,
        }
      );

    if (addError) {
      console.error(
        "Admin add league member error:",
        addError
      );

      setError(
        addError.message ||
          "Unable to add member."
      );

      setAddingUserId(null);
      return;
    }

    setMemberSearch("");
    setAddMemberOpen(false);
    setAddingUserId(null);

    await loadLeague();
  }

  async function handleRemoveMember(
    member: MemberRow
  ) {
    if (!league) {
      return;
    }

    if (member.is_owner) {
      return;
    }

    const confirmed = window.confirm(
      `Remove ${member.display_name} from "${league.name}"?`
    );

    if (!confirmed) {
      return;
    }

    setRemovingUserId(member.user_id);
    setError("");

    const { error: removeError } =
      await supabase.rpc(
        "admin_remove_private_league_member",
        {
          p_league_id: league.id,
          p_user_id: member.user_id,
        }
      );

    if (removeError) {
      console.error(
        "Admin remove league member error:",
        removeError
      );

      setError(
        removeError.message ||
          "Unable to remove member."
      );

      setRemovingUserId(null);
      return;
    }

    setMembers((currentMembers) =>
      currentMembers.filter(
        (currentMember) =>
          currentMember.user_id !==
          member.user_id
      )
    );

    setRemovingUserId(null);
  }

  async function handleDeleteLeague() {
    if (!league) {
      return;
    }

    const confirmed = window.confirm(
      `Delete "${league.name}" permanently?\n\nThis will remove the league for all members. This action cannot be undone.`
    );

    if (!confirmed) {
      return;
    }

    setDeletingLeague(true);
    setError("");

    const { error: deleteError } =
      await supabase.rpc(
        "admin_delete_private_league",
        {
          p_league_id: league.id,
        }
      );

    if (deleteError) {
      console.error(
        "Admin delete league error:",
        deleteError
      );

      setError(
        deleteError.message ||
          "Unable to delete league."
      );

      setDeletingLeague(false);
      return;
    }

    router.replace("/admin/leagues");
    router.refresh();
  }

  if (loading) {
    return (
      <main className="p-6 md:p-8">
        <div className="rounded-xl border bg-white p-10 text-center shadow-sm">
          Loading league...
        </div>
      </main>
    );
  }

  if (error && !league) {
    return (
      <main className="p-6 md:p-8">
        <div className="mx-auto max-w-5xl">
          <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-red-700">
            {error}
          </div>

          <Link
            href="/admin/leagues"
            className="mt-6 inline-block font-semibold text-teal-700 hover:underline"
          >
            ← Back to leagues
          </Link>
        </div>
      </main>
    );
  }

  if (!league) {
    return null;
  }

  return (
    <main className="p-6 md:p-8">
      <div className="mx-auto max-w-6xl">
        <Link
          href="/admin/leagues"
          className="text-sm font-semibold text-teal-700 hover:underline"
        >
          ← Back to leagues
        </Link>

        <div className="mb-6 mt-4 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.16em] text-teal-700">
              Administration
            </p>

            <h1 className="mt-1 text-3xl font-bold text-slate-950">
              {league.name}
            </h1>

            <p className="mt-2 text-slate-600">
              Private league details and
              membership.
            </p>
          </div>

          <button
            type="button"
            onClick={handleDeleteLeague}
            disabled={deletingLeague}
            className="rounded-lg border border-red-300 bg-white px-4 py-2.5 text-sm font-bold text-red-700 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {deletingLeague
              ? "Deleting..."
              : "Delete League"}
          </button>
        </div>

        {error && (
          <div className="mb-6 rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-700">
            {error}
          </div>
        )}

        <section className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-xl border bg-white p-5 shadow-sm">
            <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
              Season
            </p>

            <p className="mt-2 font-bold text-slate-950">
              {season
                ? `${season.name} ${season.year}`
                : "Unknown"}
            </p>
          </div>

          <div className="rounded-xl border bg-white p-5 shadow-sm">
            <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
              Owner
            </p>

            <p className="mt-2 font-bold text-slate-950">
              {ownerName}
            </p>
          </div>

          <div className="rounded-xl border bg-white p-5 shadow-sm">
            <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
              Members
            </p>

            <p className="mt-2 font-bold text-slate-950">
              {members.length} / 24
            </p>
          </div>

          <div className="rounded-xl border bg-white p-5 shadow-sm">
            <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
              Join Code
            </p>

            <p className="mt-2 font-mono font-bold tracking-wider text-slate-950">
              {league.join_code}
            </p>
          </div>
        </section>

        <section className="mb-6 rounded-xl border bg-white p-5 shadow-sm">
          <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
            Created
          </p>

          <p className="mt-2 font-semibold text-slate-900">
            {new Date(
              league.created_at
            ).toLocaleString("en-AU")}
          </p>
        </section>

        <section className="rounded-xl border bg-white shadow-sm">
          <div className="flex flex-col gap-3 border-b px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-lg font-bold text-slate-950">
                League Members
              </h2>

              <p className="mt-1 text-sm text-slate-500">
                {members.length} members
              </p>
            </div>

            <button
              type="button"
              onClick={() => {
                setMemberSearch("");
                setAddMemberOpen(true);
              }}
              disabled={members.length >= 24}
              className="rounded-lg bg-teal-700 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-teal-800 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Add Member
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px]">
              <thead className="bg-slate-50">
                <tr className="text-left text-xs font-bold uppercase tracking-wide text-slate-600">
                  <th className="px-4 py-3">
                    Member
                  </th>

                  <th className="px-4 py-3">
                    Role
                  </th>

                  <th className="px-4 py-3">
                    Joined
                  </th>

                  <th className="px-4 py-3 text-right">
                    User
                  </th>

                  <th className="px-4 py-3 text-right">
                    Action
                  </th>
                </tr>
              </thead>

              <tbody>
                {members.map(
                  (member) => (
                    <tr
                      key={member.user_id}
                      className="border-t hover:bg-slate-50"
                    >
                      <td className="px-4 py-4 font-semibold text-slate-950">
                        {member.display_name}
                      </td>

                      <td className="px-4 py-4">
                        {member.is_owner ? (
                          <span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-bold text-amber-800">
                            Owner
                          </span>
                        ) : (
                          <span className="text-slate-600">
                            Member
                          </span>
                        )}
                      </td>

                      <td className="px-4 py-4 text-slate-600">
                        {new Date(
                          member.joined_at
                        ).toLocaleDateString(
                          "en-AU"
                        )}
                      </td>

                      <td className="px-4 py-4 text-right">
                        <Link
                          href={`/admin/users/${member.user_id}`}
                          className="font-semibold text-teal-700 hover:underline"
                        >
                          View user
                        </Link>
                      </td>

                      <td className="px-4 py-4 text-right">
                        {member.is_owner ? (
                          <span className="text-sm text-slate-400">
                            —
                          </span>
                        ) : (
                          <button
                            type="button"
                            onClick={() =>
                              handleRemoveMember(
                                member
                              )
                            }
                            disabled={
                              removingUserId ===
                              member.user_id
                            }
                            className="rounded-lg border border-red-200 px-3 py-2 text-sm font-semibold text-red-700 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            {removingUserId ===
                            member.user_id
                              ? "Removing..."
                              : "Remove"}
                          </button>
                        )}
                      </td>
                    </tr>
                  )
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      {addMemberOpen && league && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4"
          onMouseDown={(event) => {
            if (
              event.target === event.currentTarget &&
              addingUserId === null
            ) {
              setAddMemberOpen(false);
            }
          }}
        >
          <section className="w-full max-w-lg overflow-hidden rounded-2xl border border-slate-300 bg-white shadow-2xl">
            <div className="border-b border-slate-800 bg-slate-950 px-6 py-4 text-white">
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-teal-300">
                Administration
              </p>

              <h2 className="mt-1 text-2xl font-bold">
                Add League Member
              </h2>

              <p className="mt-1 text-sm text-slate-400">
                Add an existing Racecourse Fantasy user to {league.name}.
              </p>
            </div>

            <div className="p-6">
              <label
                htmlFor="member-search"
                className="block text-sm font-bold text-slate-800"
              >
                Search users
              </label>

              <input
                id="member-search"
                type="search"
                value={memberSearch}
                onChange={(event) =>
                  setMemberSearch(event.target.value)
                }
                placeholder="Search by display name..."
                autoFocus
                className="mt-2 w-full rounded-lg border border-slate-300 px-4 py-3 text-slate-900 outline-none focus:border-teal-700 focus:ring-2 focus:ring-teal-100"
              />

              <div className="mt-4 max-h-80 overflow-y-auto rounded-xl border border-slate-200">
                {filteredAvailableUsers.length === 0 ? (
                  <div className="p-6 text-center text-sm text-slate-500">
                    No available users found.
                  </div>
                ) : (
                  <div className="divide-y divide-slate-100">
                    {filteredAvailableUsers.map((user) => (
                      <div
                        key={user.id}
                        className="flex items-center justify-between gap-4 px-4 py-3"
                      >
                        <div className="min-w-0">
                          <p className="truncate font-semibold text-slate-950">
                            {user.display_name?.trim() || "Unnamed user"}
                          </p>
                        </div>

                        <button
                          type="button"
                          onClick={() => void handleAddMember(user)}
                          disabled={addingUserId !== null}
                          className="shrink-0 rounded-lg bg-teal-700 px-3 py-2 text-sm font-bold text-white transition hover:bg-teal-800 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          {addingUserId === user.id
                            ? "Adding..."
                            : "Add"}
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="mt-5 flex justify-end">
                <button
                  type="button"
                  onClick={() => setAddMemberOpen(false)}
                  disabled={addingUserId !== null}
                  className="rounded-lg border bg-white px-4 py-2.5 font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                >
                  Close
                </button>
              </div>
            </div>
          </section>
        </div>
      )}
    </main>
  );
}