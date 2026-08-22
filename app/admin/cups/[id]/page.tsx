"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import {
  CalendarDays,
  Search,
  UserRound,
} from "lucide-react";

import { supabase } from "@/lib/supabase";

type CupCompetition = {
  id: string;
  season_id: string;
  name: string;
  status:
    | "draft"
    | "ready"
    | "group_stage"
    | "knockout"
    | "completed"
    | "cancelled";
  entry_method: "admin" | "automatic";
  competing_teams: number;
  group_count: number;
  teams_per_group: number;
  automatic_qualifiers_per_group: number;
  additional_qualifier_position: number | null;
  additional_qualifier_count: number;
};

type Season = {
  id: string;
  name: string;
  year: number;
};

type Round = {
  id: string;
  season_id: string;
  round_number: number;
  name: string | null;
  status: string;
  lockout_at: string | null;
};

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

type CupParticipant = {
  id: string;
  cup_id: string;
  user_id: string;
  qualification_method: string;
  qualification_rank: number | null;
  seed_number: number | null;
  added_at: string;
};

type ParticipantRow = {
  participant_id: string;
  user_id: string;
  display_name: string;
  seed_number: number | null;
};

type CupGroup = {
  id: string;
  cup_id: string;
  group_number: number;
  group_name: string;
};

