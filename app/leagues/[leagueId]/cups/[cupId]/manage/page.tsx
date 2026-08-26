"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  CalendarDays,
  CheckCircle2,
  Eye,
  Loader2,
  Play,
  RefreshCw,
  ShieldCheck,
  Swords,
  Trash2,
  Trophy,
  Users,
} from "lucide-react";

import { supabase } from "@/lib/supabase";

type FinalsFormat =
  | "straight_knockout"
  | "seeded_byes"
  | "double_chance";

type Cup = {
  id: string;
  name: string;
  status: string;
  season_id: string;
  season_name: string;
  season_year: number;
  competing_teams: number;
  group_count: number;
  teams_per_group: number;
  automatic_qualifiers_per_group: number;
  additional_qualifier_position: number | null;
  additional_qualifier_count: number;
  finals_format?: FinalsFormat;
  double_chance_team_count?: number;
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
  id?: string;
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
  cup_id?: string;
  stage_type: "group" | "knockout";
  stage_number: number;
  stage_name: string;
  round_id: string | null;
  sequence_number: number;
  knockout_team_count: number | null;
  is_complete: boolean;
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
};

type CupDetailData = {
  success: boolean;
  cup: Cup;
  my_participant_id: string | null;
  participants: Participant[];
  groups: Group[];
  group_members: GroupMember[];
  stages: Stage[];
  matches: Match[];
};

type League = {
  id: string;
  name: string;
  owner_user_id: string;
  season_id: string;
};

type Round = {
  id: string;
  season_id: string;
  round_number: number;
  name: string | null;
  status: string;
  lockout_at?: string | null;
};

function statusClasses(status: string) {
  switch (status) {
    case "draft":
      return "bg-amber-100 text-amber-800";
    case "ready":
      return "bg-teal-100 text-teal-800";
    case "group_stage":
      return "bg-blue-100 text-blue-800";
    case "knockout":
      return "bg-purple-100 text-purple-800";
    case "completed":
      return "bg-slate-900 text-white";
    case "cancelled":
      return "bg-red-100 text-red-800";
    default:
      return "bg-slate-100 text-slate-700";
  }
}

function roundLabel(round: Round) {
  return `Round ${round.round_number}${
    round.name ? ` — ${round.name}` : ""
  }`;
}

