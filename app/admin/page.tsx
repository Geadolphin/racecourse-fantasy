"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";

type DashboardCounts = {
  users: number;
  horses: number;
  races: number;
  rounds: number;
};

const initialCounts: DashboardCounts = {
  users: 0,
  horses: 0,
  races: 0,
  rounds: 0,
};

export default function AdminDashboardPage() {
  const [counts, setCounts] =
    useState<DashboardCounts>(initialCounts);

  const [activeSeason, setActiveSeason] =
    useState<string>("No active season");

  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [automationMessage, setAutomationMessage] = useState("");

  useEffect(() => {
    async function loadDashboard() {
      setLoading(true);
      setMessage("");
      setAutomationMessage("");

      /*
       * Automatically lock any open round whose lockout time
       * has already passed.
       */
      const now = new Date().toISOString();

      const {
        data: lockedRounds,
        error: lockRoundsError,
      } = await supabase
        .from("rounds")
        .update({
          status: "locked",
        })
        .eq("status", "open")
        .lte("lockout_at", now)
        .select("id");

      if (lockRoundsError) {
        console.error(
          "Automatic round lock error:",
          lockRoundsError
        );

        setMessage(
          `Could not automatically lock expired rounds: ${lockRoundsError.message}`
        );
      } else if (lockedRounds && lockedRounds.length > 0) {
        const roundWord =
          lockedRounds.length === 1 ? "round" : "rounds";

        setAutomationMessage(
          `${lockedRounds.length} expired ${roundWord} automatically locked.`
        );
      }

      const [
        usersResponse,
        horsesResponse,
        racesResponse,
        roundsResponse,
        seasonResponse,
      ] = await Promise.all([
        supabase
          .from("profiles")
          .select("id", {
            count: "exact",
            head: true,
          }),

        supabase
          .from("horses")
          .select("id", {
            count: "exact",
            head: true,
          }),

        supabase
          .from("races")
          .select("id", {
            count: "exact",
            head: true,
          }),

        supabase
          .from("rounds")
          .select("id", {
            count: "exact",
            head: true,
          }),

        supabase
          .from("seasons")
          .select("name, year")
          .eq("is_active", true)
          .maybeSingle(),
      ]);

      const responses = [
        usersResponse,
        horsesResponse,
        racesResponse,
        roundsResponse,
        seasonResponse,
      ];

      const firstLoadError = responses.find(
        (response) => response.error
      )?.error;

      if (firstLoadError) {
        console.error(
          "Admin dashboard load error:",
          firstLoadError
        );

        setMessage((currentMessage) => {
          const loadMessage =
            `Could not load some dashboard information: ${firstLoadError.message}`;

          if (currentMessage) {
            return `${currentMessage} ${loadMessage}`;
          }

          return loadMessage;
        });
      }

      setCounts({
        users: usersResponse.count ?? 0,
        horses: horsesResponse.count ?? 0,
        races: racesResponse.count ?? 0,
        rounds: roundsResponse.count ?? 0,
      });

      if (seasonResponse.data) {
        setActiveSeason(
          `${seasonResponse.data.name} ${seasonResponse.data.year}`
        );
      } else {
        setActiveSeason("No active season");
      }

      setLoading(false);
    }

    void loadDashboard();
  }, []);

  const cards = [
    {
      title: "Registered users",
      value: counts.users,
      href: "/admin/users",
    },
    {
      title: "Horses",
      value: counts.horses,
      href: "/admin/horses",
    },
    {
      title: "Races",
      value: counts.races,
      href: "/admin/races",
    },
    {
      title: "Rounds",
      value: counts.rounds,
      href: "/admin/rounds",
    },
  ];

  return (
    <main className="p-6 sm:p-10">
      <div className="mx-auto max-w-7xl">
        <div>
          <p className="font-semibold text-teal-600">
            Administration
          </p>

          <h1 className="mt-1 text-4xl font-bold tracking-tight">
            Dashboard
          </h1>

          <p className="mt-2 text-slate-600">
            Manage the Racecourse Fantasy competition.
          </p>
        </div>

        {automationMessage && (
          <div className="mt-6 rounded-xl border border-teal-200 bg-teal-50 p-4 text-teal-700">
            {automationMessage}
          </div>
        )}

        {message && (
          <div className="mt-6 rounded-xl border border-red-200 bg-red-50 p-4 text-red-700">
            {message}
          </div>
        )}

        <section className="mt-8 rounded-2xl bg-slate-900 p-6 text-white shadow-sm">
          <p className="text-sm font-semibold uppercase tracking-wider text-teal-300">
            Active season
          </p>

          <p className="mt-2 text-2xl font-bold">
            {loading ? "Loading..." : activeSeason}
          </p>

          <Link
            href="/admin/seasons"
            className="mt-5 inline-block rounded-lg bg-amber-400 px-4 py-2 text-sm font-bold text-emerald-950 transition hover:bg-amber-300"
          >
            Manage seasons
          </Link>
        </section>

        <section className="mt-8 grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
          {cards.map((card) => (
            <Link
              key={card.title}
              href={card.href}
              className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition hover:-translate-y-1 hover:shadow-md"
            >
              <p className="text-sm font-medium text-slate-500">
                {card.title}
              </p>

              <p className="mt-3 text-4xl font-bold">
                {loading ? "—" : card.value}
              </p>

              <p className="mt-4 text-sm font-semibold text-teal-600">
                Manage →
              </p>
            </Link>
          ))}
        </section>

        <section className="mt-8">
          <h2 className="text-xl font-bold">
            Quick actions
          </h2>

          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Link
              href="/admin/seasons"
              className="rounded-xl border border-slate-200 bg-white p-5 font-semibold shadow-sm hover:border-teal-500"
            >
              Create a season
            </Link>

            <Link
              href="/admin/rounds"
              className="rounded-xl border border-slate-200 bg-white p-5 font-semibold shadow-sm hover:border-teal-500"
            >
              Create a round
            </Link>

            <Link
              href="/admin/horses"
              className="rounded-xl border border-slate-200 bg-white p-5 font-semibold shadow-sm hover:border-teal-500"
            >
              Add horses
            </Link>
          </div>
        </section>
      </div>
    </main>
  );
}