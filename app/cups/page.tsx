"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  CheckCircle2,
  ChevronRight,
  Clock3,
  Network,
  ShieldCheck,
  Trophy,
  Users,
} from "lucide-react";

import { supabase } from "@/lib/supabase";

type CupSummary = {
  id: string;
  name: string;
  status:
    | "draft"
    | "ready"
    | "group_stage"
    | "knockout"
    | "completed"
    | "cancelled";
  season_id: string;
  season_name: string;
  season_year: number;
  competing_teams: number;
  group_count: number;
  teams_per_group: number;
  automatic_qualifiers_per_group: number;
  additional_qualifier_position: number | null;
  additional_qualifier_count: number;
  knockout_team_count: number;
  participant_count: number;
  is_participant: boolean;
};

type CupsPageData = {
  success: boolean;
  cups: CupSummary[];
};

function statusLabel(status: CupSummary["status"]) {
  switch (status) {
    case "draft":
      return "Entries";
    case "ready":
      return "Ready";
    case "group_stage":
      return "Group Stage";
    case "knockout":
      return "Knockout";
    case "completed":
      return "Completed";
    case "cancelled":
      return "Cancelled";
    default:
      return status;
  }
}

function statusClasses(status: CupSummary["status"]) {
  switch (status) {
    case "draft":
      return "border-amber-300 bg-amber-50 text-amber-800";
    case "ready":
      return "border-teal-300 bg-teal-50 text-teal-800";
    case "group_stage":
      return "border-blue-300 bg-blue-50 text-blue-800";
    case "knockout":
      return "border-purple-300 bg-purple-50 text-purple-800";
    case "completed":
      return "border-slate-700 bg-slate-900 text-white";
    case "cancelled":
      return "border-red-300 bg-red-50 text-red-800";
    default:
      return "border-slate-300 bg-slate-50 text-slate-700";
  }
}

function statusIcon(status: CupSummary["status"]) {
  switch (status) {
    case "completed":
      return <CheckCircle2 className="h-4 w-4" />;
    case "group_stage":
    case "knockout":
      return <ShieldCheck className="h-4 w-4" />;
    default:
      return <Clock3 className="h-4 w-4" />;
  }
}

function statusPriority(status: CupSummary["status"]) {
  switch (status) {
    case "knockout":
      return 1;
    case "group_stage":
      return 2;
    case "ready":
      return 3;
    case "draft":
      return 4;
    case "completed":
      return 5;
    case "cancelled":
      return 6;
    default:
      return 99;
  }
}