type CupGroupMember = {
  id: string;
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

type CupStage = {
  id: string;
  cup_id: string;
  stage_type: "group" | "knockout";
  stage_number: number;
  stage_name: string;
  round_id: string | null;
  sequence_number: number;
  knockout_team_count: number | null;
  is_complete: boolean;
};

type CupMatch = {
  id: string;
  cup_id: string;
  stage_id: string;
  group_id: string | null;
  match_number: number;
  participant_1_id: string;
  participant_2_id: string;
  participant_1_score: number | null;
  participant_2_score: number | null;
  winner_participant_id: string | null;
  match_status: "scheduled" | "scored" | "complete" | "cancelled";
  is_draw: boolean;
  participant_1_seed: number | null;
  participant_2_seed: number | null;
};

type GroupMemberRow = {
  participant_id: string;
  display_name: string;
  seed_number: number | null;
  group_position: number | null;
  played: number;
  wins: number;
  draws: number;
  losses: number;
  group_points: number;
  fantasy_points_for: number;
};

type GroupRow = {
  id: string;
  group_number: number;
  group_name: string;
  members: GroupMemberRow[];
};

function statusClasses(
  status: CupCompetition["status"]
) {
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

export default function AdminCupDetailPage() {
  const params = useParams<{ id: string }>();
  const cupId = params.id;

  const [loading, setLoading] = useState(true);
  const [cup, setCup] = useState<CupCompetition | null>(null);
  const [season, setSeason] = useState<Season | null>(null);
  const [rounds, setRounds] = useState<Round[]>([]);
  const [stages, setStages] = useState<CupStage[]>([]);
  const [matches, setMatches] = useState<CupMatch[]>([]);
  const [groups, setGroups] = useState<GroupRow[]>([]);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [participants, setParticipants] = useState<ParticipantRow[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [updatingUserId, setUpdatingUserId] = useState<string | null>(null);
  const [generatingGroups, setGeneratingGroups] = useState(false);
  const [updatingStageId, setUpdatingStageId] = useState<string | null>(null);
  const [scoringStageId, setScoringStageId] = useState<string | null>(null);
  const [generatingKnockout, setGeneratingKnockout] = useState(false);
  const [scoringKnockoutStageId, setScoringKnockoutStageId] =
    useState<string | null>(null);
  const [publishingCup, setPublishingCup] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  async function loadPage() {
    setLoading(true);
    setErrorMessage("");

    const [
      { data: cupData, error: cupError },
      { data: adminUsersRaw, error: usersError },
      { data: participantData, error: participantError },
      { data: stageData, error: stageError },
      { data: groupData, error: groupError },
    ] = await Promise.all([
      supabase.rpc(
        "get_admin_cup",
        {
          p_cup_id: cupId,
        }
      ),

      supabase.rpc("get_admin_users"),

      supabase.rpc(
        "get_admin_cup_participants",
        {
          p_cup_id: cupId,
        }
      ),

      supabase.rpc(
        "get_admin_cup_stages_matches",
        {
          p_cup_id: cupId,
        }
      ),

      supabase.rpc(
        "get_admin_cup_groups",
        {
          p_cup_id: cupId,
        }
      ),


    ]);

    if (
      cupError ||
      usersError ||
      participantError ||
      stageError ||
      groupError ||
      !cupData
    ) {
      console.error({
        cupError,
        usersError,
        participantError,
        stageError,
        groupError,
      });

      setErrorMessage(
        cupError?.message ||
          usersError?.message ||
          participantError?.message ||
          stageError?.message ||
          groupError?.message ||
          "Unable to load Cup."
      );

      setLoading(false);
      return;
    }

    const loadedCup =
      (
        cupData as
          | {
              success?: boolean;
              cup?: CupCompetition;
            }
          | null
      )?.cup ?? null;

    if (!loadedCup) {
      setErrorMessage(
        "Cup could not be loaded."
      );
      setLoading(false);
      return;
    }
    const loadedUsersData = adminUsersRaw as unknown as AdminUsersData;
    const loadedUsers = loadedUsersData.users ?? [];
    const loadedParticipants =
      (
        participantData as
          | {
              success?: boolean;
              participants?: CupParticipant[];
            }
          | null
      )?.participants ?? [];

    const usersById = new Map(
      loadedUsers.map((user) => [user.id, user])
    );

    const participantRows: ParticipantRow[] =
      loadedParticipants.map((participant) => ({
        participant_id: participant.id,
        user_id: participant.user_id,
        display_name:
          usersById.get(participant.user_id)?.display_name?.trim() ||
          "Unnamed Player",
        seed_number: participant.seed_number,
      }));

    const { data: seasonData, error: seasonError } = await supabase
      .from("seasons")
      .select("id, name, year")
      .eq("id", loadedCup.season_id)
      .single();

    if (seasonError) {
      console.error("Season load error:", seasonError);
    }

    const { data: roundData, error: roundError } = await supabase
      .from("rounds")
      .select(`
        id,
        season_id,
        round_number,
        name,
        status,
        lockout_at
      `)
      .eq("season_id", loadedCup.season_id)
      .order("round_number", { ascending: true });

    if (roundError) {
      console.error("Rounds load error:", roundError);
    }

    const loadedGroupData =
      groupData as
        | {
            success?: boolean;
            groups?: CupGroup[];
            group_members?: CupGroupMember[];
          }
        | null;

    const rawGroups =
      loadedGroupData?.groups ?? [];

    const groupMembers =
      loadedGroupData?.group_members ?? [];

    const participantById =
      new Map(
        participantRows.map(
          (participant) => [
            participant.participant_id,
            participant,
          ]
        )
      );

    const groupRows: GroupRow[] =
      rawGroups.map((group) => {
        const members =
          groupMembers
            .filter(
              (member) =>
                member.group_id ===
                group.id
            )
            .map((member) => {
              const participant =
                participantById.get(
                  member.participant_id
                );

              return {
                participant_id:
                  member.participant_id,
                display_name:
                  participant
                    ?.display_name ??
                  "Unnamed Player",
                seed_number:
                  participant
                    ?.seed_number ??
                  null,
                group_position:
                  member.group_position,
                played:
                  member.played,
                wins:
                  member.wins,
                draws:
                  member.draws,
                losses:
                  member.losses,
                group_points:
                  member.group_points,
                fantasy_points_for:
                  member.fantasy_points_for,
              };
            })
            .sort((a, b) => {
              if (
                a.group_position !==
                  null &&
                b.group_position !==
                  null
              ) {
                return (
                  a.group_position -
                  b.group_position
                );
              }

              return (
                (a.seed_number ??
                  999999) -
                (b.seed_number ??
                  999999)
              );
            });

        return {
          id: group.id,
          group_number:
            group.group_number,
          group_name:
            group.group_name,
          members,
        };
      });

    setCup(loadedCup);
    setSeason(
      (seasonData ?? null) as Season | null
    );
    setRounds(
      (roundData ?? []) as Round[]
    );
    const loadedStageData =
      stageData as
        | {
            success?: boolean;
            stages?: CupStage[];
            matches?: CupMatch[];
          }
        | null;

    setStages(
      loadedStageData?.stages ?? []
    );

    setMatches(
      loadedStageData?.matches ?? []
    );

    setGroups(groupRows);
    setUsers(loadedUsers);
    setParticipants(participantRows);
    setLoading(false);
  }

  useEffect(() => {
    if (cupId) {
      void loadPage();
    }
  }, [cupId]);

  const participantUserIds = useMemo(
    () =>
      new Set(
        participants.map(
          (participant) => participant.user_id
        )
      ),
    [participants]
  );

  const filteredUsers = useMemo(() => {
    const term =
      searchTerm.trim().toLowerCase();

    return users
      .filter((user) => {
        const displayName =
          user.display_name?.trim() ||
          "Unnamed Player";

        return (
          !term ||
          displayName
            .toLowerCase()
            .includes(term)
        );
      })
      .sort((a, b) =>
        (
          a.display_name?.trim() ||
          "Unnamed Player"
        ).localeCompare(
          b.display_name?.trim() ||
            "Unnamed Player"
        )
      );
  }, [users, searchTerm]);

  const participantByParticipantId = useMemo(
    () =>
      new Map(
        participants.map((participant) => [
          participant.participant_id,
          participant,
        ])
      ),
    [participants]
  );

  const groupById = useMemo(
    () =>
      new Map(
        groups.map((group) => [
          group.id,
          group,
        ])
      ),
    [groups]
  );

  const matchesByStage = useMemo(() => {
    const map = new Map<string, CupMatch[]>();

    for (const match of matches) {
      const current =
        map.get(match.stage_id) ?? [];

      current.push(match);
      map.set(match.stage_id, current);
    }

    for (const stageMatches of map.values()) {
      stageMatches.sort(
        (a, b) =>
          a.match_number - b.match_number
      );
    }

    return map;
  }, [matches]);

  const groupStages =
    stages.filter(
      (stage) =>
        stage.stage_type === "group"
    );

  const firstKnockoutStage =
    stages.find(
      (stage) =>
        stage.stage_type === "knockout"
    ) ?? null;

  const allGroupStagesComplete =
    groupStages.length > 0 &&
    groupStages.every(
      (stage) =>
        stage.is_complete
    );

  const firstKnockoutMatches =
    firstKnockoutStage
      ? matchesByStage.get(
          firstKnockoutStage.id
        ) ?? []
      : [];

  const knockoutAlreadyGenerated =
    firstKnockoutMatches.length > 0;

  const is48TeamKnockout =
    firstKnockoutStage?.knockout_team_count === 48;

  const selectedCount = participants.length;
  const requiredCount = cup?.competing_teams ?? 0;
  const selectionComplete =
    selectedCount === requiredCount;
  const canEditParticipants =
    cup?.status === "draft";

  async function toggleParticipant(
    user: AdminUser
  ) {
    if (!cup) {
      return;
    }

    if (!canEditParticipants) {
      setErrorMessage(
        "Participants can only be changed while the Cup is in draft."
      );
      return;
    }

    const alreadySelected =
      participantUserIds.has(user.id);

    if (
      !alreadySelected &&
      selectedCount >= cup.competing_teams
    ) {
      setErrorMessage(
        `This Cup already has ${cup.competing_teams} participants.`
      );
      return;
    }

    setUpdatingUserId(user.id);
    setErrorMessage("");
    setSuccessMessage("");

    const { error } = alreadySelected
      ? await supabase.rpc(
          "admin_remove_cup_participant",
          {
            p_cup_id: cup.id,
            p_user_id: user.id,
          }
        )
      : await supabase.rpc(
          "admin_add_cup_participant",
          {
            p_cup_id: cup.id,
            p_user_id: user.id,
          }
        );

    if (error) {
      console.error(
        "Cup participant update error:",
        error
      );

      setErrorMessage(
        error.message ||
          "Unable to update Cup participant."
      );

      setUpdatingUserId(null);
      return;
    }

    setSuccessMessage(
      alreadySelected
        ? `${user.display_name || "Player"} removed from the Cup.`
        : `${user.display_name || "Player"} added to the Cup.`
    );

    setUpdatingUserId(null);
    await loadPage();
  }

  async function handleGenerateGroups() {
    if (!cup) {
      return;
    }

    if (!selectionComplete) {
      setErrorMessage(
        `Select exactly ${requiredCount} participants before generating groups.`
      );
      return;
    }

    const confirmed = window.confirm(
      `Generate ${cup.group_count} groups of ${cup.teams_per_group} teams for "${cup.name}"?`
    );

    if (!confirmed) {
      return;
    }

    setGeneratingGroups(true);
    setErrorMessage("");
    setSuccessMessage("");

    const {
      error: groupError,
    } = await supabase.rpc(
      "generate_cup_groups",
      {
        p_cup_id: cup.id,
      }
    );

    if (groupError) {
      console.error(
        "Generate Cup groups error:",
        groupError
      );

      setErrorMessage(
        groupError.message ||
          "Unable to generate Cup groups."
      );

      setGeneratingGroups(false);
      return;
    }

    const {
      error: fixtureError,
    } = await supabase.rpc(
      "generate_cup_group_fixtures",
      {
        p_cup_id: cup.id,
      }
    );

    if (fixtureError) {
      console.error(
        "Generate fixtures error:",
        fixtureError
      );

      setErrorMessage(
        `Groups were generated, but fixtures could not be generated: ${fixtureError.message}`
      );

      setGeneratingGroups(false);
      await loadPage();
      return;
    }

    setSuccessMessage(
      "Groups and group-stage fixtures generated successfully."
    );

    setGeneratingGroups(false);
    await loadPage();
  }

  async function handleStageRoundChange(
    stageId: string,
    roundId: string
  ) {
    if (!cup) {
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
        p_round_id:
          roundId || null,
      }
    );

    if (error) {
      console.error(
        "Cup stage round update error:",
        error
      );

      setErrorMessage(
        error.message ||
          "Unable to update Cup schedule."
      );

      setUpdatingStageId(null);
      return;
    }

    setStages((current) =>
      current.map((stage) =>
        stage.id === stageId
          ? {
              ...stage,
              round_id:
                roundId || null,
            }
          : stage
      )
    );

    setSuccessMessage(
      "Cup schedule updated."
    );

    setUpdatingStageId(null);
  }

  async function handlePublishCup() {
    if (!cup) {
      return;
    }

    if (cup.status !== "draft") {
      setErrorMessage(
        "Only a draft Cup can be published."
      );
      return;
    }

    if (!selectionComplete) {
      setErrorMessage(
        `Select exactly ${requiredCount} participants before publishing the Cup.`
      );
      return;
    }

    if (groups.length !== cup.group_count) {
      setErrorMessage(
        "Generate the complete group draw before publishing the Cup."
      );
      return;
    }

    const confirmed = window.confirm(
      `Publish "${cup.name}"?\n\nThis will change the Cup from Draft to Ready and lock participant selection.`
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
      console.error(
        "Publish Cup error:",
        error
      );

      setErrorMessage(
        error.message ||
          "Unable to publish the Cup."
      );

      setPublishingCup(false);
      return;
    }

    setSuccessMessage(
      `${cup.name} is now published and ready.`
    );

    setPublishingCup(false);
    await loadPage();
  }

  async function handleScoreGroupStage(
    stage: CupStage
  ) {
    if (!cup) {
      return;
    }

    if (stage.stage_type !== "group") {
      return;
    }

    if (!stage.round_id) {
      setErrorMessage(
        "Assign a Racecourse Fantasy round to this matchday before scoring."
      );
      return;
    }

    const assignedRound =
      rounds.find(
        (round) =>
          round.id === stage.round_id
      ) ?? null;

    const confirmed = window.confirm(
      `Score ${stage.stage_name}${
        assignedRound
          ? ` using ${roundLabel(assignedRound)}`
          : ""
      }?`
    );

    if (!confirmed) {
      return;
    }

    setScoringStageId(stage.id);
    setErrorMessage("");
    setSuccessMessage("");

    const { error } = await supabase.rpc(
      "admin_score_cup_group_stage",
      {
        p_cup_id: cup.id,
        p_stage_id: stage.id,
      }
    );

    if (error) {
      console.error(
        "Cup group scoring error:",
        error
      );

      setErrorMessage(
        error.message ||
          "Unable to score this Cup matchday."
      );

      setScoringStageId(null);
      return;
    }

    setSuccessMessage(
      `${stage.stage_name} scored successfully. Group standings have been recalculated.`
    );

    setScoringStageId(null);
    await loadPage();
  }

  async function handleGenerateKnockout() {
    if (!cup) {
      return;
    }

    if (!allGroupStagesComplete) {
      setErrorMessage(
        "All group-stage matchdays must be complete before generating the knockout bracket."
      );
      return;
    }

    if (!firstKnockoutStage) {
      setErrorMessage(
        "This Cup does not have a knockout stage."
      );
      return;
    }

    const confirmed = window.confirm(
      knockoutAlreadyGenerated
        ? `Regenerate the ${firstKnockoutStage.stage_name} bracket? Existing matches in that first knockout stage will be replaced.`
        : `Generate the ${firstKnockoutStage.stage_name} bracket from the final group standings?`
    );

    if (!confirmed) {
      return;
    }

    setGeneratingKnockout(true);
    setErrorMessage("");
    setSuccessMessage("");

    const { error } = await supabase.rpc(
      "admin_generate_cup_first_knockout",
      {
        p_cup_id: cup.id,
      }
    );

    if (error) {
      console.error(
        "Generate knockout bracket error:",
        error
      );

      setErrorMessage(
        error.message ||
          "Unable to generate the knockout bracket."
      );

      setGeneratingKnockout(false);
      return;
    }

    setSuccessMessage(
      `${firstKnockoutStage.stage_name} bracket generated successfully.`
    );

    setGeneratingKnockout(false);
    await loadPage();
  }

  async function handleScoreKnockoutStage(
    stage: CupStage
  ) {
    if (!cup) {
      return;
    }

    if (stage.stage_type !== "knockout") {
      return;
    }

    if (!stage.round_id) {
      setErrorMessage(
        "Assign a Racecourse Fantasy round to this knockout stage before scoring."
      );
      return;
    }

    const stageMatches =
      matchesByStage.get(stage.id) ?? [];

    if (stageMatches.length === 0) {
      setErrorMessage(
        "This knockout stage does not have any matches yet."
      );
      return;
    }

    const assignedRound =
      rounds.find(
        (round) =>
          round.id === stage.round_id
      ) ?? null;

    const confirmed = window.confirm(
      `Score ${stage.stage_name}${
        assignedRound
          ? ` using ${roundLabel(assignedRound)}`
          : ""
      }? Winners will automatically progress to the next stage where applicable.`
    );

    if (!confirmed) {
      return;
    }

    setScoringKnockoutStageId(stage.id);
    setErrorMessage("");
    setSuccessMessage("");

    const { error } = await supabase.rpc(
      "admin_score_and_progress_cup_knockout",
      {
        p_cup_id: cup.id,
        p_stage_id: stage.id,
      }
    );

    if (error) {
      console.error(
        "Cup knockout scoring error:",
        error
      );

      setErrorMessage(
        error.message ||
          "Unable to score this knockout stage."
      );

      setScoringKnockoutStageId(null);
      return;
    }

    setSuccessMessage(
      `${stage.stage_name} scored successfully.`
    );

    setScoringKnockoutStageId(null);
    await loadPage();
  }

  if (loading) {
    return (
      <main className="p-6 md:p-8">
        <div className="mx-auto max-w-7xl rounded-xl border bg-white p-10 text-center text-slate-500 shadow-sm">
          Loading Cup...
        </div>
      </main>
    );
  }

  if (!cup) {
    return (
      <main className="p-6 md:p-8">
        <div className="mx-auto max-w-5xl">
          <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-red-700">
            {errorMessage ||
              "Cup not found."}
          </div>

          <Link
            href="/admin/cups"
            className="mt-6 inline-block font-bold text-teal-700 hover:underline"
          >
            ← Back to Cups
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="p-6 md:p-8">
      <div className="mx-auto max-w-7xl">
        <Link
          href="/admin/cups"
          className="text-sm font-bold text-teal-700 hover:underline"
        >
          ← Back to Cups
        </Link>

        <div className="mt-4 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.16em] text-teal-700">
              Cup Management
            </p>

            <h1 className="mt-1 text-3xl font-bold text-slate-950">
              {cup.name}
            </h1>

            <p className="mt-2 text-slate-600">
              {season
                ? `${season.name} ${season.year}`
                : "Season"}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <span
              className={`rounded-full px-3 py-1.5 text-xs font-bold capitalize ${statusClasses(
                cup.status
              )}`}
            >
              {cup.status.replace("_", " ")}
            </span>

            {cup.status === "draft" && (
              <button
                type="button"
                onClick={() => void handlePublishCup()}
                disabled={
                  publishingCup ||
                  !selectionComplete ||
                  groups.length !== cup.group_count
                }
                className="rounded-lg bg-teal-600 px-4 py-2 text-sm font-bold text-white transition hover:bg-teal-700 disabled:cursor-not-allowed disabled:opacity-50"
                title={
                  !selectionComplete
                    ? `Select exactly ${requiredCount} participants first`
                    : groups.length !== cup.group_count
                      ? "Generate the complete group draw first"
                      : "Publish this Cup"
                }
              >
                {publishingCup
                  ? "Publishing..."
                  : "Publish Cup"}
              </button>
            )}
          </div>
        </div>

        {errorMessage && (
          <div className="mt-5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-700">
            {errorMessage}
          </div>
        )}

        {successMessage && (
          <div className="mt-5 rounded-xl border border-teal-200 bg-teal-50 p-4 text-sm font-medium text-teal-800">
            {successMessage}
          </div>
        )}

        <section className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-xl border bg-white p-5 shadow-sm">
            <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
              Competing Teams
            </p>

            <p className="mt-2 text-2xl font-bold text-slate-950">
              {cup.competing_teams}
            </p>
          </div>

          <div className="rounded-xl border bg-white p-5 shadow-sm">
            <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
              Groups
            </p>

            <p className="mt-2 text-2xl font-bold text-slate-950">
              {cup.group_count}
            </p>
          </div>

          <div className="rounded-xl border bg-white p-5 shadow-sm">
            <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
              Teams / Group
            </p>

            <p className="mt-2 text-2xl font-bold text-slate-950">
              {cup.teams_per_group}
            </p>
          </div>

          <div className="rounded-xl border bg-white p-5 shadow-sm">
            <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
              Entry Method
            </p>

            <p className="mt-2 text-lg font-bold capitalize text-slate-950">
              {cup.entry_method === "admin"
                ? "Admin selected"
                : "Automatic"}
            </p>
          </div>
        </section>

        <section className="mt-6 rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-col gap-4 border-b border-slate-200 p-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-xl font-bold text-slate-950">
                Participants
              </h2>

              <p className="mt-1 text-sm text-slate-500">
                {selectedCount} of {requiredCount} selected
              </p>
            </div>

            <div
              className={`rounded-full px-3 py-1.5 text-sm font-bold ${
                selectionComplete
                  ? "bg-teal-100 text-teal-800"
                  : "bg-amber-100 text-amber-800"
              }`}
            >
              {selectionComplete
                ? "Selection complete"
                : `${Math.max(
                    0,
                    requiredCount - selectedCount
                  )} remaining`}
            </div>
          </div>

          <div className="p-5">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />

              <input
                type="search"
                value={searchTerm}
                onChange={(event) =>
                  setSearchTerm(event.target.value)
                }
                placeholder="Search players..."
                className="w-full rounded-lg border border-slate-300 py-3 pl-10 pr-4 outline-none focus:border-teal-700 focus:ring-2 focus:ring-teal-100"
              />
            </div>

            {!canEditParticipants && (
              <p className="mt-3 text-sm font-semibold text-amber-700">
                Participant selection is locked because this Cup is no longer in draft.
              </p>
            )}

            <div className="mt-5 max-h-[420px] overflow-y-auto rounded-xl border border-slate-200">
              {filteredUsers.length === 0 ? (
                <div className="p-8 text-center text-slate-500">
                  No players found.
                </div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {filteredUsers.map((user) => {
                    const selected =
                      participantUserIds.has(user.id);

                    const participant =
                      participants.find(
                        (item) =>
                          item.user_id === user.id
                      );

                    return (
                      <div
                        key={user.id}
                        className="flex items-center justify-between gap-4 px-4 py-3 hover:bg-slate-50"
                      >
                        <div className="flex min-w-0 items-center gap-3">
                          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-600">
                            <UserRound className="h-4 w-4" />
                          </div>

                          <div className="min-w-0">
                            <p className="truncate font-semibold text-slate-950">
                              {user.display_name?.trim() ||
                                "Unnamed Player"}
                            </p>

                            {selected &&
                              participant?.seed_number && (
                                <p className="mt-0.5 text-xs font-semibold text-teal-700">
                                  Seed {participant.seed_number}
                                </p>
                              )}
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() =>
                            toggleParticipant(user)
                          }
                          disabled={
                            !canEditParticipants ||
                            updatingUserId === user.id ||
                            (!selected &&
                              selectedCount >=
                                requiredCount)
                          }
                          className={`shrink-0 rounded-lg px-3 py-2 text-sm font-bold transition disabled:cursor-not-allowed disabled:opacity-50 ${
                            selected
                              ? "border border-red-200 text-red-700 hover:bg-red-50"
                              : "bg-teal-600 text-white hover:bg-teal-700"
                          }`}
                        >
                          {updatingUserId === user.id
                            ? "Updating..."
                            : selected
                              ? "Remove"
                              : "Select"}
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          <div className="flex flex-col gap-3 border-t border-slate-200 bg-slate-50 p-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="font-bold text-slate-900">
                Group draw
              </p>

              <p className="mt-1 text-sm text-slate-500">
                Generates {cup.group_count} groups of{" "}
                {cup.teams_per_group} and creates all
                group-stage fixtures.
              </p>
            </div>

            <button
              type="button"
              onClick={handleGenerateGroups}
              disabled={
                !selectionComplete ||
                generatingGroups ||
                !canEditParticipants
              }
              className="rounded-lg bg-slate-900 px-5 py-3 font-bold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {generatingGroups
                ? "Generating..."
                : groups.length > 0
                  ? "Regenerate Groups"
                  : "Generate Groups"}
            </button>
          </div>
        </section>

        <section className="mt-6 rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 p-5">
            <h2 className="text-xl font-bold text-slate-950">
              Groups
            </h2>

            <p className="mt-1 text-sm text-slate-500">
              View the current Cup group draw and standings.
            </p>
          </div>

          {groups.length === 0 ? (
            <div className="p-8 text-center text-slate-500">
              Generate the groups after participant selection is complete.
            </div>
          ) : (
            <div className="grid gap-5 p-5 lg:grid-cols-2">
              {groups.map((group) => (
                <div
                  key={group.id}
                  className="overflow-hidden rounded-xl border border-slate-200"
                >
                  <div className="bg-slate-900 px-4 py-3 text-white">
                    <h3 className="font-bold">
                      {group.group_name}
                    </h3>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[540px]">
                      <thead className="bg-slate-50">
                        <tr className="text-left text-xs font-bold uppercase tracking-wide text-slate-500">
                          <th className="px-3 py-2">
                            Team
                          </th>
                          <th className="px-3 py-2 text-center">
                            P
                          </th>
                          <th className="px-3 py-2 text-center">
                            W
                          </th>
                          <th className="px-3 py-2 text-center">
                            D
                          </th>
                          <th className="px-3 py-2 text-center">
                            L
                          </th>
                          <th className="px-3 py-2 text-center">
                            FP
                          </th>
                          <th className="px-3 py-2 text-center">
                            Pts
                          </th>
                        </tr>
                      </thead>

                      <tbody className="divide-y divide-slate-100">
                        {group.members.map((member) => (
                          <tr
                            key={member.participant_id}
                          >
                            <td className="px-3 py-3">
                              <p className="font-semibold text-slate-900">
                                {member.display_name}
                              </p>

                              {member.seed_number && (
                                <p className="mt-0.5 text-xs text-slate-500">
                                  Seed {member.seed_number}
                                </p>
                              )}
                            </td>

                            <td className="px-3 py-3 text-center text-sm">
                              {member.played}
                            </td>
                            <td className="px-3 py-3 text-center text-sm">
                              {member.wins}
                            </td>
                            <td className="px-3 py-3 text-center text-sm">
                              {member.draws}
                            </td>
                            <td className="px-3 py-3 text-center text-sm">
                              {member.losses}
                            </td>
                            <td className="px-3 py-3 text-center text-sm">
                              {member.fantasy_points_for}
                            </td>
                            <td className="px-3 py-3 text-center font-bold text-slate-900">
                              {member.group_points}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-wide text-purple-700">
                Knockout Stage
              </p>

              <h2 className="mt-1 text-xl font-bold text-slate-950">
                Generate Knockout Bracket
              </h2>

              <p className="mt-2 max-w-3xl text-sm text-slate-500">
                {is48TeamKnockout
                  ? "The top 48 teams qualify from the group stage. Seeds 1–16 receive a bye to the Round of 32, while seeds 17–48 play 16 Preliminary Round matches. The 16 Preliminary Round winners then join the 16 bye teams in the Round of 32."
                  : "The bracket is generated from the final group standings using this Cup's qualification settings. The first knockout round avoids same-group rematches where possible and then follows a fixed bracket path."}
              </p>

              <div className="mt-3 flex flex-wrap gap-2">
                <span
                  className={`rounded-full px-2.5 py-1 text-xs font-bold ${
                    allGroupStagesComplete
                      ? "bg-teal-100 text-teal-800"
                      : "bg-amber-100 text-amber-800"
                  }`}
                >
                  {allGroupStagesComplete
                    ? "Group stage complete"
                    : "Group stage incomplete"}
                </span>

                {firstKnockoutStage && (
                  <span className="rounded-full bg-purple-100 px-2.5 py-1 text-xs font-bold text-purple-800">
                    {firstKnockoutStage.stage_name}
                  </span>
                )}

                {knockoutAlreadyGenerated && (
                  <span className="rounded-full bg-slate-900 px-2.5 py-1 text-xs font-bold text-white">
                    Bracket generated
                  </span>
                )}
              </div>
            </div>

            <button
              type="button"
              onClick={() =>
                void handleGenerateKnockout()
              }
              disabled={
                !allGroupStagesComplete ||
                !firstKnockoutStage ||
                generatingKnockout
              }
              className="shrink-0 rounded-lg bg-purple-600 px-5 py-3 font-bold text-white transition hover:bg-purple-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {generatingKnockout
                ? "Generating..."
                : knockoutAlreadyGenerated
                  ? "Regenerate Bracket"
                  : "Generate Bracket"}
            </button>
          </div>
        </section>

        <section className="mt-6 rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="flex items-center gap-3 border-b border-slate-200 p-5">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-teal-50 text-teal-700">
              <CalendarDays className="h-5 w-5" />
            </div>

            <div>
              <h2 className="text-xl font-bold text-slate-950">
                Cup Schedule
              </h2>

              <p className="mt-1 text-sm text-slate-500">
                Assign a Racecourse Fantasy round to each Cup stage.
              </p>
            </div>
          </div>

          <div className="divide-y divide-slate-100">
            {stages.map((stage) => (
              <div
                key={stage.id}
                className="grid gap-4 p-5 md:grid-cols-[1fr_320px]"
              >
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-bold text-slate-900">
                      {stage.stage_name}
                    </h3>

                    <span
                      className={`rounded-full px-2.5 py-1 text-xs font-bold ${
                        stage.stage_type === "group"
                          ? "bg-teal-100 text-teal-800"
                          : "bg-purple-100 text-purple-800"
                      }`}
                    >
                      {stage.stage_type === "group"
                        ? "Group"
                        : stage.knockout_team_count === 48 &&
                            stage.stage_name === "Preliminary Round"
                          ? "32 play · 16 byes"
                          : stage.knockout_team_count
                            ? `${stage.knockout_team_count} teams`
                            : "Knockout"}
                    </span>

                    {stage.is_complete && (
                      <span className="rounded-full bg-slate-900 px-2.5 py-1 text-xs font-bold text-white">
                        Complete
                      </span>
                    )}
                  </div>

                  <p className="mt-1 text-sm text-slate-500">
                    Stage {stage.sequence_number}
                  </p>

                  {stage.stage_type === "knockout" &&
                    stage.knockout_team_count === 48 &&
                    stage.stage_name === "Preliminary Round" && (
                      <p className="mt-1 text-xs font-semibold text-purple-700">
                        Seeds 1–16 have a bye. Seeds 17–48 play in this stage.
                      </p>
                    )}
                </div>

                <div>
                  <label
                    htmlFor={`stage-round-${stage.id}`}
                    className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-slate-500"
                  >
                    Fantasy Round
                  </label>

                  <div className="flex flex-col gap-2 sm:flex-row">
                    <select
                      id={`stage-round-${stage.id}`}
                      value={stage.round_id ?? ""}
                      onChange={(event) =>
                        void handleStageRoundChange(
                          stage.id,
                          event.target.value
                        )
                      }
                      disabled={
                        updatingStageId === stage.id ||
                        stage.is_complete
                      }
                      className="min-w-0 flex-1 rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-slate-900 outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-100 disabled:cursor-not-allowed disabled:bg-slate-100"
                    >
                      <option value="">
                        Not assigned
                      </option>

                      {rounds.map((round) => (
                        <option
                          key={round.id}
                          value={round.id}
                        >
                          {roundLabel(round)}
                        </option>
                      ))}
                    </select>

                    {stage.stage_type === "group" && (
                      <button
                        type="button"
                        onClick={() =>
                          void handleScoreGroupStage(stage)
                        }
                        disabled={
                          !stage.round_id ||
                          stage.is_complete ||
                          scoringStageId === stage.id
                        }
                        className="rounded-lg bg-teal-600 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-teal-700 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {scoringStageId === stage.id
                          ? "Scoring..."
                          : stage.is_complete
                            ? "Scored"
                            : "Score Matchday"}
                      </button>
                    )}

                    {stage.stage_type === "knockout" && (
                      <button
                        type="button"
                        onClick={() =>
                          void handleScoreKnockoutStage(stage)
                        }
                        disabled={
                          !stage.round_id ||
                          stage.is_complete ||
                          scoringKnockoutStageId === stage.id ||
                          (matchesByStage.get(stage.id) ?? []).length === 0
                        }
                        className="rounded-lg bg-purple-600 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-purple-700 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {scoringKnockoutStageId === stage.id
                          ? "Scoring..."
                          : stage.is_complete
                            ? "Scored"
                            : "Score Knockout"}
                      </button>
                    )}
                  </div>

                  {updatingStageId === stage.id && (
                    <p className="mt-1 text-xs font-semibold text-teal-700">
                      Saving...
                    </p>
                  )}

                  {stage.stage_type === "group" &&
                    !stage.round_id &&
                    !stage.is_complete && (
                      <p className="mt-1 text-xs text-slate-500">
                        Assign a fantasy round before scoring.
                      </p>
                    )}

                  {stage.stage_type === "knockout" &&
                    !stage.round_id &&
                    !stage.is_complete && (
                      <p className="mt-1 text-xs text-slate-500">
                        Assign a fantasy round before scoring this knockout stage.
                      </p>
                    )}
                </div>
              </div>
            ))}
          </div>
        </section>


        <section className="mt-6 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 p-5">
            <h2 className="text-xl font-bold text-slate-950">
              Fixtures
            </h2>

            <p className="mt-1 text-sm text-slate-500">
              Cup matches are grouped by stage and use the Racecourse Fantasy round assigned above.
            </p>
          </div>

          {matches.length === 0 ? (
            <div className="p-8 text-center text-slate-500">
              No Cup fixtures have been generated yet.
            </div>
          ) : (
            <div className="divide-y divide-slate-200">
              {stages.map((stage) => {
                const stageMatches =
                  matchesByStage.get(stage.id) ?? [];

                if (stageMatches.length === 0) {
                  return null;
                }

                const assignedRound =
                  rounds.find(
                    (round) =>
                      round.id === stage.round_id
                  ) ?? null;

                return (
                  <div
                    key={stage.id}
                    className="p-5"
                  >
                    <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <h3 className="text-lg font-bold text-slate-950">
                          {stage.stage_name}
                        </h3>

                        <p className="mt-1 text-sm text-slate-500">
                          {assignedRound
                            ? roundLabel(assignedRound)
                            : "Fantasy round not assigned"}
                        </p>
                      </div>

                      <span
                        className={`w-fit rounded-full px-2.5 py-1 text-xs font-bold ${
                          stage.stage_type === "group"
                            ? "bg-teal-100 text-teal-800"
                            : "bg-purple-100 text-purple-800"
                        }`}
                      >
                        {stageMatches.length}{" "}
                        {stageMatches.length === 1
                          ? "match"
                          : "matches"}
                      </span>
                    </div>

                    <div className="grid gap-3 lg:grid-cols-2">
                      {stageMatches.map((match) => {
                        const participant1 =
                          participantByParticipantId.get(
                            match.participant_1_id
                          );

                        const participant2 =
                          participantByParticipantId.get(
                            match.participant_2_id
                          );

                        const group =
                          match.group_id
                            ? groupById.get(match.group_id)
                            : null;

                        const participant1Won =
                          match.winner_participant_id ===
                          match.participant_1_id;

                        const participant2Won =
                          match.winner_participant_id ===
                          match.participant_2_id;

                        return (
                          <div
                            key={match.id}
                            className="rounded-xl border border-slate-200 bg-slate-50 p-4"
                          >
                            <div className="mb-3 flex items-center justify-between gap-3">
                              <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
                                {group
                                  ? `${group.group_name} · Match ${match.match_number}`
                                  : `Match ${match.match_number}`}
                              </p>

                              <span
                                className={`rounded-full px-2 py-1 text-[11px] font-bold capitalize ${
                                  match.match_status === "complete"
                                    ? "bg-teal-100 text-teal-800"
                                    : match.match_status === "cancelled"
                                      ? "bg-red-100 text-red-800"
                                      : "bg-slate-200 text-slate-700"
                                }`}
                              >
                                {match.match_status}
                              </span>
                            </div>

                            <div className="space-y-2">
                              <div
                                className={`flex items-center justify-between gap-3 rounded-lg px-3 py-2 ${
                                  participant1Won
                                    ? "bg-teal-50"
                                    : "bg-white"
                                }`}
                              >
                                <div className="min-w-0">
                                  <p
                                    className={`truncate font-semibold ${
                                      participant1Won
                                        ? "text-teal-900"
                                        : "text-slate-900"
                                    }`}
                                  >
                                    {participant1?.display_name ??
                                      "Unknown Player"}
                                  </p>

                                  {match.participant_1_seed && (
                                    <p className="text-xs text-slate-500">
                                      Seed {match.participant_1_seed}
                                    </p>
                                  )}
                                </div>

                                <span className="text-lg font-bold text-slate-950">
                                  {match.participant_1_score ??
                                    "—"}
                                </span>
                              </div>

                              <div
                                className={`flex items-center justify-between gap-3 rounded-lg px-3 py-2 ${
                                  participant2Won
                                    ? "bg-teal-50"
                                    : "bg-white"
                                }`}
                              >
                                <div className="min-w-0">
                                  <p
                                    className={`truncate font-semibold ${
                                      participant2Won
                                        ? "text-teal-900"
                                        : "text-slate-900"
                                    }`}
                                  >
                                    {participant2?.display_name ??
                                      "Unknown Player"}
                                  </p>

                                  {match.participant_2_seed && (
                                    <p className="text-xs text-slate-500">
                                      Seed {match.participant_2_seed}
                                    </p>
                                  )}
                                </div>

                                <span className="text-lg font-bold text-slate-950">
                                  {match.participant_2_score ??
                                    "—"}
                                </span>
                              </div>
                            </div>

                            {match.is_draw && (
                              <p className="mt-3 text-xs font-semibold text-amber-700">
                                {stage.stage_type === "group"
                                  ? "Draw"
                                  : "Scores tied — higher seed advances"}
                              </p>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}