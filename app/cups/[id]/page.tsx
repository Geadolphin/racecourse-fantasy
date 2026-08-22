"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { Fragment, useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  Trophy,
  Users,
  CalendarDays,
  ChevronDown,
  UserRound,
  X,
} from "lucide-react";

import { supabase } from "@/lib/supabase";

type Cup = {
  id: string;
  name: string;
  status: string;
  season_name: string;
  season_year: number;
  competing_teams: number;
  group_count: number;
  teams_per_group: number;
  automatic_qualifiers_per_group: number;
  additional_qualifier_position: number | null;
  additional_qualifier_count: number;
};

type Participant = {
  id: string;
  user_id: string;
  seed_number: number | null;
  display_name: string;
};

type Group = {
  id: string;
  group_number: number;
  group_name: string;
};

type GroupMember = {
  group_id: string;
  participant_id: string;
  group_position: number | null;
  played: number;
  wins: number;
  draws: number;
  losses: number;
  group_points: number;
  fantasy_points_for: number;
};

type Stage = {
  id: string;
  stage_type: "group" | "knockout";
  stage_number: number;
  stage_name: string;
  round_id: string | null;
  sequence_number: number;
  knockout_team_count: number | null;
  is_complete: boolean;
  round_name: string | null;
};

type Match = {
  id: string;
  stage_id: string;
  group_id: string | null;
  match_number: number;
  participant_1_id: string;
  participant_2_id: string;
  participant_1_score: number | null;
  participant_2_score: number | null;
  winner_participant_id: string | null;
  match_status: string;
  is_draw: boolean;
  participant_1_seed: number | null;
  participant_2_seed: number | null;
  live_score?: boolean;
};

type LiveFixtureScore = {
  match_id: string;
  participant_1_score: number;
  participant_2_score: number;
  is_live: boolean;
};

type PageData = {
  success: boolean;
  cup: Cup;
  my_participant_id: string | null;
  participants: Participant[];
  groups: Group[];
  group_members: GroupMember[];
  stages: Stage[];
  matches: Match[];
};

type PlayerProfile = {
  id: string;
  display_name: string;
};

type SeasonSummary = {
  season_id: string;
  season_name: string;
  total_points: number;
  overall_rank: number | null;
  rounds_played: number;
  round_wins: number;
  highest_round_score: number;
  top_ten_finishes: number;
};

type RoundHistoryRow = {
  round_id: string;
  round_number: number;
  round_name: string | null;
  total_points: number;
  round_rank: number | null;
};

type PlayerProfileData = {
  success: boolean;
  message?: string;
  profile: PlayerProfile | null;
  season_summary: SeasonSummary | null;
  round_history: RoundHistoryRow[];
};

type FixtureCompareSelection = {
  race_entry_id: string;
  horse_id: string;
  horse_name: string;
  is_captain: boolean;
  selected_price: number;
  fantasy_points: number;
  display_points: number;
  race_id: string;
  race_number: number;
  race_name: string;
  race_grade: string;
  racecourse_name: string | null;
};

type FixtureCompareTeam = {
  id: string;
  user_id: string;
  team_name: string | null;
  display_name?: string | null;
  status: string;
  salary_used: number;
  salary_cap: number | null;
  score?: {
    total_points: number | null;
    captain_points: number | null;
    round_rank: number | null;
  } | null;
  selections?: FixtureCompareSelection[];
};

type FixtureCompareData = {
  success: boolean;
  locked: boolean;
  round: {
    id: string;
    round_number: number;
    name: string | null;
    status: string;
    lockout_at: string | null;
  } | null;
  my_team: FixtureCompareTeam | null;
  opponent_team: FixtureCompareTeam | null;
  message?: string;
};