export default function CupsPage() {
  const [loading, setLoading] = useState(true);
  const [cups, setCups] = useState<CupSummary[]>([]);
  const [selectedSeasonId, setSelectedSeasonId] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    void loadCups();
  }, []);

  async function loadCups() {
    setLoading(true);
    setErrorMessage("");

    try {
      const [
        { data, error },
        { data: leagueCupRows, error: leagueCupError },
      ] = await Promise.all([
        supabase.rpc("get_player_cups_page_data"),
        supabase
          .from("cup_competitions")
          .select("id")
          .not("league_id", "is", null),
      ]);

      if (error) {
        throw error;
      }

      if (leagueCupError) {
        throw leagueCupError;
      }

      const loadedData = data as unknown as CupsPageData;

      const leagueCupIds = new Set(
        (leagueCupRows ?? []).map((cup) => cup.id)
      );

      const loadedCups = (loadedData?.cups ?? []).filter(
        (cup) => !leagueCupIds.has(cup.id)
      );

      setCups(loadedCups);

      setSelectedSeasonId((current) => {
        if (current || loadedCups.length === 0) {
          return current;
        }

        const newestCup = [...loadedCups].sort(
          (a, b) => b.season_year - a.season_year
        )[0];

        return newestCup?.season_id ?? "";
      });
    } catch (error) {
      console.error("Player Cups load error:", error);

      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Unable to load Cups."
      );

      setCups([]);
    } finally {
      setLoading(false);
    }
  }

  const seasons = useMemo(() => {
    const byId = new Map<
      string,
      {
        id: string;
        name: string;
        year: number;
      }
    >();

    for (const cup of cups) {
      if (!byId.has(cup.season_id)) {
        byId.set(cup.season_id, {
          id: cup.season_id,
          name: cup.season_name,
          year: cup.season_year,
        });
      }
    }

    return [...byId.values()].sort(
      (a, b) => b.year - a.year
    );
  }, [cups]);

  const filteredCups = useMemo(() => {
    if (!selectedSeasonId) {
      return cups;
    }

    return cups.filter(
      (cup) => cup.season_id === selectedSeasonId
    );
  }, [cups, selectedSeasonId]);

  const selectedSeason =
    seasons.find(
      (season) => season.id === selectedSeasonId
    ) ?? null;

  const orderedCups = useMemo(() => {
    return [...filteredCups].sort((a, b) => {
      const statusDifference =
        statusPriority(a.status) - statusPriority(b.status);

      if (statusDifference !== 0) {
        return statusDifference;
      }

      return a.name.localeCompare(b.name);
    });
  }, [filteredCups]);

  const featuredCup =
    orderedCups.find(
      (cup) =>
        cup.status === "knockout" ||
        cup.status === "group_stage" ||
        cup.status === "ready"
    ) ??
    orderedCups.find((cup) => cup.status === "draft") ??
    orderedCups[0] ??
    null;

  const remainingCups = featuredCup
    ? orderedCups.filter((cup) => cup.id !== featuredCup.id)
    : [];

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-100">
        <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
          <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center text-slate-500 shadow-sm">
            Loading Cup competitions...
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-100">
      <section className="border-b border-slate-800 bg-slate-950 text-white">
        <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 md:py-14">
          <div className="flex flex-col gap-7 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <div className="flex items-center gap-2 text-teal-300">
                <Trophy className="h-5 w-5" />
                <p className="text-xs font-bold uppercase tracking-[0.22em]">
                  Racecourse Fantasy
                </p>
              </div>

              <h1 className="mt-3 text-4xl font-black tracking-tight md:text-5xl">
                Cup Competitions
              </h1>

              <p className="mt-3 max-w-2xl text-base leading-7 text-slate-300">
                Official tournament competitions featuring group-stage qualification
                and knockout racing through to the Final.
              </p>
            </div>

            <div className="flex w-full flex-col gap-3 lg:w-auto">
              {seasons.length > 0 && (
                <div>
                  <label
                    htmlFor="cups-season-filter"
                    className="mb-1.5 block text-[10px] font-black uppercase tracking-[0.18em] text-slate-400"
                  >
                    Season
                  </label>

                  <select
                    id="cups-season-filter"
                    value={selectedSeasonId}
                    onChange={(event) =>
                      setSelectedSeasonId(event.target.value)
                    }
                    className="w-full min-w-0 rounded-xl border border-slate-700 bg-slate-900 px-4 py-3 text-sm font-black text-white outline-none transition focus:border-teal-400 focus:ring-2 focus:ring-teal-400/20 sm:min-w-[260px]"
                  >
                    {seasons.map((season) => (
                      <option
                        key={season.id}
                        value={season.id}
                      >
                        {season.name} {season.year}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="grid grid-cols-3 gap-2 sm:gap-3">
                <HeaderStat label="Cups" value={filteredCups.length} />
              <HeaderStat
                label="Active"
                value={
                  filteredCups.filter(
                    (cup) =>
                      cup.status === "group_stage" ||
                      cup.status === "knockout" ||
                      cup.status === "ready"
                  ).length
                }
              />
                <HeaderStat
                  label="Competing"
                  value={filteredCups.filter((cup) => cup.is_participant).length}
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 md:py-10">
        {errorMessage && (
          <div className="mb-6 rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-700">
            {errorMessage}
          </div>
        )}

        {filteredCups.length === 0 ? (
          <section className="rounded-2xl border border-slate-200 bg-white p-12 text-center shadow-sm">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-slate-100">
              <Trophy className="h-7 w-7 text-slate-400" />
            </div>

            <h2 className="mt-5 text-2xl font-black text-slate-950">
              No Cup competitions for this season
            </h2>

            <p className="mx-auto mt-2 max-w-lg text-slate-500">
              {selectedSeason
                ? `No Cup competitions are available for ${selectedSeason.name} ${selectedSeason.year}.`
                : "Official Cup competitions will appear here once they are created."}
            </p>
          </section>
        ) : (
          <>
            {featuredCup && (
              <section>
                <div className="mb-3 flex items-center justify-between">
                  <div>
                    <p className="text-xs font-black uppercase tracking-[0.18em] text-teal-700">
                      Featured Competition
                    </p>
                    <h2 className="mt-1 text-xl font-black text-slate-950">
                      Current Cup
                    </h2>
                  </div>
                </div>

                <article className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900 shadow-lg">
                  <div className="grid lg:grid-cols-[1fr_320px]">
                    <div className="p-6 text-white md:p-8">
                      <div className="flex flex-wrap items-center gap-3">
                        <span
                          className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-black ${statusClasses(
                            featuredCup.status
                          )}`}
                        >
                          {statusIcon(featuredCup.status)}
                          {statusLabel(featuredCup.status)}
                        </span>

                        {featuredCup.is_participant && (
                          <span className="rounded-full border border-teal-400/40 bg-teal-400/10 px-3 py-1 text-xs font-black text-teal-200">
                            Your Cup
                          </span>
                        )}
                      </div>

                      <p className="mt-5 text-xs font-black uppercase tracking-[0.18em] text-teal-300">
                        {featuredCup.season_name} {featuredCup.season_year}
                      </p>

                      <h3 className="mt-2 text-3xl font-black tracking-tight md:text-4xl">
                        {featuredCup.name}
                      </h3>

                      <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-300">
                        {featuredCup.group_count} groups of{" "}
                        {featuredCup.teams_per_group}, with{" "}
                        {featuredCup.knockout_team_count} teams advancing to the
                        knockout phase.
                      </p>

                      <div className="mt-7 grid grid-cols-3 gap-3">
                        <FeaturedStat
                          icon={<Users className="h-4 w-4" />}
                          label="Teams"
                          value={featuredCup.competing_teams}
                        />
                        <FeaturedStat
                          icon={<Network className="h-4 w-4" />}
                          label="Groups"
                          value={featuredCup.group_count}
                        />
                        <FeaturedStat
                          icon={<Trophy className="h-4 w-4" />}
                          label="Knockout"
                          value={featuredCup.knockout_team_count}
                        />
                      </div>
                    </div>

                    <div className="flex flex-col justify-between border-t border-slate-700 bg-slate-950/60 p-6 lg:border-l lg:border-t-0">
                      <div>
                        <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">
                          Competition Entry
                        </p>

                        <p className="mt-3 text-3xl font-black text-white">
                          {featuredCup.participant_count}
                          <span className="text-lg text-slate-500">
                            {" "}
                            / {featuredCup.competing_teams}
                          </span>
                        </p>

                        <p className="mt-1 text-sm text-slate-400">
                          confirmed participants
                        </p>

                        {featuredCup.is_participant && (
                          <div className="mt-5 rounded-xl border border-teal-500/30 bg-teal-500/10 p-3">
                            <p className="text-sm font-bold text-teal-200">
                              You are entered in this competition.
                            </p>
                          </div>
                        )}
                      </div>

                      <Link
                        href={`/cups/${featuredCup.id}`}
                        className="mt-7 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-teal-500 px-4 py-3 text-sm font-black text-slate-950 transition hover:bg-teal-400"
                      >
                        Enter Competition Hub
                        <ArrowRight className="h-4 w-4" />
                      </Link>
                    </div>
                  </div>
                </article>
              </section>
            )}

            {remainingCups.length > 0 && (
              <section className="mt-10">
                <div className="mb-4">
                  <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-500">
                    Competition Register
                  </p>
                  <h2 className="mt-1 text-2xl font-black text-slate-950">
                    All Cups
                  </h2>
                </div>

                <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                  {remainingCups.map((cup, index) => (
                    <article
                      key={cup.id}
                      className={`grid gap-4 p-5 transition hover:bg-slate-50 md:grid-cols-[1fr_auto] md:items-center ${
                        index > 0 ? "border-t border-slate-200" : ""
                      }`}
                    >
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span
                            className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-black ${statusClasses(
                              cup.status
                            )}`}
                          >
                            {statusIcon(cup.status)}
                            {statusLabel(cup.status)}
                          </span>

                          {cup.is_participant && (
                            <span className="rounded-full bg-teal-100 px-2.5 py-1 text-[11px] font-black text-teal-800">
                              You are competing
                            </span>
                          )}
                        </div>

                        <div className="mt-3 flex flex-col gap-1 sm:flex-row sm:items-baseline sm:gap-3">
                          <h3 className="truncate text-lg font-black text-slate-950">
                            {cup.name}
                          </h3>

                          <p className="text-sm font-semibold text-slate-500">
                            {cup.season_name} {cup.season_year}
                          </p>
                        </div>

                        <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-sm text-slate-600">
                          <span>
                            <strong className="text-slate-950">
                              {cup.competing_teams}
                            </strong>{" "}
                            teams
                          </span>
                          <span>
                            <strong className="text-slate-950">
                              {cup.group_count}
                            </strong>{" "}
                            groups
                          </span>
                          <span>
                            <strong className="text-slate-950">
                              {cup.teams_per_group}
                            </strong>{" "}
                            per group
                          </span>
                          <span>
                            <strong className="text-slate-950">
                              {cup.knockout_team_count}
                            </strong>{" "}
                            knockout teams
                          </span>
                          <span>
                            <strong className="text-slate-950">
                              {cup.participant_count}
                            </strong>{" "}
                            confirmed
                          </span>
                        </div>
                      </div>

                      <Link
                        href={`/cups/${cup.id}`}
                        className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-black text-slate-900 transition hover:border-teal-500 hover:text-teal-700"
                      >
                        View Cup
                        <ChevronRight className="h-4 w-4" />
                      </Link>
                    </article>
                  ))}
                </div>
              </section>
            )}
          </>
        )}
      </div>
    </main>
  );
}

function HeaderStat({
  label,
  value,
}: {
  label: string;
  value: number;
}) {
  return (
    <div className="min-w-[88px] rounded-xl border border-slate-800 bg-slate-900 px-4 py-3 text-center">
      <p className="text-2xl font-black">{value}</p>
      <p className="mt-0.5 text-[10px] font-black uppercase tracking-wider text-slate-400">
        {label}
      </p>
    </div>
  );
}

function FeaturedStat({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
}) {
  return (
    <div className="rounded-xl border border-slate-700 bg-slate-800/80 p-3">
      <div className="text-teal-300">{icon}</div>
      <p className="mt-2 text-2xl font-black text-white">{value}</p>
      <p className="mt-0.5 text-[10px] font-black uppercase tracking-wider text-slate-400">
        {label}
      </p>
    </div>
  );
}