"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  Search,
  Mail,
  Shield,
  ShieldOff,
  Trash2,
  UserRound,
} from "lucide-react";

import { supabase } from "@/lib/supabase";

type AdminUser = {
  id: string;
  display_name: string | null;
  is_admin: boolean;
  created_at: string;
  updated_at: string;
};

type AdminUsersData = {
  success: boolean;
  current_user_id: string;
  users: AdminUser[];
};

type SortKey = "display_name" | "is_admin" | "created_at";
type SortDirection = "asc" | "desc";

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-AU", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Australia/Melbourne",
  }).format(new Date(value));
}

export default function AdminUsersPage() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [currentUserId, setCurrentUserId] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [roleFilter, setRoleFilter] =
    useState<"all" | "admin" | "player">("all");

  const [sortKey, setSortKey] =
    useState<SortKey>("created_at");
  const [sortDirection, setSortDirection] =
    useState<SortDirection>("desc");

  const [loading, setLoading] = useState(true);
  const [updatingUserId, setUpdatingUserId] =
    useState<string | null>(null);
  const [deletingUserId, setDeletingUserId] =
    useState<string | null>(null);
  const [editingEmailUserId, setEditingEmailUserId] =
    useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  useEffect(() => {
    void loadUsers();
  }, []);

  async function loadUsers() {
    setLoading(true);
    setErrorMessage("");

    const { data, error } = await supabase.rpc(
      "get_admin_users"
    );

    if (error) {
      console.error("Admin users RPC error:", error);
      setErrorMessage(
        error.message || "The users page could not be loaded."
      );
      setUsers([]);
      setLoading(false);
      return;
    }

    const loadedData = data as unknown as AdminUsersData;

    setUsers(loadedData.users ?? []);
    setCurrentUserId(loadedData.current_user_id ?? "");
    setLoading(false);
  }

  const filteredUsers = useMemo(() => {
    const normalisedSearch = searchTerm.trim().toLowerCase();

    const filtered = users.filter((user) => {
      const displayName =
        user.display_name?.trim() || "Unnamed Player";

      const matchesSearch =
        normalisedSearch.length === 0 ||
        displayName.toLowerCase().includes(normalisedSearch);

      const matchesRole =
        roleFilter === "all" ||
        (roleFilter === "admin"
          ? user.is_admin
          : !user.is_admin);

      return matchesSearch && matchesRole;
    });

    return [...filtered].sort((a, b) => {
      let comparison = 0;

      if (sortKey === "display_name") {
        comparison = (
          a.display_name?.trim() || "Unnamed Player"
        ).localeCompare(
          b.display_name?.trim() || "Unnamed Player"
        );
      }

      if (sortKey === "is_admin") {
        comparison = Number(a.is_admin) - Number(b.is_admin);
      }

      if (sortKey === "created_at") {
        comparison =
          new Date(a.created_at).getTime() -
          new Date(b.created_at).getTime();
      }

      if (comparison === 0) {
        comparison = (
          a.display_name?.trim() || "Unnamed Player"
        ).localeCompare(
          b.display_name?.trim() || "Unnamed Player"
        );
      }

      return sortDirection === "asc"
        ? comparison
        : -comparison;
    });
  }, [
    roleFilter,
    searchTerm,
    sortDirection,
    sortKey,
    users,
  ]);

  const adminCount = useMemo(
    () => users.filter((user) => user.is_admin).length,
    [users]
  );

  function changeSort(nextKey: SortKey) {
    if (sortKey === nextKey) {
      setSortDirection((current) =>
        current === "asc" ? "desc" : "asc"
      );
      return;
    }

    setSortKey(nextKey);
    setSortDirection(
      nextKey === "display_name" ? "asc" : "desc"
    );
  }

  function sortIcon(column: SortKey) {
    if (sortKey !== column) {
      return <ArrowUpDown className="h-4 w-4 text-slate-400" />;
    }

    return sortDirection === "asc" ? (
      <ArrowUp className="h-4 w-4 text-teal-700" />
    ) : (
      <ArrowDown className="h-4 w-4 text-teal-700" />
    );
  }

  async function toggleAdmin(user: AdminUser) {
    const nextIsAdmin = !user.is_admin;

    const confirmed = window.confirm(
      nextIsAdmin
        ? `Make ${
            user.display_name || "this player"
          } an administrator?`
        : `Remove administrator access from ${
            user.display_name || "this player"
          }?`
    );

    if (!confirmed) {
      return;
    }

    setUpdatingUserId(user.id);
    setErrorMessage("");
    setSuccessMessage("");

    const { error } = await supabase.rpc(
      "set_user_admin",
      {
        p_user_id: user.id,
        p_is_admin: nextIsAdmin,
      }
    );

    if (error) {
      console.error("Admin status update error:", error);
      setErrorMessage(
        error.message || "The user role could not be updated."
      );
      setUpdatingUserId(null);
      return;
    }

    setUsers((current) =>
      current.map((item) =>
        item.id === user.id
          ? {
              ...item,
              is_admin: nextIsAdmin,
              updated_at: new Date().toISOString(),
            }
          : item
      )
    );

    setSuccessMessage(
      nextIsAdmin
        ? `${
            user.display_name || "The player"
          } is now an administrator.`
        : `Administrator access was removed from ${
            user.display_name || "the player"
          }.`
    );

    setUpdatingUserId(null);
  }

  async function editUserEmail(user: AdminUser) {
    const displayName =
      user.display_name?.trim() || "this player";

    const newEmail = window.prompt(
      `Enter the corrected email address for ${displayName}.`
    );

    if (newEmail === null) {
      return;
    }

    const cleanedEmail = newEmail.trim().toLowerCase();

    if (
      !cleanedEmail ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanedEmail)
    ) {
      setErrorMessage("Enter a valid email address.");
      return;
    }

    const confirmed = window.confirm(
      `Change ${displayName}'s login email to:\n\n${cleanedEmail}\n\nTheir existing user ID and Racecourse Fantasy data will be preserved.`
    );

    if (!confirmed) {
      return;
    }

    setEditingEmailUserId(user.id);
    setErrorMessage("");
    setSuccessMessage("");

    const {
      data: { session },
      error: sessionError,
    } = await supabase.auth.getSession();

    if (sessionError || !session?.access_token) {
      setErrorMessage(
        sessionError?.message ||
          "Your session could not be verified. Please sign in again."
      );
      setEditingEmailUserId(null);
      return;
    }

    try {
      const response = await fetch(
        `/api/admin/users/${user.id}`,
        {
          method: "PATCH",
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            email: cleanedEmail,
          }),
        }
      );

      const responseData = (await response.json()) as {
        success?: boolean;
        error?: string;
        email?: string;
        display_name?: string;
      };

      if (!response.ok || !responseData.success) {
        throw new Error(
          responseData.error ||
            "The user's email could not be updated."
        );
      }

      setSuccessMessage(
        `${responseData.display_name || displayName}'s email was updated to ${responseData.email || cleanedEmail}.`
      );
    } catch (error) {
      console.error("Edit user email error:", error);

      setErrorMessage(
        error instanceof Error
          ? error.message
          : "The user's email could not be updated."
      );
    } finally {
      setEditingEmailUserId(null);
    }
  }

  async function deregisterUser(user: AdminUser) {
    if (user.id === currentUserId) {
      setErrorMessage("You cannot deregister your own account.");
      return;
    }

    const displayName =
      user.display_name?.trim() || "this player";

    const confirmed = window.confirm(
      `Permanently deregister ${displayName}?\n\n` +
        "This deletes their Supabase Authentication account. " +
        "It may also delete their profile and related data, depending " +
        "on your database foreign-key rules. This cannot be undone."
    );

    if (!confirmed) {
      return;
    }

    const typedConfirmation = window.prompt(
      `Type DELETE to permanently deregister ${displayName}.`
    );

    if (typedConfirmation !== "DELETE") {
      return;
    }

    setDeletingUserId(user.id);
    setErrorMessage("");
    setSuccessMessage("");

    const {
      data: { session },
      error: sessionError,
    } = await supabase.auth.getSession();

    if (sessionError || !session?.access_token) {
      setErrorMessage(
        sessionError?.message ||
          "Your session could not be verified. Please sign in again."
      );
      setDeletingUserId(null);
      return;
    }

    try {
      const response = await fetch(
        `/api/admin/users/${user.id}`,
        {
          method: "DELETE",
          headers: {
            Authorization: `Bearer ${session.access_token}`,
          },
        }
      );

      const responseData = (await response.json()) as {
        success?: boolean;
        error?: string;
        display_name?: string;
      };

      if (!response.ok || !responseData.success) {
        throw new Error(
          responseData.error ||
            "The user could not be deregistered."
        );
      }

      setUsers((current) =>
        current.filter((item) => item.id !== user.id)
      );

      setSuccessMessage(
        `${
          responseData.display_name || displayName
        } was permanently deregistered.`
      );
    } catch (error) {
      console.error("Deregister user error:", error);

      setErrorMessage(
        error instanceof Error
          ? error.message
          : "The user could not be deregistered."
      );
    } finally {
      setDeletingUserId(null);
    }
  }

  if (loading) {
    return (
      <main className="min-h-screen p-6 md:p-10">
        <div className="mx-auto max-w-7xl rounded-xl border bg-white p-10 text-center text-slate-500">
          Loading users...
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen p-6 md:p-10">
      <div className="mx-auto max-w-7xl">
        <header className="mb-8">
          <p className="text-sm font-semibold uppercase tracking-wider text-amber-600">
            Account management
          </p>

          <h1 className="mt-1 text-3xl font-bold text-slate-900">
            Users
          </h1>

          <p className="mt-2 text-slate-600">
            View registered players and manage administrator access.
          </p>
        </header>

        {errorMessage && (
          <div className="mb-6 rounded-lg border border-red-300 bg-red-50 p-4 text-red-800">
            {errorMessage}
          </div>
        )}

        {successMessage && (
          <div className="mb-6 rounded-lg border border-green-300 bg-green-50 p-4 text-green-800">
            {successMessage}
          </div>
        )}

        <section className="grid gap-4 sm:grid-cols-2">
          <div className="rounded-xl border bg-white p-5 shadow-sm">
            <p className="text-sm font-semibold text-slate-500">
              Registered Players
            </p>

            <p className="mt-2 text-3xl font-bold text-slate-950">
              {users.length}
            </p>
          </div>

          <div className="rounded-xl border bg-white p-5 shadow-sm">
            <p className="text-sm font-semibold text-slate-500">
              Administrators
            </p>

            <p className="mt-2 text-3xl font-bold text-slate-950">
              {adminCount}
            </p>
          </div>
        </section>

        <section className="mt-6 rounded-xl border bg-white p-5 shadow-sm">
          <div className="grid gap-3 md:grid-cols-[1fr_240px]">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />

              <input
                type="search"
                value={searchTerm}
                onChange={(event) =>
                  setSearchTerm(event.target.value)
                }
                placeholder="Search by display name"
                className="w-full rounded-lg border border-slate-300 py-3 pl-10 pr-4 outline-none focus:border-teal-700 focus:ring-2 focus:ring-teal-100"
              />
            </div>

            <select
              value={roleFilter}
              onChange={(event) =>
                setRoleFilter(
                  event.target.value as
                    | "all"
                    | "admin"
                    | "player"
                )
              }
              className="rounded-lg border border-slate-300 bg-white px-4 py-3 outline-none focus:border-teal-700 focus:ring-2 focus:ring-teal-100"
            >
              <option value="all">All roles</option>
              <option value="player">Players</option>
              <option value="admin">Administrators</option>
            </select>
          </div>

          <p className="mt-4 text-sm text-slate-500">
            Showing {filteredUsers.length} of {users.length} users
          </p>
        </section>

        <section className="mt-6 overflow-hidden rounded-xl border bg-white shadow-sm">
          {filteredUsers.length === 0 ? (
            <div className="p-10 text-center text-slate-500">
              No users match your search and filters.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[850px]">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="px-5 py-4 text-left">
                      <button
                        type="button"
                        onClick={() =>
                          changeSort("display_name")
                        }
                        className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-600 hover:text-teal-700"
                      >
                        Player
                        {sortIcon("display_name")}
                      </button>
                    </th>

                    <th className="px-5 py-4 text-left">
                      <button
                        type="button"
                        onClick={() => changeSort("is_admin")}
                        className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-600 hover:text-teal-700"
                      >
                        Role
                        {sortIcon("is_admin")}
                      </button>
                    </th>

                    <th className="px-5 py-4 text-left">
                      <button
                        type="button"
                        onClick={() =>
                          changeSort("created_at")
                        }
                        className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-600 hover:text-teal-700"
                      >
                        Joined
                        {sortIcon("created_at")}
                      </button>
                    </th>

                    <th className="px-5 py-4 text-left text-xs font-semibold uppercase tracking-wider text-slate-600">
                      Updated
                    </th>

                    <th className="px-5 py-4 text-right text-xs font-semibold uppercase tracking-wider text-slate-600">
                      Actions
                    </th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-100">
                  {filteredUsers.map((user) => {
                    const isCurrentUser =
                      user.id === currentUserId;

                    return (
                      <tr
                        key={user.id}
                        className="hover:bg-slate-50"
                      >
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-3">
                            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-600">
                              <UserRound className="h-5 w-5" />
                            </div>

                            <div>
                              <Link
                                href={`/players/${user.id}`}
                                className="font-semibold text-slate-950 hover:text-teal-700 hover:underline"
                              >
                                {user.display_name?.trim() ||
                                  "Unnamed Player"}
                              </Link>

                              {isCurrentUser && (
                                <p className="mt-1 text-xs font-semibold text-teal-700">
                                  Your account
                                </p>
                              )}
                            </div>
                          </div>
                        </td>

                        <td className="px-5 py-4">
                          <span
                            className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold ${
                              user.is_admin
                                ? "bg-amber-100 text-amber-900"
                                : "bg-slate-100 text-slate-700"
                            }`}
                          >
                            {user.is_admin ? (
                              <Shield className="h-4 w-4" />
                            ) : (
                              <UserRound className="h-4 w-4" />
                            )}

                            {user.is_admin
                              ? "Administrator"
                              : "Player"}
                          </span>
                        </td>

                        <td className="whitespace-nowrap px-5 py-4 text-sm text-slate-700">
                          {formatDate(user.created_at)}
                        </td>

                        <td className="whitespace-nowrap px-5 py-4 text-sm text-slate-700">
                          {formatDate(user.updated_at)}
                        </td>

                        <td className="whitespace-nowrap px-5 py-4 text-right">
                          <div className="flex justify-end gap-3">
                            <Link
                              href={`/players/${user.id}`}
                              className="rounded-lg border px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                            >
                              View Profile
                            </Link>

                            <button
                              type="button"
                              onClick={() => editUserEmail(user)}
                              disabled={
                                editingEmailUserId === user.id ||
                                deletingUserId === user.id
                              }
                              className="inline-flex items-center gap-2 rounded-lg border border-teal-300 px-3 py-2 text-sm font-semibold text-teal-800 hover:bg-teal-50 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              <Mail className="h-4 w-4" />

                              {editingEmailUserId === user.id
                                ? "Updating Email..."
                                : "Edit Email"}
                            </button>

                            <button
                              type="button"
                              onClick={() => toggleAdmin(user)}
                              disabled={
                                updatingUserId === user.id ||
                                editingEmailUserId === user.id ||
                                (isCurrentUser && user.is_admin)
                              }
                              className={`inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-50 ${
                                user.is_admin
                                  ? "border-red-300 text-red-700 hover:bg-red-50"
                                  : "border-amber-300 text-amber-800 hover:bg-amber-50"
                              }`}
                            >
                              {user.is_admin ? (
                                <ShieldOff className="h-4 w-4" />
                              ) : (
                                <Shield className="h-4 w-4" />
                              )}

                              {updatingUserId === user.id
                                ? "Updating..."
                                : user.is_admin
                                  ? "Remove Admin"
                                  : "Make Admin"}
                            </button>

                            <button
                              type="button"
                              onClick={() => deregisterUser(user)}
                              disabled={
                                deletingUserId === user.id ||
                                updatingUserId === user.id ||
                                editingEmailUserId === user.id ||
                                isCurrentUser
                              }
                              className="inline-flex items-center gap-2 rounded-lg border border-red-400 px-3 py-2 text-sm font-semibold text-red-700 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              <Trash2 className="h-4 w-4" />

                              {deletingUserId === user.id
                                ? "Deregistering..."
                                : "Deregister"}
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}