export default function CupDetailPage() {
  const params = useParams<{ id: string }>();
  const cupId = params.id;

  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<PageData | null>(null);
  const [errorMessage, setErrorMessage] = useState("");

  const [liveFixtureScores, setLiveFixtureScores] =
    useState<Record<string, LiveFixtureScore>>({});

  const [profileOpen, setProfileOpen] = useState(false);
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileError, setProfileError] = useState("");
  const [profileData, setProfileData] =
    useState<PlayerProfileData | null>(null);

  const [fixtureCompareOpen, setFixtureCompareOpen] =
    useState(false);
  const [fixtureCompareLoading, setFixtureCompareLoading] =
    useState(false);
  const [fixtureCompareError, setFixtureCompareError] =
    useState("");
  const [fixtureCompareData, setFixtureCompareData] =
    useState<FixtureCompareData | null>(null);

  useEffect(() => {
    if (cupId) void loadCup();
  }, [cupId]);

  async function loadLiveFixtureScores() {
    if (!cupId) {
      return;
    }

    const { data: scoreRaw, error: scoreError } =
      await supabase.rpc(
        "get_cup_live_fixture_scores",
        {
          p_cup_id: cupId,
        }
      );

    if (scoreError) {
      console.error(
        "Cup live fixture score error:",
        scoreError
      );
      return;
    }

    const rows =
      ((scoreRaw as any)?.scores ?? []) as LiveFixtureScore[];

    const nextScores: Record<string, LiveFixtureScore> = {};

    for (const row of rows) {
      nextScores[row.match_id] = {
        match_id: row.match_id,
        participant_1_score: Number(
          row.participant_1_score ?? 0
        ),
        participant_2_score: Number(
          row.participant_2_score ?? 0
        ),
        is_live: row.is_live === true,
      };
    }

    setLiveFixtureScores(nextScores);
  }

  async function loadCup() {
    setLoading(true);
    setErrorMessage("");

    try {
      const { data: response, error } = await supabase.rpc(
        "get_player_cup_detail",
        { p_cup_id: cupId }
      );

      if (error) throw error;

      setData(response as unknown as PageData);
      void loadLiveFixtureScores();
    } catch (error) {
      console.error("Cup detail load error:", error);
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Unable to load this Cup."
      );
    } finally {
      setLoading(false);
    }
  }

  const participantById = useMemo(
    () =>
      new Map(
        (data?.participants ?? []).map((participant) => [
          participant.id,
          participant,
        ])
      ),
    [data]
  );

  function participantName(id: string) {
    return participantById.get(id)?.display_name ?? "TBC";
  }

  function participantUserId(id: string) {
    return participantById.get(id)?.user_id ?? null;
  }

  async function openFixtureCompare(
    roundId: string,
    participant1Id: string,
    participant2Id: string
  ) {
    const userId1 = participantUserId(participant1Id);
    const userId2 = participantUserId(participant2Id);

    if (!userId1 || !userId2) {
      setFixtureCompareOpen(true);
      setFixtureCompareError(
        "Unable to identify both teams in this fixture."
      );
      setFixtureCompareData(null);
      return;
    }

    setFixtureCompareOpen(true);
    setFixtureCompareLoading(true);
    setFixtureCompareError("");
    setFixtureCompareData(null);

    const { data: compareRaw, error: compareError } =
      await supabase.rpc(
        "get_fixture_team_comparison_data",
        {
          p_round_id: roundId,
          p_user_id_1: userId1,
          p_user_id_2: userId2,
        }
      );

    if (compareError) {
      console.error(
        "Cup fixture comparison error:",
        compareError
      );

      setFixtureCompareError(
        compareError.message ||
          "Unable to compare these two teams."
      );
      setFixtureCompareLoading(false);
      return;
    }

    const comparison =
      compareRaw as unknown as FixtureCompareData;

    if (!comparison.locked) {
      setFixtureCompareError(
        comparison.message ||
          "Team comparison becomes available after round lockout."
      );
      setFixtureCompareData(comparison);
      setFixtureCompareLoading(false);
      return;
    }

    setFixtureCompareData(comparison);
    setFixtureCompareLoading(false);
  }

  async function openPlayerProfile(
    participantId: string
  ) {
    const userId =
      participantById.get(participantId)?.user_id;

    if (!userId) {
      return;
    }

    setProfileOpen(true);
    setProfileLoading(true);
    setProfileError("");
    setProfileData(null);

    const {
      data: loadedProfile,
      error,
    } = await supabase.rpc(
      "get_player_profile",
      {
        p_user_id: userId,
      }
    );

    if (error) {
      console.error(
        "Player profile RPC error:",
        error
      );

      setProfileError(
        error.message ||
          "The player profile could not be loaded."
      );

      setProfileLoading(false);
      return;
    }

    const nextProfile =
      loadedProfile as unknown as PlayerProfileData;

    if (
      !nextProfile.success ||
      !nextProfile.profile
    ) {
      setProfileError(
        nextProfile.message ||
          "The player profile could not be found."
      );

      setProfileData(nextProfile);
      setProfileLoading(false);
      return;
    }

    setProfileData(nextProfile);
    setProfileLoading(false);
  }

  function isMe(id: string) {
    return data?.my_participant_id === id;
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-100 p-6 md:p-10">
        <div className="mx-auto max-w-7xl rounded-2xl border bg-white p-10 text-center text-slate-500">
          Loading Cup...
        </div>
      </main>
    );
  }

  if (!data || errorMessage) {
    return (
      <main className="min-h-screen bg-slate-100 p-6 md:p-10">
        <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 md:py-10">
          <Link
            href="/cups"
            className="inline-flex items-center gap-2 font-semibold text-teal-700"
          >
            <ArrowLeft className="h-4 w-4" />
            Cups
          </Link>

          <div className="mt-6 rounded-xl border border-red-200 bg-red-50 p-5 text-red-700">
            {errorMessage || "Cup could not be loaded."}
          </div>
        </div>
      </main>
    );
  }

  const cupData = data;

  const groupStages = cupData.stages.filter(
    (stage) => stage.stage_type === "group"
  );

  const knockoutStages = cupData.stages.filter(
    (stage) => stage.stage_type === "knockout"
  );

  const displayMatches = cupData.matches.map((match) => {
    const live = liveFixtureScores[match.id];

    const matchIsFinal =
      match.match_status === "complete" ||
      match.match_status === "completed" ||
      match.match_status === "final" ||
      match.match_status === "scored";

    if (matchIsFinal || !live?.is_live) {
      return {
        ...match,
        live_score: false,
      };
    }

    return {
      ...match,
      participant_1_score: live.participant_1_score,
      participant_2_score: live.participant_2_score,
      live_score: true,
    };
  });

  const liveGroupMatches = displayMatches.filter(
    (match) =>
      match.group_id !== null &&
      match.live_score === true
  );

  const groupStandingsAreLive =
    liveGroupMatches.length > 0;

  function getDisplayGroupMembers(groupId: string) {
    const baseMembers = cupData.group_members
      .filter((member) => member.group_id === groupId)
      .map((member) => ({
        ...member,
        live_position: 0,
      }));

    const memberByParticipantId = new Map(
      baseMembers.map((member) => [
        member.participant_id,
        member,
      ])
    );

    /*
     * Apply only currently-live, not-yet-final Cup matches.
     *
     * Stored group_members already contains completed matchdays,
     * so only live_score matches are added here. This prevents
     * completed fixtures being counted twice.
     */
    for (const match of liveGroupMatches) {
      if (match.group_id !== groupId) {
        continue;
      }

      const participant1 =
        memberByParticipantId.get(
          match.participant_1_id
        );

      const participant2 =
        memberByParticipantId.get(
          match.participant_2_id
        );

      if (!participant1 || !participant2) {
        continue;
      }

      const score1 = Number(
        match.participant_1_score ?? 0
      );

      const score2 = Number(
        match.participant_2_score ?? 0
      );

      participant1.fantasy_points_for += score1;
      participant2.fantasy_points_for += score2;

      participant1.played += 1;
      participant2.played += 1;

      if (score1 > score2) {
        participant1.wins += 1;
        participant1.group_points += 3;
        participant2.losses += 1;
      } else if (score2 > score1) {
        participant2.wins += 1;
        participant2.group_points += 3;
        participant1.losses += 1;
      } else {
        participant1.draws += 1;
        participant2.draws += 1;
        participant1.group_points += 1;
        participant2.group_points += 1;
      }
    }

    const sorted = [...baseMembers].sort((a, b) => {
      if (b.group_points !== a.group_points) {
        return b.group_points - a.group_points;
      }

      if (
        b.fantasy_points_for !==
        a.fantasy_points_for
      ) {
        return (
          b.fantasy_points_for -
          a.fantasy_points_for
        );
      }

      if (b.wins !== a.wins) {
        return b.wins - a.wins;
      }

      return participantName(
        a.participant_id
      ).localeCompare(
        participantName(b.participant_id)
      );
    });

    return sorted.map((member, index) => ({
      ...member,
      live_position: index + 1,
    }));
  }

  const additionalQualifierPosition = cupData.cup.additional_qualifier_position;
  const additionalQualifierCount = cupData.cup.additional_qualifier_count;

  const additionalQualifiers = cupData.groups
    .map((group) => {
      const member = cupData.group_members.find(
        (candidate) =>
          candidate.group_id === group.id &&
          candidate.group_position === additionalQualifierPosition
      );

      return member ? { ...member, group_name: group.group_name } : null;
    })
    .filter(
      (member): member is GroupMember & { group_name: string } =>
        member !== null
    )
    .sort((a, b) => {
      if (b.group_points !== a.group_points) {
        return b.group_points - a.group_points;
      }
      if (b.fantasy_points_for !== a.fantasy_points_for) {
        return b.fantasy_points_for - a.fantasy_points_for;
      }
      if (b.wins !== a.wins) {
        return b.wins - a.wins;
      }
      return participantName(a.participant_id).localeCompare(
        participantName(b.participant_id)
      );
    });

  function ordinal(value: number) {
    const mod100 = value % 100;
    if (mod100 >= 11 && mod100 <= 13) return `${value}th`;

    switch (value % 10) {
      case 1:
        return `${value}st`;
      case 2:
        return `${value}nd`;
      case 3:
        return `${value}rd`;
      default:
        return `${value}th`;
    }
  }

  return (
    <main className="min-h-screen bg-slate-100">
      <div className="mx-auto max-w-7xl">
        <Link
          href="/cups"
          className="inline-flex items-center gap-2 text-sm font-black text-teal-700 transition hover:text-slate-950"
        >
          <ArrowLeft className="h-4 w-4" />
          Cup Competitions
        </Link>

        <header className="mt-5 overflow-hidden rounded-2xl border border-slate-800 bg-slate-950 text-white shadow-lg">
          <div className="border-b border-slate-800 px-6 py-4 md:px-8">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-teal-300">
                <Trophy className="h-5 w-5" />
                <p className="text-xs font-black uppercase tracking-[0.22em]">
                  Official Cup Competition
                </p>
              </div>

              <span className="rounded-full border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs font-black capitalize text-slate-200">
                {cupData.cup.status.replaceAll("_", " ")}
              </span>
            </div>
          </div>

          <div className="grid lg:grid-cols-[1fr_320px]">
            <div className="p-6 md:p-8">
              <p className="text-xs font-black uppercase tracking-[0.18em] text-teal-300">
                {cupData.cup.season_name} {cupData.cup.season_year}
              </p>

              <h1 className="mt-2 text-3xl font-black tracking-tight md:text-5xl">
                {cupData.cup.name}
              </h1>

              <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-300 md:text-base">
                Group-stage qualification followed by knockout racing through to the Final.
              </p>

              <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-400">
                The top {cupData.cup.automatic_qualifiers_per_group}{" "}
                {cupData.cup.automatic_qualifiers_per_group === 1
                  ? "team"
                  : "teams"}{" "}
                from each group qualify for the knockout stage. Teams finishing
                1st or 2nd earn a bye through the Preliminary Round and advance
                directly to the Round of 32, while teams finishing 3rd–6th
                qualify for the Preliminary Round
                {cupData.cup.additional_qualifier_count > 0 &&
                cupData.cup.additional_qualifier_position !== null
                  ? `, with the best ${cupData.cup.additional_qualifier_count} ${ordinal(
                      cupData.cup.additional_qualifier_position
                    )}-placed ${
                      cupData.cup.additional_qualifier_count === 1
                        ? "team"
                        : "teams"
                    } across all groups also advancing`
                  : ""}
                .
              </p>

              {cupData.my_participant_id && (
                <div className="mt-5 inline-flex items-center rounded-full border border-teal-400/30 bg-teal-400/10 px-3 py-1.5 text-sm font-black text-teal-200">
                  You are competing in this Cup
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-px border-t border-slate-800 bg-slate-800 lg:border-l lg:border-t-0">
              <OfficialStat label="Teams" value={cupData.cup.competing_teams} />
              <OfficialStat label="Groups" value={cupData.cup.group_count} />
              <OfficialStat label="Per Group" value={cupData.cup.teams_per_group} />
              <OfficialStat
                label="Knockout"
                value={
                  cupData.cup.group_count *
                    cupData.cup.automatic_qualifiers_per_group +
                  cupData.cup.additional_qualifier_count
                }
              />
            </div>
          </div>
        </header>

        <section className="mt-8">
          <div className="mb-4 flex items-end justify-between gap-4 border-b border-slate-300 pb-3">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.18em] text-teal-700">
                Group Stage
              </p>
              <div className="mt-1 flex items-center gap-2">
                <Users className="h-5 w-5 text-slate-700" />
                <h2 className="text-2xl font-black text-slate-950">
                  Standings
                </h2>

                {groupStandingsAreLive && (
                  <span className="rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-black uppercase tracking-wide text-red-700">
                    Live
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="mb-4 flex flex-wrap gap-2 text-xs font-bold">
            <span className="rounded-full bg-emerald-200 px-2.5 py-1 text-emerald-900">
              Top 2 — Round of 32 bye
            </span>
            <span className="rounded-full bg-blue-200 px-2.5 py-1 text-blue-900">
              3rd–6th — Preliminary Round
            </span>
            <span className="rounded-full bg-amber-200 px-2.5 py-1 text-amber-900">
              Your team
            </span>
          </div>

          {cupData.groups.length === 0 ? (
            <Empty text="Groups have not been generated yet." />
          ) : (
            <div className="grid gap-5 xl:grid-cols-2">
              {cupData.groups.map((group) => {
                const members =
                  getDisplayGroupMembers(group.id);

                return (
                  <div
                    key={group.id}
                    className="overflow-hidden rounded-xl border border-slate-300 bg-white shadow-sm"
                  >
                    <div className="border-b border-slate-300 bg-slate-950 px-5 py-3 text-white">
                      <h3 className="font-black text-white">
                        {group.group_name}
                      </h3>
                    </div>

                    <div className="overflow-x-auto">
                      <table className="w-full min-w-[500px] text-sm">
                        <thead>
                          <tr className="text-left text-xs uppercase tracking-wide text-slate-400">
                            <th className="px-4 py-3">Pos</th>
                            <th className="px-4 py-3">Team</th>
                            <th className="px-3 py-3 text-center">W</th>
                            <th className="px-3 py-3 text-center">D</th>
                            <th className="px-3 py-3 text-center">L</th>
                            <th className="px-3 py-3 text-center">FP</th>
                            <th className="px-3 py-3 text-center">Pts</th>
                          </tr>
                        </thead>

                        <tbody>
                          {members.map((member, index) => (
                            <tr
                              key={member.participant_id}
                              className={`${
                                isMe(member.participant_id)
                                  ? "bg-amber-200"
                                  : member.live_position <= 2
                                    ? "bg-emerald-100"
                                    : member.live_position <=
                                        cupData.cup.automatic_qualifiers_per_group
                                      ? "bg-blue-100"
                                      : ""
                              }`}
                            >
                              <td className="px-4 py-3 font-bold">
                                {member.live_position}
                              </td>
                              <td className="px-4 py-3 font-semibold text-slate-900">
                                <button
                                  type="button"
                                  onClick={() =>
                                    void openPlayerProfile(
                                      member.participant_id
                                    )
                                  }
                                  className="text-left transition hover:text-teal-700 hover:underline"
                                >
                                  {participantName(member.participant_id)}
                                  {isMe(member.participant_id) && (
                                    <span className="ml-2 text-xs font-black text-amber-700">
                                      YOU
                                    </span>
                                  )}
                                </button>
                              </td>
                              <td className="px-3 py-3 text-center">{member.wins}</td>
                              <td className="px-3 py-3 text-center">{member.draws}</td>
                              <td className="px-3 py-3 text-center">{member.losses}</td>
                              <td className="px-3 py-3 text-center">{member.fantasy_points_for}</td>
                              <td className="px-3 py-3 text-center font-bold">{member.group_points}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {additionalQualifierPosition !== null &&
          additionalQualifierCount > 0 && (
            <section className="mt-8">
              <div className="mb-4 border-b border-slate-300 pb-3">
                <p className="text-xs font-black uppercase tracking-[0.18em] text-emerald-700">
                  Knockout Qualification
                </p>
                <div className="mt-1 flex items-center gap-2">
                  <Trophy className="h-5 w-5 text-slate-700" />
                  <h2 className="text-2xl font-black text-slate-950">
                    Additional Qualifiers
                  </h2>
                </div>
                <p className="mt-2 text-sm text-slate-500">
                  Top {additionalQualifierCount} {ordinal(additionalQualifierPosition)}-placed{" "}
                  {additionalQualifierCount === 1 ? "team" : "teams"} advance to the knockout stage.
                </p>
              </div>

              {additionalQualifiers.length === 0 ? (
                <Empty text="Additional qualifier standings are not available yet." />
              ) : (
                <div className="overflow-hidden rounded-xl border border-slate-300 bg-white shadow-sm">
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[660px] text-sm">
                      <thead className="bg-slate-950 text-white">
                        <tr className="text-left text-xs uppercase tracking-wide">
                          <th className="px-4 py-3">Rank</th>
                          <th className="px-4 py-3">Team</th>
                          <th className="px-4 py-3">Group</th>
                          <th className="px-3 py-3 text-center">W</th>
                          <th className="px-3 py-3 text-center">D</th>
                          <th className="px-3 py-3 text-center">L</th>
                          <th className="px-3 py-3 text-center">FP</th>
                          <th className="px-3 py-3 text-center">Pts</th>
                        </tr>
                      </thead>
                      <tbody>
                        {additionalQualifiers.map((member, index) => {
                          const qualifying = index < additionalQualifierCount;
                          return (
                            <Fragment key={member.participant_id}>
                              {index === additionalQualifierCount && (
                                <tr>
                                  <td colSpan={8} className="border-y-2 border-emerald-500 bg-emerald-50 px-4 py-2 text-center">
                                    <span className="text-[11px] font-black uppercase tracking-[0.22em] text-emerald-700">
                                      Qualify
                                    </span>
                                  </td>
                                </tr>
                              )}
                              <tr className={`border-t border-slate-100 ${
                                isMe(member.participant_id)
                                  ? "bg-blue-100"
                                  : qualifying
                                    ? "bg-emerald-50/60"
                                    : ""
                              }`}>
                                <td className="px-4 py-3 font-black">{index + 1}</td>
                                <td className="px-4 py-3 font-semibold text-slate-900">
                                  <button
                                    type="button"
                                    onClick={() => void openPlayerProfile(member.participant_id)}
                                    className="text-left transition hover:text-teal-700 hover:underline"
                                  >
                                    {participantName(member.participant_id)}
                                    {isMe(member.participant_id) && (
                                      <span className="ml-2 text-xs font-black text-blue-700">YOU</span>
                                    )}
                                  </button>
                                </td>
                                <td className="px-4 py-3 font-semibold text-slate-600">{member.group_name}</td>
                                <td className="px-3 py-3 text-center">{member.wins}</td>
                                <td className="px-3 py-3 text-center">{member.draws}</td>
                                <td className="px-3 py-3 text-center">{member.losses}</td>
                                <td className="px-3 py-3 text-center">{member.fantasy_points_for}</td>
                                <td className="px-3 py-3 text-center font-black">{member.group_points}</td>
                              </tr>
                            </Fragment>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </section>
          )}

        <section className="mt-8">
          <div className="mb-4 flex items-end justify-between gap-4 border-b border-slate-300 pb-3">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.18em] text-teal-700">
                Match Centre
              </p>
              <div className="mt-1 flex items-center gap-2">
                <CalendarDays className="h-5 w-5 text-slate-700" />
                <h2 className="text-2xl font-black text-slate-950">
                  Fixtures & Results
                </h2>
              </div>
            </div>
          </div>

          <div className="space-y-3">
            {groupStages.map((stage) => {
              const stageMatches = displayMatches.filter(
                (match) => match.stage_id === stage.id
              );

              return (
                <StageCard
                  key={stage.id}
                  stage={stage}
                  matches={stageMatches}
                  participantName={participantName}
                  participantUserId={participantUserId}
                  openPlayerProfile={openPlayerProfile}
                  openFixtureCompare={openFixtureCompare}
                  isMe={isMe}
                />
              );
            })}

            {groupStages.length === 0 && (
              <Empty text="Cup fixtures have not been generated yet." />
            )}
          </div>
        </section>

        <section className="mt-8 pb-10">
          <div className="mb-4 flex items-end justify-between gap-4 border-b border-slate-300 pb-3">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.18em] text-purple-700">
                Championship Bracket
              </p>
              <div className="mt-1 flex items-center gap-2">
                <Trophy className="h-5 w-5 text-slate-700" />
                <h2 className="text-2xl font-black text-slate-950">
                  Knockout Stage
                </h2>
              </div>
            </div>
          </div>

          {knockoutStages.length === 0 ? (
            <Empty text="The knockout stage has not been generated yet." />
          ) : (
            <KnockoutBracket
              stages={knockoutStages}
              matches={displayMatches}
              participantName={participantName}
              participantUserId={participantUserId}
              openPlayerProfile={openPlayerProfile}
              openFixtureCompare={openFixtureCompare}
              isMe={isMe}
            />
          )}
        </section>
        {fixtureCompareOpen && (
          <div
            className="fixed inset-0 z-[110] flex items-center justify-center bg-slate-950/60 p-3 sm:p-4"
            onMouseDown={(event) => {
              if (event.target === event.currentTarget) {
                setFixtureCompareOpen(false);
              }
            }}
          >
            <div className="max-h-[92vh] w-full max-w-5xl overflow-hidden rounded-2xl bg-white shadow-2xl">
              <div className="flex items-center justify-between gap-4 border-b border-slate-200 px-4 py-4 sm:px-6">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.16em] text-teal-700">
                    Cup Fixture
                  </p>
                  <h2 className="mt-1 text-xl font-black text-slate-950 sm:text-2xl">
                    Compare Teams
                  </h2>
                </div>

                <button
                  type="button"
                  onClick={() => setFixtureCompareOpen(false)}
                  className="rounded-lg p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-950"
                  aria-label="Close fixture comparison"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="max-h-[calc(92vh-76px)] overflow-y-auto p-4 sm:p-6">
                {fixtureCompareLoading ? (
                  <div className="py-14 text-center font-semibold text-slate-500">
                    Loading team comparison...
                  </div>
                ) : fixtureCompareError ? (
                  <div className="rounded-xl border border-red-200 bg-red-50 p-5 text-sm font-semibold text-red-700">
                    {fixtureCompareError}
                  </div>
                ) : fixtureCompareData?.my_team &&
                  fixtureCompareData.opponent_team ? (
                  <>
                    <div className="mb-5 overflow-hidden rounded-2xl bg-slate-950 text-white">
                      <div className="border-b border-slate-800 px-4 py-3 text-center">
                        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-teal-300">
                          Official Head-to-Head
                        </p>
                        <p className="mt-1 text-sm font-semibold text-slate-300">
                          Round {fixtureCompareData.round?.round_number}
                          {fixtureCompareData.round?.name
                            ? ` · ${fixtureCompareData.round.name}`
                            : ""}
                        </p>
                      </div>

                      <div className="grid grid-cols-[1fr_auto_1fr] items-center">
                        <div className="min-w-0 p-4 text-right sm:p-5">
                          <p className="truncate text-base font-black sm:text-xl">
                            {fixtureCompareData.my_team.display_name?.trim() ||
                              fixtureCompareData.my_team.team_name?.trim() ||
                              "Team 1"}
                          </p>
                        </div>

                        <div className="border-x border-slate-800 bg-slate-900 px-4 py-5 text-center">
                          <div className="flex items-center gap-3">
                            <span className="text-3xl font-black tabular-nums">
                              {fixtureCompareData.my_team.score?.total_points ?? 0}
                            </span>
                            <span className="text-[10px] font-black uppercase tracking-wide text-slate-500">
                              vs
                            </span>
                            <span className="text-3xl font-black tabular-nums">
                              {fixtureCompareData.opponent_team.score?.total_points ?? 0}
                            </span>
                          </div>
                        </div>

                        <div className="min-w-0 p-4 sm:p-5">
                          <p className="truncate text-base font-black sm:text-xl">
                            {fixtureCompareData.opponent_team.display_name?.trim() ||
                              fixtureCompareData.opponent_team.team_name?.trim() ||
                              "Team 2"}
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="grid gap-4 md:grid-cols-2">
                      <FixtureCompareTeam
                        title={
                          fixtureCompareData.my_team.display_name?.trim() ||
                          fixtureCompareData.my_team.team_name?.trim() ||
                          "Team 1"
                        }
                        selections={
                          fixtureCompareData.my_team.selections ?? []
                        }
                        otherSelections={
                          fixtureCompareData.opponent_team.selections ?? []
                        }
                      />

                      <FixtureCompareTeam
                        title={
                          fixtureCompareData.opponent_team.display_name?.trim() ||
                          fixtureCompareData.opponent_team.team_name?.trim() ||
                          "Team 2"
                        }
                        selections={
                          fixtureCompareData.opponent_team.selections ?? []
                        }
                        otherSelections={
                          fixtureCompareData.my_team.selections ?? []
                        }
                      />
                    </div>

                    <div className="mt-4 flex flex-wrap gap-2 text-xs font-bold">
                      <span className="rounded-full bg-slate-100 px-2.5 py-1 text-slate-700">
                        Grey = shared horse
                      </span>
                      <span className="rounded-full bg-amber-100 px-2.5 py-1 text-amber-800">
                        C = captain
                      </span>
                    </div>
                  </>
                ) : (
                  <div className="py-12 text-center text-slate-500">
                    Comparison unavailable.
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {profileOpen && (
          <div
            className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/60 p-4"
            onMouseDown={(event) => {
              if (event.target === event.currentTarget) {
                setProfileOpen(false);
              }
            }}
          >
            <div className="w-full max-w-lg overflow-hidden rounded-2xl bg-white shadow-2xl">
              <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-teal-100 text-teal-700">
                    <UserRound className="h-5 w-5" />
                  </div>

                  <div>
                    <p className="text-xs font-bold uppercase tracking-wide text-teal-700">
                      Player Profile
                    </p>

                    <h2 className="text-lg font-bold text-slate-950">
                      {profileData?.profile?.display_name ??
                        (profileLoading
                          ? "Loading..."
                          : "Player")}
                    </h2>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setProfileOpen(false)}
                  className="rounded-lg p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-900"
                  aria-label="Close player profile"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {profileLoading ? (
                <div className="p-8 text-center text-slate-500">
                  Loading player profile...
                </div>
              ) : profileError ? (
                <div className="p-6 text-sm font-medium text-red-700">
                  {profileError}
                </div>
              ) : profileData?.profile ? (
                <div className="p-5">
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                    <ProfileStat
                      label="Overall Rank"
                      value={
                        profileData.season_summary?.overall_rank
                          ? `#${profileData.season_summary.overall_rank}`
                          : "—"
                      }
                    />

                    <ProfileStat
                      label="Total Points"
                      value={
                        profileData.season_summary?.total_points ??
                        0
                      }
                    />

                    <ProfileStat
                      label="Round Wins"
                      value={
                        profileData.season_summary?.round_wins ??
                        0
                      }
                    />

                    <ProfileStat
                      label="Highest Round"
                      value={
                        profileData.season_summary
                          ?.highest_round_score ?? 0
                      }
                    />
                  </div>

                  {profileData.season_summary && (
                    <p className="mt-4 text-sm text-slate-500">
                      {profileData.season_summary.season_name}
                      {" · "}
                      {profileData.season_summary.rounds_played}
                      {" rounds played"}
                    </p>
                  )}

                  {profileData.round_history.length > 0 && (
                    <div className="mt-5">
                      <p className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-500">
                        Recent Rounds
                      </p>

                      <div className="divide-y divide-slate-100 rounded-xl border border-slate-200">
                        {profileData.round_history
                          .slice(0, 5)
                          .map((round) => (
                            <div
                              key={round.round_id}
                              className="flex items-center justify-between gap-3 px-3 py-2.5"
                            >
                              <div>
                                <p className="text-sm font-semibold text-slate-900">
                                  Round {round.round_number}
                                  {round.round_name
                                    ? ` — ${round.round_name}`
                                    : ""}
                                </p>

                                <p className="text-xs text-slate-500">
                                  Rank{" "}
                                  {round.round_rank
                                    ? `#${round.round_rank}`
                                    : "—"}
                                </p>
                              </div>

                              <span className="font-bold text-teal-700">
                                {round.total_points}
                              </span>
                            </div>
                          ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : null}
            </div>
          </div>
        )}
      </div>
    </main>
  );
}

function OfficialStat({
  label,
  value,
}: {
  label: string;
  value: number;
}) {
  return (
    <div className="bg-slate-900 p-5">
      <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">
        {label}
      </p>
      <p className="mt-2 text-2xl font-black text-white">
        {value}
      </p>
    </div>
  );
}

function Stat({
  label,
  value,
}: {
  label: string;
  value: number;
}) {
  return (
    <div className="rounded-xl bg-white/5 p-3">
      <p className="text-xs font-bold uppercase tracking-wide text-slate-400">
        {label}
      </p>
      <p className="mt-1 text-xl font-bold text-white">{value}</p>
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-slate-500 shadow-sm">
      {text}
    </div>
  );
}

function KnockoutBracket({
  stages,
  matches,
  participantName,
  participantUserId,
  openPlayerProfile,
  openFixtureCompare,
  isMe,
}: {
  stages: Stage[];
  matches: Match[];
  participantName: (id: string) => string;
  participantUserId: (id: string) => string | null;
  openPlayerProfile: (id: string) => Promise<void>;
  openFixtureCompare: (
    roundId: string,
    participant1Id: string,
    participant2Id: string
  ) => Promise<void>;
  isMe: (id: string) => boolean;
}) {
  const orderedStages = [...stages].sort(
    (a, b) => a.sequence_number - b.sequence_number
  );

  return (
    <div className="overflow-x-auto pb-3">
      <div
        className="grid min-w-max items-start gap-5"
        style={{
          gridTemplateColumns: `repeat(${orderedStages.length}, minmax(240px, 280px))`,
        }}
      >
        {orderedStages.map((stage) => {
          const stageMatches = matches
            .filter((match) => match.stage_id === stage.id)
            .sort((a, b) => a.match_number - b.match_number);

          return (
            <section
              key={stage.id}
              className="min-w-[240px]"
            >
              <div className="mb-3 border-b-2 border-slate-900 pb-2">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <h3 className="font-black text-slate-950">
                      {stage.stage_name}
                    </h3>

                    {stageMatches.some((match) => match.live_score) && (
                      <span className="rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-black uppercase tracking-wide text-red-700">
                        Live
                      </span>
                    )}
                  </div>

                  {stage.is_complete && (
                    <span className="rounded-full bg-teal-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-teal-800">
                      Complete
                    </span>
                  )}
                </div>

                <p className="mt-0.5 text-xs text-slate-500">
                  {stage.round_name ?? "Round not assigned"}
                </p>
              </div>

              {stageMatches.length === 0 ? (
                <div className="rounded-xl border border-dashed border-slate-300 bg-white p-4 text-center text-sm text-slate-500">
                  Fixtures not yet available.
                </div>
              ) : (
                <div
                  className="flex flex-col justify-around gap-4"
                  style={{
                    minHeight: `${Math.max(180, stageMatches.length * 112)}px`,
                  }}
                >
                  {stageMatches.map((match) => (
                    <div
                      key={match.id}
                      className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm"
                    >
                      <div className="flex items-center justify-between bg-slate-50 px-3 py-1.5">
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-bold uppercase tracking-wide text-slate-400">
                            Match {match.match_number}
                          </span>

                        </div>

                        {match.is_draw && (
                          <span className="text-[10px] font-bold uppercase text-slate-500">
                            Draw
                          </span>
                        )}
                      </div>

                      <BracketTeam
                        participantId={match.participant_1_id}
                        name={participantName(match.participant_1_id)}
                        score={match.participant_1_score}
                        winner={
                          match.winner_participant_id ===
                          match.participant_1_id
                        }
                        mine={isMe(match.participant_1_id)}
                        onOpenProfile={openPlayerProfile}
                      />

                      <div className="border-t border-slate-100" />

                      <BracketTeam
                        participantId={match.participant_2_id}
                        name={participantName(match.participant_2_id)}
                        score={match.participant_2_score}
                        winner={
                          match.winner_participant_id ===
                          match.participant_2_id
                        }
                        mine={isMe(match.participant_2_id)}
                        onOpenProfile={openPlayerProfile}
                      />

                      {stage.round_id &&
                        participantUserId(match.participant_1_id) &&
                        participantUserId(match.participant_2_id) && (
                          <div className="border-t border-slate-100 p-2">
                            <button
                              type="button"
                              onClick={() =>
                                void openFixtureCompare(
                                  stage.round_id!,
                                  match.participant_1_id,
                                  match.participant_2_id
                                )
                              }
                              className="block w-full rounded-lg bg-slate-900 px-3 py-2 text-center text-xs font-black uppercase tracking-wide text-white transition hover:bg-teal-700"
                            >
                              Compare Teams
                            </button>
                          </div>
                        )}
                    </div>
                  ))}
                </div>
              )}
            </section>
          );
        })}
      </div>
    </div>
  );
}

function BracketTeam({
  participantId,
  name,
  score,
  winner,
  mine,
  onOpenProfile,
}: {
  participantId: string;
  name: string;
  score: number | null;
  winner: boolean;
  mine: boolean;
  onOpenProfile: (id: string) => Promise<void>;
}) {
  return (
    <div
      className={`flex min-h-11 items-center justify-between gap-3 px-3 py-2 ${
        mine
          ? "bg-teal-50"
          : winner
            ? "bg-slate-50"
            : ""
      }`}
    >
      <button
        type="button"
        onClick={() => void onOpenProfile(participantId)}
        className={`min-w-0 truncate text-left text-sm transition hover:text-teal-700 hover:underline ${
          winner
            ? "font-black text-slate-950"
            : "font-semibold text-slate-700"
        }`}
      >
        {name}

        {mine && (
          <span className="ml-1.5 text-[9px] font-bold uppercase tracking-wide text-teal-700">
            You
          </span>
        )}
      </button>

      <span
        className={`shrink-0 text-base font-black ${
          winner ? "text-teal-700" : "text-slate-700"
        }`}
      >
        {score ?? "–"}
      </span>
    </div>
  );
}

function FixtureCompareTeam({
  title,
  selections,
  otherSelections,
}: {
  title: string;
  selections: FixtureCompareSelection[];
  otherSelections: FixtureCompareSelection[];
}) {
  const otherHorseIds = new Set(
    otherSelections.map((selection) => selection.horse_id)
  );

  return (
    <section className="overflow-hidden rounded-xl border border-slate-200">
      <div className="bg-slate-100 px-4 py-3">
        <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">
          Team Sheet
        </p>
        <h3 className="mt-0.5 truncate font-black text-slate-950">
          {title}
        </h3>
      </div>

      <div className="divide-y divide-slate-100">
        {selections.map((selection) => {
          const shared = otherHorseIds.has(selection.horse_id);

          return (
            <div
              key={selection.race_entry_id}
              className={`grid grid-cols-[1fr_auto] items-center gap-3 px-4 py-3 ${
                shared ? "bg-slate-50" : "bg-white"
              }`}
            >
              <div className="min-w-0">
                <div className="flex min-w-0 items-center gap-2">
                  <p className="truncate font-bold text-slate-900">
                    {selection.horse_name}
                  </p>

                  {selection.is_captain && (
                    <span className="shrink-0 rounded-full bg-amber-200 px-1.5 py-0.5 text-[9px] font-black text-amber-900">
                      C
                    </span>
                  )}
                </div>

                <p className="mt-0.5 truncate text-xs text-slate-500">
                  {selection.racecourse_name ?? "Racecourse"} · R
                  {selection.race_number}
                  {shared ? " · Shared" : ""}
                </p>
              </div>

              <span className="text-lg font-black text-teal-700">
                {selection.display_points ?? 0}
              </span>
            </div>
          );
        })}

        {selections.length === 0 && (
          <div className="px-4 py-8 text-center text-sm text-slate-500">
            No team selections found.
          </div>
        )}
      </div>
    </section>
  );
}

function ProfileStat({
  label,
  value,
}: {
  label: string;
  value: string | number;
}) {
  return (
    <div className="rounded-xl bg-slate-50 p-3">
      <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">
        {label}
      </p>

      <p className="mt-1 text-lg font-bold text-slate-950">
        {value}
      </p>
    </div>
  );
}

function StageCard({
  stage,
  matches,
  participantName,
  participantUserId,
  openPlayerProfile,
  openFixtureCompare,
  isMe,
}: {
  stage: Stage;
  matches: Match[];
  participantName: (id: string) => string;
  participantUserId: (id: string) => string | null;
  openPlayerProfile: (id: string) => Promise<void>;
  openFixtureCompare: (
    roundId: string,
    participant1Id: string,
    participant2Id: string
  ) => Promise<void>;
  isMe: (id: string) => boolean;
}) {
  const [open, setOpen] = useState(false);

  return (
    <article className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        className="flex w-full items-center justify-between gap-3 bg-slate-50 px-4 py-3 text-left transition hover:bg-slate-100"
        aria-expanded={open}
      >
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-bold text-slate-950">
              {stage.stage_name}
            </h3>

            {matches.some((match) => match.live_score) && (
              <span className="rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-black uppercase tracking-wide text-red-700">
                Live
              </span>
            )}

            <span className="text-xs text-slate-500">
              {matches.length} {matches.length === 1 ? "match" : "matches"}
            </span>

            {stage.is_complete && (
              <span className="rounded-full bg-teal-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-teal-800">
                Complete
              </span>
            )}
          </div>

          <p className="mt-0.5 text-xs text-slate-500">
            {stage.round_name ?? "Round not assigned"}
          </p>
        </div>

        <ChevronDown
          className={`h-4 w-4 shrink-0 text-slate-500 transition-transform ${
            open ? "rotate-180" : ""
          }`}
        />
      </button>

      {open && (
        <>
          {matches.length === 0 ? (
            <div className="px-4 py-4 text-sm text-slate-500">
              Fixtures not yet available.
            </div>
          ) : (
            <div className="grid gap-3 p-3 sm:grid-cols-2 xl:grid-cols-4">
              {matches.map((match) => (
                <div
                  key={match.id}
                  className="min-w-0 rounded-lg border border-slate-200 bg-white p-3"
                >
                  <div className="mb-2 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold uppercase tracking-wide text-slate-400">
                        Match {match.match_number}
                      </span>

                    </div>

                    {match.is_draw && (
                      <span className="text-xs font-bold text-slate-500">
                        Draw
                      </span>
                    )}
                  </div>

                  <div className="space-y-1">
                    <MatchTeam
                      name={participantName(match.participant_1_id)}
                      participantId={match.participant_1_id}
                      onOpenProfile={openPlayerProfile}
                      score={match.participant_1_score}
                      winner={
                        match.winner_participant_id === match.participant_1_id
                      }
                      mine={isMe(match.participant_1_id)}
                    />

                    <MatchTeam
                      name={participantName(match.participant_2_id)}
                      participantId={match.participant_2_id}
                      onOpenProfile={openPlayerProfile}
                      score={match.participant_2_score}
                      winner={
                        match.winner_participant_id === match.participant_2_id
                      }
                      mine={isMe(match.participant_2_id)}
                    />
                  </div>

                  {stage.round_id &&
                    participantUserId(match.participant_1_id) &&
                    participantUserId(match.participant_2_id) && (
                      <button
                        type="button"
                        onClick={() =>
                          void openFixtureCompare(
                            stage.round_id!,
                            match.participant_1_id,
                            match.participant_2_id
                          )
                        }
                        className="mt-3 block w-full rounded-lg bg-slate-900 px-3 py-2 text-center text-xs font-black uppercase tracking-wide text-white transition hover:bg-teal-700"
                      >
                        Compare Teams
                      </button>
                    )}
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </article>
  );
}

function MatchTeam({
  name,
  participantId,
  onOpenProfile,
  score,
  winner,
  mine,
}: {
  name: string;
  participantId: string;
  onOpenProfile: (id: string) => Promise<void>;
  score: number | null;
  winner: boolean;
  mine: boolean;
}) {
  return (
    <div
      className={`flex min-h-9 items-center justify-between gap-3 rounded-md px-2 py-1.5 ${
        mine
          ? "bg-teal-50"
          : winner
            ? "bg-slate-50"
            : ""
      }`}
    >
      <div className="min-w-0">
        <button
          type="button"
          onClick={() =>
            void onOpenProfile(participantId)
          }
          className={`block truncate text-left text-base transition hover:text-teal-700 hover:underline ${
            winner
              ? "font-bold text-slate-950"
              : "font-medium text-slate-700"
          }`}
        >
          {name}
          {mine && (
            <span className="ml-1.5 text-[9px] font-bold uppercase tracking-wide text-teal-700">
              You
            </span>
          )}
        </button>
      </div>

      <span
        className={`shrink-0 text-base font-bold ${
          winner
            ? "text-teal-700"
            : "text-slate-700"
        }`}
      >
        {score ?? "–"}
      </span>
    </div>
  );
}