export default function LeagueCupManagementPage() {
  const params = useParams<{
    leagueId: string;
    cupId: string;
  }>();

  const leagueId = params.leagueId;
  const cupId = params.cupId;
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [league, setLeague] = useState<League | null>(null);
  const [cupData, setCupData] = useState<CupDetailData | null>(null);
  const [rounds, setRounds] = useState<Round[]>([]);
  const [currentUserId, setCurrentUserId] = useState("");

  const [updatingStageId, setUpdatingStageId] =
    useState<string | null>(null);

  const [generatingFixtures, setGeneratingFixtures] =
    useState(false);

  const [publishingCup, setPublishingCup] =
    useState(false);

  const [deletingCup, setDeletingCup] =
    useState(false);

  const [finalsFormat, setFinalsFormat] =
    useState<FinalsFormat>("straight_knockout");

  const [doubleChanceTeamCount, setDoubleChanceTeamCount] =
    useState(4);

  const [savingFinalsFormat, setSavingFinalsFormat] =
    useState(false);

  const [generatingFinals, setGeneratingFinals] =
    useState(false);

  const [scoringFinalsStageId, setScoringFinalsStageId] =
    useState<string | null>(null);

  const [errorMessage, setErrorMessage] =
    useState("");

  const [successMessage, setSuccessMessage] =
    useState("");

  const loadPage = useCallback(async () => {
    if (!leagueId || !cupId) {
      return;
    }

    setLoading(true);
    setErrorMessage("");

    const {
      data: authData,
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !authData.user) {
      setErrorMessage("You must be signed in.");
      setLoading(false);
      return;
    }

    const userId = authData.user.id;
    setCurrentUserId(userId);

    const [
      { data: leagueRaw, error: leagueError },
      { data: detailRaw, error: detailError },
      { data: leagueCupsRaw, error: leagueCupsError },
      { data: finalsRaw, error: finalsError },
    ] = await Promise.all([
      supabase
        .from("leagues")
        .select("id, name, owner_user_id, season_id")
        .eq("id", leagueId)
        .maybeSingle(),

      supabase.rpc("get_player_cup_detail", {
        p_cup_id: cupId,
      }),

      supabase.rpc("get_league_cups", {
        p_league_id: leagueId,
      }),

      supabase
        .from("cup_competitions")
        .select("finals_format, double_chance_team_count")
        .eq("id", cupId)
        .maybeSingle(),
    ]);

    if (leagueError || !leagueRaw) {
      setErrorMessage(
        leagueError?.message ||
          "The private league could not be loaded."
      );
      setLoading(false);
      return;
    }

    const loadedLeague = leagueRaw as League;

    if (loadedLeague.owner_user_id !== userId) {
      setLeague(loadedLeague);
      setErrorMessage(
        "Only the owner of this private league can manage its League Cups."
      );
      setLoading(false);
      return;
    }

    if (detailError || !detailRaw) {
      setLeague(loadedLeague);
      setErrorMessage(
        detailError?.message ||
          "The League Cup could not be loaded."
      );
      setLoading(false);
      return;
    }

    if (leagueCupsError) {
      setLeague(loadedLeague);
      setErrorMessage(
        leagueCupsError.message ||
          "Unable to verify this League Cup."
      );
      setLoading(false);
      return;
    }

    const leagueCupList =
      ((leagueCupsRaw as any)?.cups ?? []) as {
        id: string;
        league_id: string;
      }[];

    const belongsToLeague = leagueCupList.some(
      (item) =>
        item.id === cupId &&
        item.league_id === leagueId
    );

    if (!belongsToLeague) {
      setLeague(loadedLeague);
      setErrorMessage(
        "This Cup does not belong to this private league."
      );
      setLoading(false);
      return;
    }

    const loadedDetail =
      detailRaw as unknown as CupDetailData;

    if (finalsError) {
      console.error(
        "League Cup finals format load error:",
        finalsError
      );
    }

    const loadedFinalsFormat =
      (finalsRaw?.finals_format as FinalsFormat | null) ??
      "straight_knockout";

    const loadedDoubleChanceTeamCount =
      Number(finalsRaw?.double_chance_team_count ?? 0);

    loadedDetail.cup = {
      ...loadedDetail.cup,
      finals_format: loadedFinalsFormat,
      double_chance_team_count:
        loadedDoubleChanceTeamCount,
    };

    setFinalsFormat(loadedFinalsFormat);
    setDoubleChanceTeamCount(
      loadedDoubleChanceTeamCount > 0
        ? loadedDoubleChanceTeamCount
        : 4
    );

    const {
      data: roundRows,
      error: roundError,
    } = await supabase
      .from("rounds")
      .select(
        "id, season_id, round_number, name, status, lockout_at"
      )
      .eq("season_id", loadedDetail.cup.season_id)
      .order("round_number", { ascending: true });

    if (roundError) {
      console.error(
        "League Cup rounds load error:",
        roundError
      );
    }

    setLeague(loadedLeague);
    setCupData(loadedDetail);
    setRounds((roundRows ?? []) as Round[]);
    setLoading(false);
  }, [cupId, leagueId]);

  useEffect(() => {
    void loadPage();
  }, [loadPage]);

  const cup = cupData?.cup ?? null;
  const stages = useMemo(
    () =>
      [...(cupData?.stages ?? [])].sort(
        (a, b) =>
          a.sequence_number - b.sequence_number
      ),
    [cupData]
  );

  const groupStages = useMemo(
    () =>
      stages.filter(
        (stage) => stage.stage_type === "group"
      ),
    [stages]
  );

  const knockoutStages = useMemo(
    () =>
      stages.filter(
        (stage) => stage.stage_type === "knockout"
      ),
    [stages]
  );

  const allGroupStagesComplete =
    groupStages.length > 0 &&
    groupStages.every(
      (stage) => stage.is_complete
    );

  const firstFinalsStage =
    knockoutStages[0] ?? null;

  const firstFinalsMatches = firstFinalsStage
    ? (cupData?.matches ?? []).filter(
        (match) =>
          match.stage_id === firstFinalsStage.id
      )
    : [];

  const finalsGenerated =
    firstFinalsMatches.length > 0;

  const groupMatches = useMemo(
    () =>
      (cupData?.matches ?? []).filter((match) =>
        groupStages.some(
          (stage) => stage.id === match.stage_id
        )
      ),
    [cupData, groupStages]
  );

  const participantCount =
    cupData?.participants.length ?? 0;

  const groupCount =
    cupData?.groups.length ?? 0;

  const fixtureCount =
    groupMatches.length;

  const participantSetupComplete =
    Boolean(cup) &&
    participantCount === cup!.competing_teams;

  const groupDrawComplete =
    Boolean(cup) &&
    groupCount === cup!.group_count;

  const fixturesGenerated =
    groupDrawComplete && fixtureCount > 0;

  const scheduledStageCount = stages.filter(
    (stage) => Boolean(stage.round_id)
  ).length;

  const allStagesScheduled =
    stages.length > 0 &&
    scheduledStageCount === stages.length;

  const knockoutTeamCount = cup
    ? cup.group_count *
        cup.automatic_qualifiers_per_group +
      (cup.additional_qualifier_count ?? 0)
    : 0;

  const canPublish =
    cup?.status === "draft" &&
    participantSetupComplete &&
    groupDrawComplete &&
    fixturesGenerated;

  const usedRoundIds = useMemo(
    () =>
      new Set(
        stages
          .map((stage) => stage.round_id)
          .filter(
            (roundId): roundId is string =>
              Boolean(roundId)
          )
      ),
    [stages]
  );

  async function handleStageRoundChange(
    stageId: string,
    roundId: string
  ) {
    if (!cup || !league) {
      return;
    }

    if (league.owner_user_id !== currentUserId) {
      setErrorMessage(
        "Only the league owner can change the Cup schedule."
      );
      return;
    }

    setUpdatingStageId(stageId);
    setErrorMessage("");
    setSuccessMessage("");

    const { error } = await supabase.rpc(
      "admin_update_cup_stage_round",
      {
        p_cup_id: cup.id,
        p_stage_id: stageId,
        p_round_id: roundId || null,
      }
    );

    if (error) {
      setErrorMessage(
        error.message ||
          "Unable to update the Cup schedule."
      );
      setUpdatingStageId(null);
      return;
    }

    setCupData((current) => {
      if (!current) {
        return current;
      }

      return {
        ...current,
        stages: current.stages.map((stage) =>
          stage.id === stageId
            ? {
                ...stage,
                round_id: roundId || null,
              }
            : stage
        ),
      };
    });

    setSuccessMessage("Cup schedule updated.");
    setUpdatingStageId(null);
  }

  async function handleSaveFinalsFormat() {
    if (!cup || !league) {
      return;
    }

    if (league.owner_user_id !== currentUserId) {
      setErrorMessage(
        "Only the league owner can change the finals format."
      );
      return;
    }

    const doubleChanceCount =
      finalsFormat === "double_chance"
        ? 4
        : 0;

    setSavingFinalsFormat(true);
    setErrorMessage("");
    setSuccessMessage("");

    const { error } = await supabase.rpc(
      "update_league_cup_finals_format",
      {
        p_cup_id: cup.id,
        p_finals_format: finalsFormat,
        p_double_chance_team_count:
          doubleChanceCount,
      }
    );

    if (error) {
      setErrorMessage(
        error.message ||
          "Unable to update the finals format."
      );
      setSavingFinalsFormat(false);
      return;
    }

    setSuccessMessage("Finals format updated.");
    setSavingFinalsFormat(false);

    /*
     * The backend rebuilds the knockout stages when the
     * finals format changes, so reload the page data to
     * immediately show the correct finals weeks.
     */
    await loadPage();
  }

  async function handleGenerateFinals() {
    if (!cup || !league) {
      return;
    }

    if (league.owner_user_id !== currentUserId) {
      setErrorMessage(
        "Only the league owner can generate the finals."
      );
      return;
    }

    if (!allGroupStagesComplete) {
      setErrorMessage(
        "All group-stage matchdays must be complete before the finals can be generated."
      );
      return;
    }

    if (!firstFinalsStage) {
      setErrorMessage(
        "No finals stages have been created. Save the finals format first."
      );
      return;
    }

    const confirmed = window.confirm(
      finalsGenerated
        ? `Regenerate the opening finals matches for "${cup.name}"?`
        : `Generate the finals for "${cup.name}"?`
    );

    if (!confirmed) {
      return;
    }

    setGeneratingFinals(true);
    setErrorMessage("");
    setSuccessMessage("");

    const { error } = await supabase.rpc(
      "generate_league_cup_first_finals",
      {
        p_cup_id: cup.id,
      }
    );

    if (error) {
      setErrorMessage(
        error.message ||
          "Unable to generate the League Cup finals."
      );
      setGeneratingFinals(false);
      return;
    }

    setSuccessMessage(
      finalsGenerated
        ? "Opening finals matches regenerated."
        : "League Cup finals generated."
    );

    setGeneratingFinals(false);
    await loadPage();
  }

  async function handleScoreAndProgressFinals(
    stage: Stage
  ) {
    if (!cup || !league) {
      return;
    }

    if (league.owner_user_id !== currentUserId) {
      setErrorMessage(
        "Only the league owner can score and progress the finals."
      );
      return;
    }

    if (!stage.round_id) {
      setErrorMessage(
        `Assign a Racecourse Fantasy round to ${stage.stage_name} before scoring it.`
      );
      return;
    }

    const stageMatches =
      (cupData?.matches ?? []).filter(
        (match) => match.stage_id === stage.id
      );

    if (stageMatches.length === 0) {
      setErrorMessage(
        stage === firstFinalsStage
          ? "Generate the finals before scoring the opening finals week."
          : `${stage.stage_name} has not been generated yet. Complete the previous finals week first.`
      );
      return;
    }

    const isFinal =
      stage.stage_name === "Final" ||
      stage.knockout_team_count === 2;

    const confirmed = window.confirm(
      isFinal
        ? `Score the Final for "${cup.name}" and complete the Cup?`
        : `Score ${stage.stage_name} and generate the next finals week?`
    );

    if (!confirmed) {
      return;
    }

    setScoringFinalsStageId(stage.id);
    setErrorMessage("");
    setSuccessMessage("");

    const { error } = await supabase.rpc(
      "score_and_progress_league_cup_finals",
      {
        p_cup_id: cup.id,
        p_stage_id: stage.id,
      }
    );

    if (error) {
      setErrorMessage(
        error.message ||
          `Unable to score ${stage.stage_name}.`
      );
      setScoringFinalsStageId(null);
      return;
    }

    setSuccessMessage(
      isFinal
        ? "Final scored. League Cup completed."
        : `${stage.stage_name} scored and the next finals week generated.`
    );

    setScoringFinalsStageId(null);
    await loadPage();
  }

  async function handleGenerateFixtures() {
    if (!cup || !league) {
      return;
    }

    if (league.owner_user_id !== currentUserId) {
      setErrorMessage(
        "Only the league owner can generate League Cup fixtures."
      );
      return;
    }

    if (!participantSetupComplete) {
      setErrorMessage(
        `The Cup must have exactly ${cup.competing_teams} participants before fixtures can be generated.`
      );
      return;
    }

    const confirmed = window.confirm(
      fixturesGenerated
        ? `Regenerate the group fixtures for "${cup.name}"?\n\nExisting group-stage fixtures will be replaced.`
        : `Generate group fixtures for "${cup.name}"?`
    );

    if (!confirmed) {
      return;
    }

    setGeneratingFixtures(true);
    setErrorMessage("");
    setSuccessMessage("");

    /*
     * League Cups normally have their groups generated when
     * create_league_cup runs. If an older Cup does not have
     * groups, generate them first.
     */
    if (!groupDrawComplete) {
      const { error: groupError } =
        await supabase.rpc(
          "generate_cup_groups",
          {
            p_cup_id: cup.id,
          }
        );

      if (groupError) {
        setErrorMessage(
          groupError.message ||
            "Unable to generate the League Cup groups."
        );
        setGeneratingFixtures(false);
        return;
      }
    }

    const { error: fixtureError } =
      await supabase.rpc(
        "generate_cup_group_fixtures",
        {
          p_cup_id: cup.id,
        }
      );

    if (fixtureError) {
      setErrorMessage(
        fixtureError.message ||
          "Unable to generate League Cup fixtures."
      );
      setGeneratingFixtures(false);
      await loadPage();
      return;
    }

    setSuccessMessage(
      fixturesGenerated
        ? "League Cup fixtures regenerated."
        : "League Cup fixtures generated."
    );

    setGeneratingFixtures(false);
    await loadPage();
  }

  async function handlePublishCup() {
    if (!cup || !league) {
      return;
    }

    if (league.owner_user_id !== currentUserId) {
      setErrorMessage(
        "Only the league owner can publish this League Cup."
      );
      return;
    }

    if (!canPublish) {
      setErrorMessage(
        "Complete the participant, group and fixture setup before publishing."
      );
      return;
    }

    const confirmed = window.confirm(
      `Publish "${cup.name}"?\n\nThis will change the Cup from Draft to Ready.`
    );

    if (!confirmed) {
      return;
    }

    setPublishingCup(true);
    setErrorMessage("");
    setSuccessMessage("");

    const { error } = await supabase.rpc(
      "admin_publish_cup",
      {
        p_cup_id: cup.id,
      }
    );

    if (error) {
      setErrorMessage(
        error.message ||
          "Unable to publish the League Cup."
      );
      setPublishingCup(false);
      return;
    }

    setSuccessMessage(
      `${cup.name} has been published.`
    );

    setPublishingCup(false);
    await loadPage();
  }

  async function handleDeleteCup() {
    if (!cup || !league) {
      return;
    }

    if (league.owner_user_id !== currentUserId) {
      setErrorMessage(
        "Only the league owner can delete this League Cup."
      );
      return;
    }

    const confirmed = window.confirm(
      `Delete "${cup.name}"?\n\nThis will permanently delete the League Cup, including its participants, groups, fixtures, stages and results. This cannot be undone.`
    );

    if (!confirmed) {
      return;
    }

    const typedConfirmation = window.prompt(
      `Type DELETE to permanently delete "${cup.name}".`
    );

    if (typedConfirmation !== "DELETE") {
      return;
    }

    setDeletingCup(true);
    setErrorMessage("");
    setSuccessMessage("");

    const { error } = await supabase.rpc(
      "admin_delete_cup",
      {
        p_cup_id: cup.id,
      }
    );

    if (error) {
      setErrorMessage(
        error.message ||
          "Unable to delete the League Cup."
      );
      setDeletingCup(false);
      return;
    }

    router.push("/leagues");
    router.refresh();
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-100 p-4 sm:p-6 md:p-8">
        <div className="mx-auto max-w-6xl rounded-2xl border bg-white p-10 text-center shadow-sm">
          <Loader2 className="mx-auto h-7 w-7 animate-spin text-teal-700" />
          <p className="mt-3 font-semibold text-slate-600">
            Loading League Cup management...
          </p>
        </div>
      </main>
    );
  }

  if (!league || !cupData || errorMessage) {
    return (
      <main className="min-h-screen bg-slate-100 p-4 sm:p-6 md:p-8">
        <div className="mx-auto max-w-6xl">
          <Link
            href="/leagues"
            className="inline-flex items-center gap-2 text-sm font-bold text-teal-700 hover:underline"
          >
            <ArrowLeft className="h-4 w-4" />
            Private Leagues
          </Link>

          <div className="mt-5 rounded-xl border border-red-200 bg-red-50 p-5 text-red-700">
            {errorMessage ||
              "The League Cup could not be loaded."}
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-100">
      <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 md:py-8">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <Link
            href="/leagues"
            className="inline-flex items-center gap-2 text-sm font-bold text-teal-700 hover:underline"
          >
            <ArrowLeft className="h-4 w-4" />
            Private Leagues
          </Link>

          <Link
            href={`/cups/${cupData.cup.id}`}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-bold text-slate-800 shadow-sm transition hover:bg-slate-50"
          >
            <Eye className="h-4 w-4" />
            View Cup
          </Link>
        </div>

        <header className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-950 text-white shadow-lg">
          <div className="border-b border-slate-800 px-5 py-4 sm:px-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-teal-300">
                <ShieldCheck className="h-5 w-5" />
                <p className="text-xs font-black uppercase tracking-[0.18em]">
                  League Cup Management
                </p>
              </div>

              <span
                className={`rounded-full px-3 py-1 text-xs font-black uppercase tracking-wide ${statusClasses(
                  cupData.cup.status
                )}`}
              >
                {cupData.cup.status.replaceAll("_", " ")}
              </span>
            </div>
          </div>

          <div className="grid gap-px bg-slate-800 lg:grid-cols-[1fr_360px]">
            <div className="bg-slate-950 p-5 sm:p-6">
              <p className="text-sm font-bold text-teal-300">
                {league.name}
              </p>

              <h1 className="mt-1 text-3xl font-black tracking-tight sm:text-4xl">
                {cupData.cup.name}
              </h1>

              <p className="mt-2 text-sm text-slate-400">
                {cupData.cup.season_name}{" "}
                {cupData.cup.season_year}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-px bg-slate-800">
              <div className="bg-slate-900 p-4">
                <p className="text-[10px] font-black uppercase tracking-wide text-slate-500">
                  Teams
                </p>
                <p className="mt-1 text-2xl font-black">
                  {cupData.cup.competing_teams}
                </p>
              </div>

              <div className="bg-slate-900 p-4">
                <p className="text-[10px] font-black uppercase tracking-wide text-slate-500">
                  Groups
                </p>
                <p className="mt-1 text-2xl font-black">
                  {cupData.cup.group_count}
                </p>
              </div>

              <div className="bg-slate-900 p-4">
                <p className="text-[10px] font-black uppercase tracking-wide text-slate-500">
                  Group Size
                </p>
                <p className="mt-1 text-2xl font-black">
                  {cupData.cup.teams_per_group}
                </p>
              </div>

              <div className="bg-slate-900 p-4">
                <p className="text-[10px] font-black uppercase tracking-wide text-slate-500">
                  Qualify
                </p>
                <p className="mt-1 text-2xl font-black">
                  Top{" "}
                  {
                    cupData.cup
                      .automatic_qualifiers_per_group
                  }
                </p>
              </div>
            </div>
          </div>
        </header>

        {errorMessage && (
          <div className="mt-5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-700">
            {errorMessage}
          </div>
        )}

        {successMessage && (
          <div className="mt-5 rounded-xl border border-teal-200 bg-teal-50 p-4 text-sm font-semibold text-teal-800">
            {successMessage}
          </div>
        )}

        <section className="mt-5 overflow-hidden rounded-2xl border border-slate-300 bg-white shadow-sm">
          <div className="flex items-center gap-3 border-b border-slate-200 p-4 sm:p-5">
            <Trophy className="h-5 w-5 text-purple-700" />

            <div>
              <h2 className="font-black text-slate-950">
                Finals Format
              </h2>
              <p className="mt-0.5 text-sm text-slate-500">
                Choose how teams progress once the group stage is complete.
              </p>
            </div>
          </div>

          <div className="p-4 sm:p-5">
            <div className="grid gap-5 lg:grid-cols-[320px_1fr]">
              <div>
                <label
                  htmlFor="finals-format"
                  className="block text-sm font-black text-slate-800"
                >
                  Format
                </label>

                <select
                  id="finals-format"
                  value={finalsFormat}
                  onChange={(event) => {
                    const nextFormat =
                      event.target.value as FinalsFormat;

                    setFinalsFormat(nextFormat);

                    if (
                      nextFormat === "double_chance"
                    ) {
                      setDoubleChanceTeamCount(4);
                    }
                  }}
                  className="mt-2 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm font-semibold text-slate-900 outline-none focus:border-teal-700 focus:ring-2 focus:ring-teal-100"
                >
                  <option value="straight_knockout">
                    Straight Knockout
                  </option>

                  <option value="seeded_byes">
                    Top 6
                  </option>

                  <option value="double_chance">
                    Double Chance
                  </option>
                </select>

                {finalsFormat === "double_chance" && (
                  <div className="mt-4 rounded-lg border border-purple-200 bg-purple-50 p-3">
                    <p className="text-xs font-black uppercase tracking-wide text-purple-700">
                      Double-chance positions
                    </p>

                    <p className="mt-1 text-sm font-bold text-purple-950">
                      1st–2nd in each group
                    </p>

                    <p className="mt-1 text-xs leading-5 text-purple-700">
                      3rd–4th enter the elimination path.
                    </p>
                  </div>
                )}

                <button
                  type="button"
                  onClick={() =>
                    void handleSaveFinalsFormat()
                  }
                  disabled={savingFinalsFormat}
                  className="mt-4 inline-flex items-center justify-center gap-2 rounded-lg bg-purple-700 px-4 py-2.5 text-sm font-black text-white transition hover:bg-purple-800 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {savingFinalsFormat ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <ShieldCheck className="h-4 w-4" />
                  )}

                  {savingFinalsFormat
                    ? "Saving..."
                    : "Save Finals Format"}
                </button>
              </div>

              <div className="rounded-xl bg-slate-50 p-4 sm:p-5">
                {finalsFormat ===
                "straight_knockout" ? (
                  <>
                    <p className="font-black text-slate-950">
                      Straight Knockout
                    </p>

                    <p className="mt-2 text-sm leading-6 text-slate-600">
                      All {knockoutTeamCount} qualifiers enter a normal knockout bracket. One loss eliminates a team.
                    </p>
                  </>
                ) : finalsFormat ===
                  "seeded_byes" ? (
                  <>
                    <p className="font-black text-slate-950">
                      Top 6
                    </p>

                    <p className="mt-2 text-sm leading-6 text-slate-600">
                      Higher-ranked qualifiers can skip the opening finals round while lower-ranked qualifiers play an elimination round.
                    </p>
                  </>
                ) : (
                  <>
                    <p className="font-black text-slate-950">
                      Double Chance
                    </p>

                    <p className="mt-2 text-sm leading-6 text-slate-600">
                      In the 2-group, 8-team format, teams finishing 1st or 2nd receive a double chance. Teams finishing 3rd or 4th play elimination finals.
                    </p>

                    <div className="mt-4 rounded-xl border border-slate-200 bg-white p-4">
                      <p className="text-[10px] font-black uppercase tracking-wide text-slate-500">
                        Finals path
                      </p>

                      <div className="mt-3 space-y-2 text-sm font-semibold text-slate-700">
                        <p>Week 1: 1A v 2B, 1B v 2A, 3A v 4B, 3B v 4A</p>
                        <p>Week 2: QF losers v elimination-final winners</p>
                        <p>Week 3: QF winners return against Week 2 winners</p>
                        <p>Week 4: Final</p>
                      </div>
                    </div>
                  </>
                )}

                <div className="mt-4 border-t border-slate-200 pt-4">
                  <p className="text-[10px] font-black uppercase tracking-wide text-slate-500">
                    Finals field
                  </p>
                  <p className="mt-1 text-sm font-bold text-slate-800">
                    {knockoutTeamCount} teams
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="mt-5 overflow-hidden rounded-2xl border border-slate-300 bg-white shadow-sm">
          <div className="flex items-center gap-3 border-b border-slate-200 p-4 sm:p-5">
            <Trophy className="h-5 w-5 text-teal-700" />
            <div>
              <h2 className="font-black text-slate-950">
                Cup Setup
              </h2>
              <p className="mt-0.5 text-sm text-slate-500">
                Complete these steps before publishing.
              </p>
            </div>
          </div>

          <div className="grid gap-px bg-slate-200 sm:grid-cols-2 lg:grid-cols-4">
            <SetupCard
              title="Participants"
              value={`${participantCount} / ${cupData.cup.competing_teams}`}
              complete={participantSetupComplete}
            />

            <SetupCard
              title="Groups"
              value={`${groupCount} / ${cupData.cup.group_count}`}
              complete={groupDrawComplete}
            />

            <SetupCard
              title="Fixtures"
              value={
                fixturesGenerated
                  ? `${fixtureCount} generated`
                  : "Not generated"
              }
              complete={fixturesGenerated}
            />

            <SetupCard
              title="Schedule"
              value={`${scheduledStageCount} / ${stages.length}`}
              complete={allStagesScheduled}
              optional
            />
          </div>

          <div className="flex flex-wrap gap-3 border-t border-slate-200 p-4 sm:p-5">
            {cupData.cup.status === "draft" && (
              <button
                type="button"
                onClick={() =>
                  void handleGenerateFixtures()
                }
                disabled={generatingFixtures}
                className="inline-flex items-center gap-2 rounded-lg bg-slate-950 px-4 py-2.5 text-sm font-black text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {generatingFixtures ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : fixturesGenerated ? (
                  <RefreshCw className="h-4 w-4" />
                ) : (
                  <Swords className="h-4 w-4" />
                )}

                {generatingFixtures
                  ? "Generating..."
                  : fixturesGenerated
                    ? "Regenerate Fixtures"
                    : "Generate Fixtures"}
              </button>
            )}

            {allGroupStagesComplete &&
              firstFinalsStage &&
              cupData.cup.status !== "completed" && (
                <button
                  type="button"
                  onClick={() =>
                    void handleGenerateFinals()
                  }
                  disabled={generatingFinals}
                  className="inline-flex items-center gap-2 rounded-lg bg-purple-700 px-4 py-2.5 text-sm font-black text-white transition hover:bg-purple-800 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {generatingFinals ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Trophy className="h-4 w-4" />
                  )}

                  {generatingFinals
                    ? "Generating Finals..."
                    : finalsGenerated
                      ? "Regenerate Opening Finals"
                      : "Generate Finals"}
                </button>
              )}

            {cupData.cup.status === "draft" && (
              <button
                type="button"
                onClick={() =>
                  void handlePublishCup()
                }
                disabled={
                  publishingCup || !canPublish
                }
                className="inline-flex items-center gap-2 rounded-lg bg-teal-600 px-4 py-2.5 text-sm font-black text-white transition hover:bg-teal-700 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {publishingCup ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Play className="h-4 w-4" />
                )}

                {publishingCup
                  ? "Publishing..."
                  : "Publish Cup"}
              </button>
            )}

            {cupData.cup.status !== "draft" && (
              <div className="inline-flex items-center gap-2 rounded-lg bg-teal-50 px-4 py-2.5 text-sm font-bold text-teal-800">
                <CheckCircle2 className="h-4 w-4" />
                Cup published
              </div>
            )}
          </div>
        </section>

        <section className="mt-5 overflow-hidden rounded-2xl border border-slate-300 bg-white shadow-sm">
          <div className="flex items-center gap-3 border-b border-slate-200 p-4 sm:p-5">
            <CalendarDays className="h-5 w-5 text-teal-700" />

            <div>
              <h2 className="font-black text-slate-950">
                Cup Schedule
              </h2>
              <p className="mt-0.5 text-sm text-slate-500">
                Assign the Racecourse Fantasy round used for each Cup stage. Finals stages can then be scored and progressed directly here.
              </p>
            </div>
          </div>

          {stages.length === 0 ? (
            <div className="p-8 text-center text-sm text-slate-500">
              No Cup stages have been generated.
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {stages.map((stage) => (
                <div
                  key={stage.id}
                  className="grid gap-3 p-4 sm:p-5 md:grid-cols-[1fr_320px] md:items-center"
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-black text-slate-900">
                        {stage.stage_name}
                      </h3>

                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-black uppercase tracking-wide ${
                          stage.stage_type === "group"
                            ? "bg-teal-100 text-teal-800"
                            : "bg-purple-100 text-purple-800"
                        }`}
                      >
                        {stage.stage_type === "group"
                          ? "Group"
                          : stage.knockout_team_count
                            ? `${stage.knockout_team_count} teams`
                            : "Knockout"}
                      </span>

                      {stage.is_complete && (
                        <span className="rounded-full bg-slate-900 px-2 py-0.5 text-[10px] font-black uppercase tracking-wide text-white">
                          Complete
                        </span>
                      )}
                    </div>

                    <p className="mt-1 text-xs font-semibold text-slate-500">
                      Stage {stage.sequence_number}
                    </p>
                  </div>

                  <div className="flex flex-col gap-2">
                    <select
                      value={stage.round_id ?? ""}
                      onChange={(event) =>
                        void handleStageRoundChange(
                          stage.id,
                          event.target.value
                        )
                      }
                      disabled={
                        stage.is_complete ||
                        updatingStageId === stage.id
                      }
                      className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm font-semibold text-slate-900 outline-none focus:border-teal-700 focus:ring-2 focus:ring-teal-100 disabled:cursor-not-allowed disabled:bg-slate-100"
                    >
                      <option value="">
                        Assign later
                      </option>

                      {rounds.map((round) => {
                        const usedElsewhere =
                          usedRoundIds.has(round.id) &&
                          stage.round_id !== round.id;

                        return (
                          <option
                            key={round.id}
                            value={round.id}
                            disabled={usedElsewhere}
                          >
                            {roundLabel(round)}
                            {usedElsewhere
                              ? " — already used"
                              : ""}
                          </option>
                        );
                      })}
                    </select>

                    {stage.stage_type === "knockout" &&
                      !stage.is_complete && (
                        <button
                          type="button"
                          onClick={() =>
                            void handleScoreAndProgressFinals(
                              stage
                            )
                          }
                          disabled={
                            scoringFinalsStageId ===
                              stage.id ||
                            !stage.round_id ||
                            (cupData?.matches ?? []).filter(
                              (match) =>
                                match.stage_id ===
                                stage.id
                            ).length === 0
                          }
                          className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-slate-950 px-3 py-2.5 text-sm font-black text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-40"
                        >
                          {scoringFinalsStageId ===
                          stage.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Play className="h-4 w-4" />
                          )}

                          {scoringFinalsStageId ===
                          stage.id
                            ? "Scoring..."
                            : stage.stage_name ===
                                  "Final" ||
                                stage.knockout_team_count ===
                                  2
                              ? "Score Final"
                              : "Score & Progress"}
                        </button>
                      )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="mt-5 overflow-hidden rounded-2xl border border-red-200 bg-white shadow-sm">
          <div className="flex items-center gap-3 border-b border-red-100 bg-red-50 p-4 sm:p-5">
            <Trash2 className="h-5 w-5 text-red-700" />

            <div>
              <h2 className="font-black text-red-950">
                Danger Zone
              </h2>
              <p className="mt-0.5 text-sm text-red-700">
                Permanently remove this League Cup and all of its Cup data.
              </p>
            </div>
          </div>

          <div className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
            <div>
              <p className="font-black text-slate-950">
                Delete League Cup
              </p>
              <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-500">
                This deletes the Cup, groups, fixtures, stages, participants and results. The private league itself is not deleted.
              </p>
            </div>

            <button
              type="button"
              onClick={() => void handleDeleteCup()}
              disabled={deletingCup}
              className="inline-flex shrink-0 items-center justify-center gap-2 rounded-lg border border-red-300 bg-white px-4 py-2.5 text-sm font-black text-red-700 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {deletingCup ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Trash2 className="h-4 w-4" />
              )}

              {deletingCup
                ? "Deleting..."
                : "Delete League Cup"}
            </button>
          </div>
        </section>

        <section className="mt-5 grid gap-4 md:grid-cols-2">
          <div className="rounded-2xl border border-slate-300 bg-white p-5 shadow-sm">
            <div className="flex items-center gap-2">
              <Users className="h-5 w-5 text-teal-700" />
              <h2 className="font-black text-slate-950">
                Group Stage
              </h2>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-3">
              <MiniStat
                label="Matchdays"
                value={groupStages.length}
              />
              <MiniStat
                label="Fixtures"
                value={fixtureCount}
              />
            </div>
          </div>

          <div className="rounded-2xl border border-slate-300 bg-white p-5 shadow-sm">
            <div className="flex items-center gap-2">
              <Trophy className="h-5 w-5 text-purple-700" />
              <h2 className="font-black text-slate-950">
                Knockout Stage
              </h2>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-3">
              <MiniStat
                label="Rounds"
                value={knockoutStages.length}
              />
              <MiniStat
                label="First Field"
                value={
                  knockoutStages[0]
                    ?.knockout_team_count ?? "—"
                }
              />
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}

function SetupCard({
  title,
  value,
  complete,
  optional = false,
}: {
  title: string;
  value: string;
  complete: boolean;
  optional?: boolean;
}) {
  return (
    <div className="bg-white p-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[10px] font-black uppercase tracking-wide text-slate-500">
          {title}
        </p>

        {complete ? (
          <CheckCircle2 className="h-4 w-4 text-teal-600" />
        ) : optional ? (
          <span className="text-[9px] font-black uppercase tracking-wide text-slate-400">
            Optional
          </span>
        ) : (
          <span className="h-2.5 w-2.5 rounded-full bg-amber-400" />
        )}
      </div>

      <p className="mt-1 font-black text-slate-950">
        {value}
      </p>
    </div>
  );
}

function MiniStat({
  label,
  value,
}: {
  label: string;
  value: string | number;
}) {
  return (
    <div className="rounded-xl bg-slate-100 p-3">
      <p className="text-[10px] font-black uppercase tracking-wide text-slate-500">
        {label}
      </p>
      <p className="mt-1 text-xl font-black text-slate-950">
        {value}
      </p>
    </div>
  );
}