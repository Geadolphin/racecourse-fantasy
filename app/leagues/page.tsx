"use client";

import { Copy, Crown, Pencil, Plus, Trash2, UserMinus, Users, LogOut, Trophy, ShieldCheck, CalendarDays, KeyRound, X, Swords } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";

import { supabase } from "@/lib/supabase";

import LeagueLeaderboardTable, {
    type LeagueLeaderboardRow,
} from "./LeagueLeaderboardTable";

type SeasonOption = {
    id: string;
    name: string;
    year: number;
    is_active: boolean;
};

type LeagueOption = {
    id: string;
    name: string;
    owner_user_id: string;
    join_code: string;
    member_count: number;
    created_at: string;
};

type SelectedLeague = {
    id: string;
    season_id: string;
    name: string;
    owner_user_id: string;
    owner_name: string;
    join_code: string;
    member_count: number;
    is_owner: boolean;
    is_read_only: boolean;
    created_at: string;
};

type LeagueMember = {
    user_id: string;
    display_name: string;
    joined_at: string;
    is_owner: boolean;
};

type RoundOption = {
    id: string;
    round_number: number;
    name: string | null;
    status: string;
};

type PrivateLeaguesData = {
    success: boolean;
    current_user_id: string;
    season_id: string | null;
    leagues: LeagueOption[];
    selected_league: SelectedLeague | null;
    members: LeagueMember[];
    rounds: RoundOption[];
    selected_round_id: string | null;
    round_leaderboard: LeagueLeaderboardRow[];
    season_leaderboard: LeagueLeaderboardRow[];
};

type LeagueCup = {
    id: string;
    league_id: string;
    season_id: string;
    name: string;
    status: string;
    competing_teams: number;
    group_count: number;
    teams_per_group: number;
    automatic_qualifiers_per_group: number;
    additional_qualifier_position: number | null;
    additional_qualifier_count: number;
    created_at: string;
};

type LeagueCupForm = {
    name: string;
    groupCount: number;
    automaticQualifiers: number;
};

type ModalType = "create" | "join" | "rename" | null;

export default function PrivateLeaguesPage() {
    const [loading, setLoading] = useState(true);
    const [changing, setChanging] = useState(false);
    const [saving, setSaving] = useState(false);

    const [seasons, setSeasons] = useState<SeasonOption[]>([]);
    const [selectedSeasonId, setSelectedSeasonId] = useState("");

    const [selectedLeagueId, setSelectedLeagueId] = useState("");
    const [selectedRoundId, setSelectedRoundId] = useState("");

    const [data, setData] = useState<PrivateLeaguesData | null>(null);

    const [tab, setTab] = useState<"round" | "season">("round");

    const [modal, setModal] = useState<ModalType>(null);
    const [leagueDetailsOpen, setLeagueDetailsOpen] = useState(false);
    const [formValue, setFormValue] = useState("");

    const [error, setError] = useState("");
    const [successMessage, setSuccessMessage] = useState("");

    const [leagueCups, setLeagueCups] = useState<LeagueCup[]>([]);
    const [leagueCupsLoading, setLeagueCupsLoading] = useState(false);
    const [leagueCupModalOpen, setLeagueCupModalOpen] = useState(false);
    const [leagueCupSaving, setLeagueCupSaving] = useState(false);
    const [leagueCupForm, setLeagueCupForm] = useState<LeagueCupForm>({
        name: "",
        groupCount: 1,
        automaticQualifiers: 2,
    });

    const loadLeagueData = useCallback(
        async ({
            seasonId,
            leagueId,
            roundId,
            initial = false,
        }: {
            seasonId?: string;
            leagueId?: string;
            roundId?: string;
            initial?: boolean;
        } = {}) => {
            if (initial) {
                setLoading(true);
            } else {
                setChanging(true);
            }

            setError("");

            const { data: leagueDataRaw, error: leagueError } =
                await supabase.rpc("get_private_leagues_data", {
                    p_season_id: seasonId || null,
                    p_league_id: leagueId || null,
                    p_round_id: roundId || null,
                });

            if (leagueError) {
                console.error("Private leagues error:", leagueError);

                setError(
                    leagueError.message ||
                    "Unable to load private leagues."
                );

                if (initial) {
                    setData(null);
                }

                setLoading(false);
                setChanging(false);
                return null;
            }

            let loadedData =
                leagueDataRaw as unknown as PrivateLeaguesData;

            /*
             * When no round was explicitly requested, use the current
             * open round instead of whatever default round the RPC returns.
             */
            if (!roundId && loadedData.rounds.length > 0) {
                const currentRound =
                    loadedData.rounds.find(
                        (round) => round.status === "open"
                    ) ?? null;

                if (
                    currentRound &&
                    loadedData.selected_round_id !== currentRound.id
                ) {
                    const {
                        data: currentRoundDataRaw,
                        error: currentRoundError,
                    } = await supabase.rpc(
                        "get_private_leagues_data",
                        {
                            p_season_id:
                                loadedData.season_id ??
                                seasonId ??
                                null,
                            p_league_id:
                                loadedData.selected_league?.id ??
                                leagueId ??
                                null,
                            p_round_id: currentRound.id,
                        }
                    );

                    if (currentRoundError) {
                        console.error(
                            "Private leagues current round error:",
                            currentRoundError
                        );
                    } else if (currentRoundDataRaw) {
                        loadedData =
                            currentRoundDataRaw as unknown as PrivateLeaguesData;
                    }
                }
            }

            if (
                loadedData.season_id &&
                loadedData.selected_league?.id
            ) {
                const [
                    {
                        data: rankChangesRaw,
                        error: rankChangesError,
                    },
                    {
                        data: overallRanksRaw,
                        error: overallRanksError,
                    },
                ] = await Promise.all([
                    supabase.rpc(
                        "get_private_league_rank_changes",
                        {
                            p_league_id:
                                loadedData.selected_league.id,
                            p_season_id:
                                loadedData.season_id,
                        }
                    ),
                    supabase.rpc(
                        "get_private_league_overall_ranks",
                        {
                            p_league_id:
                                loadedData.selected_league.id,
                            p_season_id:
                                loadedData.season_id,
                            p_round_id:
                                loadedData.selected_round_id,
                        }
                    ),
                ]);

                if (rankChangesError) {
                    console.error(
                        "Private league rank changes error:",
                        rankChangesError
                    );
                }

                if (overallRanksError) {
                    console.error(
                        "Private league overall ranks error:",
                        overallRanksError
                    );
                }

                const rankChangeMap = new Map<
                    string,
                    number | null
                >(
                    (
                        (rankChangesRaw ?? []) as {
                            user_id: string;
                            rank_change: number | null;
                        }[]
                    ).map((row) => [
                        row.user_id,
                        row.rank_change,
                    ])
                );

                const roundOverallRankMap = new Map<
                    string,
                    number | null
                >(
                    (
                        (overallRanksRaw ?? []) as {
                            user_id: string;
                            round_overall_rank: number | null;
                            season_overall_rank: number | null;
                        }[]
                    ).map((row) => [
                        row.user_id,
                        row.round_overall_rank,
                    ])
                );

                const seasonOverallRankMap = new Map<
                    string,
                    number | null
                >(
                    (
                        (overallRanksRaw ?? []) as {
                            user_id: string;
                            round_overall_rank: number | null;
                            season_overall_rank: number | null;
                        }[]
                    ).map((row) => [
                        row.user_id,
                        row.season_overall_rank,
                    ])
                );

                loadedData.round_leaderboard =
                    loadedData.round_leaderboard.map(
                        (row) => ({
                            ...row,
                            overall_rank:
                                roundOverallRankMap.get(
                                    row.user_id
                                ) ?? null,
                        })
                    );

                loadedData.season_leaderboard =
                    loadedData.season_leaderboard.map(
                        (row) => ({
                            ...row,
                            overall_rank:
                                seasonOverallRankMap.get(
                                    row.user_id
                                ) ?? null,
                            rank_change:
                                rankChangeMap.get(
                                    row.user_id
                                ) ?? null,
                        })
                    );
            }

            setData(loadedData);

            setSelectedSeasonId(
                loadedData.season_id ?? seasonId ?? ""
            );

            setSelectedLeagueId(
                loadedData.selected_league?.id ?? ""
            );

            setSelectedRoundId(
                loadedData.selected_round_id ?? ""
            );

            setLoading(false);
            setChanging(false);

            return loadedData;
        },
        []
    );

    useEffect(() => {
        let active = true;

        async function loadPage() {
            setLoading(true);
            setError("");

            const { data: seasonsData, error: seasonsError } =
                await supabase
                    .from("seasons")
                    .select("id, name, year, is_active")
                    .order("year", { ascending: false });

            if (!active) {
                return;
            }

            if (seasonsError) {
                console.error(
                    "Private leagues seasons error:",
                    seasonsError
                );

                setError(
                    seasonsError.message ||
                    "Unable to load seasons."
                );

                setLoading(false);
                return;
            }

            const loadedSeasons =
                (seasonsData ?? []) as SeasonOption[];

            setSeasons(loadedSeasons);

            const preferredSeason =
                loadedSeasons.find(
                    (season) => season.is_active
                ) ?? loadedSeasons[0];

            if (!preferredSeason) {
                setLoading(false);
                return;
            }

            await loadLeagueData({
                seasonId: preferredSeason.id,
                initial: true,
            });
        }

        void loadPage();

        return () => {
            active = false;
        };
    }, [loadLeagueData]);

    const selectedSeason = useMemo(() => {
        return seasons.find(
            (season) => season.id === selectedSeasonId
        );
    }, [seasons, selectedSeasonId]);

    const selectedRound = useMemo(() => {
        return data?.rounds.find(
            (round) => round.id === selectedRoundId
        );
    }, [data, selectedRoundId]);

    const leaderboardRows =
        tab === "round"
            ? data?.round_leaderboard ?? []
            : data?.season_leaderboard ?? [];

    const loadLeagueCups = useCallback(async (leagueId: string) => {
        if (!leagueId) {
            setLeagueCups([]);
            return;
        }

        setLeagueCupsLoading(true);

        const { data: cupsRaw, error: cupsError } = await supabase.rpc(
            "get_league_cups",
            { p_league_id: leagueId }
        );

        if (cupsError) {
            console.error("League Cups error:", cupsError);
            setLeagueCups([]);
            setLeagueCupsLoading(false);
            return;
        }

        const result = cupsRaw as {
            success: boolean;
            league_id: string;
            cups: LeagueCup[];
        };

        setLeagueCups(result?.cups ?? []);
        setLeagueCupsLoading(false);
    }, []);

    useEffect(() => {
        const leagueId = data?.selected_league?.id ?? "";

        if (!leagueId) {
            setLeagueCups([]);
            return;
        }

        void loadLeagueCups(leagueId);
    }, [data?.selected_league?.id, loadLeagueCups]);

    async function changeSeason(seasonId: string) {
        setSelectedSeasonId(seasonId);
        setSelectedLeagueId("");
        setSelectedRoundId("");
        setSuccessMessage("");

        await loadLeagueData({
            seasonId,
        });
    }

    async function changeLeague(leagueId: string) {
        setSelectedLeagueId(leagueId);
        setSuccessMessage("");

        await loadLeagueData({
            seasonId: selectedSeasonId,
            leagueId,
        });
    }

    async function changeRound(roundId: string) {
        setSelectedRoundId(roundId);
        setSuccessMessage("");

        await loadLeagueData({
            seasonId: selectedSeasonId,
            leagueId: selectedLeagueId,
            roundId,
        });
    }

    function openModal(type: Exclude<ModalType, null>) {
        setModal(type);
        setFormValue(
            type === "rename" ? data?.selected_league?.name ?? "" : ""
        );
        setError("");
        setSuccessMessage("");
    }

    function closeModal() {
        if (saving) {
            return;
        }

        setModal(null);
        setFormValue("");
    }

    async function submitModal() {
        const value = formValue.trim();

        if (modal === "rename") {
            await renameLeague();
            return;
        }

        if (!value) {
            setError(
                modal === "join"
                    ? "Enter a join code."
                    : "Enter a league name."
            );
            return;
        }

        setSaving(true);
        setError("");
        setSuccessMessage("");

        if (modal === "create") {
            const { data: createdRaw, error: createError } =
                await supabase.rpc("create_private_league", {
                    p_season_id: selectedSeasonId,
                    p_name: value,
                });

            if (createError) {
                setError(createError.message);
                setSaving(false);
                return;
            }

            const created = createdRaw as {
                league_id: string;
                season_id: string;
            };

            setModal(null);
            setFormValue("");

            await loadLeagueData({
                seasonId: created.season_id,
                leagueId: created.league_id,
            });

            setSuccessMessage("Private league created.");
        }

        if (modal === "join") {
            const { data: joinedRaw, error: joinError } =
                await supabase.rpc("join_private_league", {
                    p_join_code: value,
                });

            if (joinError) {
                setError(joinError.message);
                setSaving(false);
                return;
            }

            const joined = joinedRaw as {
                league_id: string;
                season_id: string;
            };

            setModal(null);
            setFormValue("");

            await loadLeagueData({
                seasonId: joined.season_id,
                leagueId: joined.league_id,
            });

            setSuccessMessage("League joined successfully.");
        }

        setSaving(false);
    }

    async function refreshCurrentLeague(message?: string) {
        if (!selectedSeasonId) return;

        await loadLeagueData({
            seasonId: selectedSeasonId,
            leagueId: selectedLeagueId || undefined,
            roundId: selectedRoundId || undefined,
        });

        if (message) setSuccessMessage(message);
    }

    async function renameLeague() {
        const league = data?.selected_league;
        const name = formValue.trim();
        if (!league || !name) return;

        setSaving(true);
        setError("");

        const { error: renameError } = await supabase.rpc(
            "rename_private_league",
            { p_league_id: league.id, p_name: name }
        );

        if (renameError) {
            setError(renameError.message);
            setSaving(false);
            return;
        }

        setModal(null);
        setFormValue("");
        await refreshCurrentLeague("League renamed.");
        setSaving(false);
    }

    async function removeMember(member: LeagueMember) {
        const league = data?.selected_league;
        if (!league) return;

        if (!window.confirm(`Remove ${member.display_name} from this league?`)) {
            return;
        }

        setSaving(true);
        setError("");

        const { error: removeError } = await supabase.rpc(
            "remove_private_league_member",
            { p_league_id: league.id, p_user_id: member.user_id }
        );

        if (removeError) {
            setError(removeError.message);
            setSaving(false);
            return;
        }

        await refreshCurrentLeague(`${member.display_name} was removed from the league.`);
        setSaving(false);
    }

    async function leaveLeague() {
        const league = data?.selected_league;
        if (!league) return;

        if (!window.confirm(`Leave ${league.name}?`)) return;

        setSaving(true);
        setError("");

        const { error: leaveError } = await supabase.rpc(
            "leave_private_league",
            { p_league_id: league.id }
        );

        if (leaveError) {
            setError(leaveError.message);
            setSaving(false);
            return;
        }

        await loadLeagueData({ seasonId: selectedSeasonId });
        setLeagueDetailsOpen(false);
        setSuccessMessage("You have left the league.");
        setSaving(false);
    }

    async function deleteLeague() {
        const league = data?.selected_league;
        if (!league) return;

        if (!window.confirm(`Delete "${league.name}"? This will remove the league for every member.`)) {
            return;
        }

        setSaving(true);
        setError("");

        const { error: deleteError } = await supabase.rpc(
            "delete_private_league",
            { p_league_id: league.id }
        );

        if (deleteError) {
            setError(deleteError.message);
            setSaving(false);
            return;
        }

        await loadLeagueData({ seasonId: selectedSeasonId });
        setLeagueDetailsOpen(false);
        setSuccessMessage("League deleted.");
        setSaving(false);
    }

    async function copyJoinCode() {
        const code = data?.selected_league?.join_code;

        if (!code) {
            return;
        }

        try {
            await navigator.clipboard.writeText(code);
            setSuccessMessage("Join code copied.");
            setError("");
        } catch {
            setError("Unable to copy the join code.");
        }
    }

    function isPowerOfTwo(value: number) {
        return value >= 2 && (value & (value - 1)) === 0;
    }

    function getValidGroupCounts(memberCount: number) {
        if (memberCount < 2) return [1];

        const divisors: number[] = [];

        for (let groups = 1; groups <= memberCount; groups += 1) {
            if (memberCount % groups === 0) {
                divisors.push(groups);
            }
        }

        return divisors;
    }

    function getValidQualifierCounts(groupCount: number, teamsPerGroup: number) {
        const values: number[] = [];

        for (let qualifiers = 1; qualifiers <= teamsPerGroup; qualifiers += 1) {
            const knockoutTeams = groupCount * qualifiers;

            if (knockoutTeams === 48 || isPowerOfTwo(knockoutTeams)) {
                values.push(qualifiers);
            }
        }

        return values;
    }

    function openLeagueCupModal() {
        const league = data?.selected_league;
        if (!league || !league.is_owner) return;

        const groupCounts = getValidGroupCounts(league.member_count);
        const preferredGroupCount =
            groupCounts.find((count) => count >= 2 && league.member_count / count >= 3) ??
            groupCounts.find((count) => count >= 2) ??
            groupCounts[0] ??
            1;

        const teamsPerGroup = Math.max(
            1,
            Math.floor(league.member_count / preferredGroupCount)
        );

        const qualifierCounts = getValidQualifierCounts(
            preferredGroupCount,
            teamsPerGroup
        );

        setLeagueCupForm({
            name: `${league.name} Cup`,
            groupCount: preferredGroupCount,
            automaticQualifiers: qualifierCounts[0] ?? 1,
        });

        setError("");
        setSuccessMessage("");
        setLeagueCupModalOpen(true);
    }

    async function createLeagueCup() {
        const league = data?.selected_league;
        if (!league || !league.is_owner) return;

        const name = leagueCupForm.name.trim();

        if (!name) {
            setError("Enter a League Cup name.");
            return;
        }

        if (league.member_count % leagueCupForm.groupCount !== 0) {
            setError("The selected group format does not fit the league member count.");
            return;
        }

        const teamsPerGroup =
            league.member_count / leagueCupForm.groupCount;

        const knockoutTeams =
            leagueCupForm.groupCount *
            leagueCupForm.automaticQualifiers;

        if (knockoutTeams !== 48 && !isPowerOfTwo(knockoutTeams)) {
            setError("The selected qualifiers do not produce a valid knockout field.");
            return;
        }

        setLeagueCupSaving(true);
        setError("");
        setSuccessMessage("");

        const { data: createdRaw, error: createError } = await supabase.rpc(
            "create_league_cup",
            {
                p_league_id: league.id,
                p_name: name,
                p_group_count: leagueCupForm.groupCount,
                p_teams_per_group: teamsPerGroup,
                p_automatic_qualifiers_per_group:
                    leagueCupForm.automaticQualifiers,
                p_additional_qualifier_position: null,
                p_additional_qualifier_count: 0,
            }
        );

        if (createError) {
            setError(createError.message);
            setLeagueCupSaving(false);
            return;
        }

        const created = createdRaw as {
            success: boolean;
            cup_id: string;
        };

        await loadLeagueCups(league.id);

        setLeagueCupModalOpen(false);
        setLeagueCupSaving(false);
        setSuccessMessage(
            created?.cup_id
                ? "League Cup created successfully."
                : "League Cup created."
        );
    }

    const selectedLeague = data?.selected_league ?? null;
    const leagueMembers = data?.members ?? [];
    const leagueRounds = useMemo(
        () =>
            [...(data?.rounds ?? [])].sort(
                (a, b) => a.round_number - b.round_number
            ),
        [data]
    );
    const currentUserId = data?.current_user_id ?? "";

    const leagueCupGroupCounts = selectedLeague
        ? getValidGroupCounts(selectedLeague.member_count)
        : [1];

    const leagueCupTeamsPerGroup =
        selectedLeague && leagueCupForm.groupCount > 0
            ? selectedLeague.member_count / leagueCupForm.groupCount
            : 0;

    const leagueCupQualifierCounts =
        Number.isInteger(leagueCupTeamsPerGroup) && leagueCupTeamsPerGroup > 0
            ? getValidQualifierCounts(
                leagueCupForm.groupCount,
                leagueCupTeamsPerGroup
            )
            : [];

    const leagueCupKnockoutTeams =
        leagueCupForm.groupCount *
        leagueCupForm.automaticQualifiers;

    if (loading) {
        return (
            <main className="min-h-screen bg-slate-100 p-8">
                <div className="mx-auto max-w-6xl rounded-xl bg-white p-10 text-center">
                    Loading private leagues...
                </div>
            </main>
        );
    }

    return (
        <main className="min-h-screen bg-slate-100">
            <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 md:py-10">
                <header className="mb-7 overflow-hidden rounded-2xl border border-slate-800 bg-slate-950 text-white shadow-lg">
                    <div className="border-b border-slate-800 px-6 py-4 md:px-8">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                            <div className="flex items-center gap-2 text-teal-300">
                                <Trophy className="h-5 w-5" />
                                <p className="text-xs font-black uppercase tracking-[0.22em]">
                                    Racecourse Fantasy
                                </p>
                            </div>

                            <div className="flex flex-wrap gap-2">
                                <button
                                    type="button"
                                    onClick={() => openModal("join")}
                                    className="rounded-lg border border-slate-700 bg-slate-900 px-4 py-2 text-sm font-black text-white transition hover:border-teal-400 hover:text-teal-300"
                                >
                                    Join League
                                </button>

                                <button
                                    type="button"
                                    onClick={() => openModal("create")}
                                    disabled={!selectedSeasonId}
                                    className="inline-flex items-center gap-2 rounded-lg bg-teal-500 px-4 py-2 text-sm font-black text-slate-950 transition hover:bg-teal-400 disabled:cursor-not-allowed disabled:opacity-50"
                                >
                                    <Plus className="h-4 w-4" />
                                    Create League
                                </button>
                            </div>
                        </div>
                    </div>

                    <div className="grid lg:grid-cols-[1fr_320px]">
                        <div className="p-6 md:p-8">
                            <p className="text-xs font-black uppercase tracking-[0.18em] text-teal-300">
                                Private Competition
                            </p>

                            <h1 className="mt-2 text-4xl font-black tracking-tight md:text-5xl">
                                Private Leagues
                            </h1>

                            <p className="mt-3 max-w-2xl text-base leading-7 text-slate-300">
                                Compete against friends using your normal Racecourse Fantasy team and scores.
                            </p>
                        </div>

                        <div className="grid grid-cols-2 gap-px border-t border-slate-800 bg-slate-800 lg:border-l lg:border-t-0">
                            <div className="bg-slate-900 p-5">
                                <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">
                                    Season
                                </p>
                                <p className="mt-2 text-lg font-black text-white">
                                    {selectedSeason ? `${selectedSeason.name} ${selectedSeason.year}` : "—"}
                                </p>
                            </div>

                            <div className="bg-slate-900 p-5">
                                <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">
                                    Your Leagues
                                </p>
                                <p className="mt-2 text-2xl font-black text-teal-300">
                                    {(data?.leagues ?? []).length}
                                </p>
                            </div>
                        </div>
                    </div>
                </header>

                {error && (
                    <div className="mb-5 rounded-lg border border-red-300 bg-red-50 p-4 text-red-700">
                        {error}
                    </div>
                )}

                {successMessage && (
                    <div className="mb-5 rounded-lg border border-teal-300 bg-teal-50 p-4 text-teal-800">
                        {successMessage}
                    </div>
                )}

                <section className="mb-7 overflow-hidden rounded-2xl border border-slate-300 bg-white shadow-sm">
                    <div className="border-b border-slate-300 bg-slate-950 px-5 py-3 text-white">
                        <p className="text-xs font-black uppercase tracking-[0.18em] text-teal-300">
                            Competition Selector
                        </p>
                    </div>

                    <div className="grid gap-4 p-5 sm:grid-cols-2">
                        <div>
                            <label
                                htmlFor="league-season"
                                className="block text-sm font-bold text-slate-800"
                            >
                                Season
                            </label>

                            <select
                                id="league-season"
                                value={selectedSeasonId}
                                onChange={(event) =>
                                    void changeSeason(event.target.value)
                                }
                                disabled={
                                    changing || seasons.length === 0
                                }
                                className="mt-2 w-full rounded-lg border border-slate-300 bg-white px-4 py-3 text-slate-900 outline-none focus:border-teal-700 focus:ring-2 focus:ring-teal-100 disabled:cursor-not-allowed disabled:bg-slate-100"
                            >
                                {seasons.length === 0 ? (
                                    <option value="">
                                        No seasons available
                                    </option>
                                ) : (
                                    seasons.map((season) => (
                                        <option
                                            key={season.id}
                                            value={season.id}
                                        >
                                            {season.name} {season.year}
                                            {season.is_active
                                                ? " — Active"
                                                : ""}
                                        </option>
                                    ))
                                )}
                            </select>
                        </div>

                        <div>
                            <label
                                htmlFor="league-select"
                                className="block text-sm font-bold text-slate-800"
                            >
                                League
                            </label>

                            <select
                                id="league-select"
                                value={selectedLeagueId}
                                onChange={(event) =>
                                    void changeLeague(event.target.value)
                                }
                                disabled={
                                    changing ||
                                    (data?.leagues ?? []).length === 0
                                }
                                className="mt-2 w-full rounded-lg border border-slate-300 bg-white px-4 py-3 text-slate-900 outline-none focus:border-teal-700 focus:ring-2 focus:ring-teal-100 disabled:cursor-not-allowed disabled:bg-slate-100"
                            >
                                {(data?.leagues ?? []).length === 0 ? (
                                    <option value="">
                                        No leagues for this season
                                    </option>
                                ) : (
                                    (data?.leagues ?? []).map(
                                        (league) => (
                                            <option
                                                key={league.id}
                                                value={league.id}
                                            >
                                                {league.name} —{" "}
                                                {league.member_count}/24
                                            </option>
                                        )
                                    )
                                )}
                            </select>
                        </div>
                    </div>
                </section>

                {changing && (
                    <div className="mb-6 rounded-xl border bg-white p-8 text-center text-slate-500 shadow-sm">
                        Updating league...
                    </div>
                )}

                {!changing && !data?.selected_league && (
                    <div className="rounded-xl border bg-white p-10 text-center shadow-sm">
                        <Users className="mx-auto h-10 w-10 text-teal-700" />

                        <h2 className="mt-4 text-2xl font-bold text-slate-900">
                            No private leagues yet
                        </h2>

                        <p className="mx-auto mt-3 max-w-xl text-slate-500">
                            Create a league for this season or enter a
                            friend's join code. You can belong to up to
                            10 private leagues per season.
                        </p>

                        <div className="mt-6 flex flex-wrap justify-center gap-3">
                            <button
                                type="button"
                                onClick={() => openModal("join")}
                                className="rounded-lg border bg-white px-5 py-3 font-semibold text-slate-800 hover:bg-slate-50"
                            >
                                Join League
                            </button>

                            <button
                                type="button"
                                onClick={() => openModal("create")}
                                className="rounded-lg bg-teal-700 px-5 py-3 font-semibold text-white hover:bg-teal-800"
                            >
                                Create League
                            </button>
                        </div>
                    </div>
                )}

                {!changing && selectedLeague && (
                    <>
                        <section className="mb-6 overflow-hidden rounded-2xl border border-slate-300 bg-white shadow-sm">
                            <div className="border-b border-slate-800 bg-slate-950 px-5 py-4 text-white">
                                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                                    <div>
                                        <p className="text-xs font-black uppercase tracking-[0.18em] text-teal-300">
                                            Selected League
                                        </p>

                                        <h2 className="mt-1 text-2xl font-black">
                                            {selectedLeague.name}
                                        </h2>

                                        <p className="mt-1 text-sm text-slate-400">
                                            {selectedSeason
                                                ? `${selectedSeason.name} ${selectedSeason.year}`
                                                : "Private league"}
                                        </p>
                                    </div>

                                    <div className="flex items-center gap-2">
                                        <div className="rounded-lg border border-slate-700 bg-slate-900 px-4 py-2">
                                            <div className="flex items-center gap-2">
                                                <KeyRound className="h-4 w-4 text-teal-300" />
                                                <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">
                                                    Join code
                                                </p>
                                            </div>

                                            <p className="mt-1 font-mono text-lg font-black tracking-wider text-white">
                                                {selectedLeague.join_code}
                                            </p>
                                        </div>

                                        <button
                                            type="button"
                                            onClick={() => void copyJoinCode()}
                                            className="inline-flex h-11 w-11 items-center justify-center rounded-lg border border-slate-700 bg-slate-900 text-slate-300 transition hover:border-teal-400 hover:text-teal-300"
                                            title="Copy join code"
                                        >
                                            <Copy className="h-4 w-4" />
                                        </button>

                                        <button
                                            type="button"
                                            onClick={() => setLeagueDetailsOpen(true)}
                                            className="inline-flex h-11 items-center justify-center rounded-lg border border-slate-700 bg-slate-900 px-3 text-sm font-black text-slate-200 transition hover:border-teal-400 hover:text-teal-300"
                                        >
                                            League Details
                                        </button>
                                    </div>
                                </div>

                                <div className="mt-4 flex flex-wrap items-center gap-2">
                                    <div className="inline-flex overflow-hidden rounded-lg border border-slate-700 bg-slate-900">
                                        <button
                                            type="button"
                                            onClick={() => setTab("round")}
                                            className={`px-4 py-2 text-sm font-black transition ${
                                                tab === "round"
                                                    ? "bg-teal-500 text-slate-950"
                                                    : "text-slate-300 hover:bg-slate-800 hover:text-white"
                                            }`}
                                        >
                                            Round
                                        </button>

                                        <button
                                            type="button"
                                            onClick={() => setTab("season")}
                                            className={`border-l border-slate-700 px-4 py-2 text-sm font-black transition ${
                                                tab === "season"
                                                    ? "bg-teal-500 text-slate-950"
                                                    : "text-slate-300 hover:bg-slate-800 hover:text-white"
                                            }`}
                                        >
                                            Season
                                        </button>
                                    </div>

                                    {tab === "round" && (
                                        <select
                                            id="league-round"
                                            aria-label="Select round"
                                            value={selectedRoundId}
                                            onChange={(event) =>
                                                void changeRound(event.target.value)
                                            }
                                            disabled={
                                                changing ||
                                                leagueRounds.length === 0
                                            }
                                            className="h-10 min-w-40 rounded-lg border border-slate-700 bg-slate-900 px-3 text-sm font-bold text-white outline-none transition focus:border-teal-400 focus:ring-2 focus:ring-teal-400/20 disabled:cursor-not-allowed disabled:opacity-60"
                                        >
                                            {leagueRounds.map((round) => (
                                                <option
                                                    key={round.id}
                                                    value={round.id}
                                                    className="bg-white text-slate-900"
                                                >
                                                    Round {round.round_number}
                                                    {round.name
                                                        ? ` — ${round.name}`
                                                        : ""}
                                                </option>
                                            ))}
                                        </select>
                                    )}
                                </div>
                            </div>

                        </section>

                        <div className="mb-6">
                            <LeagueLeaderboardTable
                                type={tab}
                                rows={leaderboardRows}
                                currentUserId={currentUserId}
                            />
                        </div>

                        <section className="mb-6 overflow-hidden rounded-2xl border border-slate-300 bg-white shadow-sm">
                            <div className="flex flex-col gap-4 border-b border-slate-800 bg-slate-950 px-5 py-4 text-white sm:flex-row sm:items-center sm:justify-between">
                                <div>
                                    <div className="flex items-center gap-2">
                                        <Swords className="h-5 w-5 text-teal-300" />
                                        <p className="text-xs font-black uppercase tracking-[0.18em] text-teal-300">
                                            League Cup
                                        </p>
                                    </div>
                                    <h2 className="mt-1 text-xl font-black">
                                        {selectedLeague.name} Cups
                                    </h2>
                                    <p className="mt-1 text-sm text-slate-400">
                                        Cup tournaments contested only by members of this league.
                                    </p>
                                </div>

                                {selectedLeague.is_owner &&
                                    !selectedLeague.is_read_only && (
                                        <button
                                            type="button"
                                            onClick={openLeagueCupModal}
                                            className="inline-flex items-center justify-center gap-2 rounded-lg bg-teal-500 px-4 py-2.5 text-sm font-black text-slate-950 transition hover:bg-teal-400"
                                        >
                                            <Plus className="h-4 w-4" />
                                            Create League Cup
                                        </button>
                                    )}
                            </div>

                            {leagueCupsLoading ? (
                                <div className="p-8 text-center text-sm text-slate-500">
                                    Loading League Cups...
                                </div>
                            ) : leagueCups.length === 0 ? (
                                <div className="p-8 text-center">
                                    <Trophy className="mx-auto h-9 w-9 text-slate-300" />
                                    <h3 className="mt-3 font-black text-slate-900">
                                        No League Cups yet
                                    </h3>
                                    <p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-slate-500">
                                        {selectedLeague.is_owner
                                            ? "Create a Cup tournament using the current members of this league."
                                            : "The league administrator has not created a League Cup yet."}
                                    </p>
                                </div>
                            ) : (
                                <div className="divide-y divide-slate-200">
                                    {leagueCups.map((cup) => (
                                        <div
                                            key={cup.id}
                                            className="flex flex-col gap-4 px-5 py-4 sm:flex-row sm:items-center sm:justify-between"
                                        >
                                            <div className="min-w-0">
                                                <div className="flex flex-wrap items-center gap-2">
                                                    <h3 className="truncate text-lg font-black text-slate-950">
                                                        {cup.name}
                                                    </h3>
                                                    <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-black uppercase tracking-wide text-slate-600">
                                                        {cup.status}
                                                    </span>
                                                </div>

                                                <p className="mt-1 text-sm text-slate-500">
                                                    {cup.competing_teams} teams · {cup.group_count} {cup.group_count === 1 ? "group" : "groups"} · {cup.teams_per_group} per group
                                                </p>
                                            </div>

                                            <Link
                                                href={`/cups/${cup.id}`}
                                                className="inline-flex items-center justify-center rounded-lg bg-slate-950 px-4 py-2.5 text-sm font-black text-white transition hover:bg-slate-800"
                                            >
                                                View Cup
                                            </Link>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </section>

                    </>
                )}
            </div>

            {leagueDetailsOpen && selectedLeague && (
                <div
                    className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/60 p-0 backdrop-blur-sm sm:items-center sm:p-4"
                    onMouseDown={(event) => {
                        if (event.target === event.currentTarget) {
                            setLeagueDetailsOpen(false);
                        }
                    }}
                >
                    <section className="max-h-[92vh] w-full overflow-hidden rounded-t-2xl border border-slate-300 bg-white shadow-2xl sm:max-w-3xl sm:rounded-2xl">
                        <div className="flex items-start justify-between gap-4 border-b border-slate-800 bg-slate-950 px-5 py-4 text-white sm:px-6">
                            <div>
                                <p className="text-xs font-black uppercase tracking-[0.18em] text-teal-300">
                                    League Details
                                </p>

                                <h2 className="mt-1 text-2xl font-black">
                                    {selectedLeague.name}
                                </h2>

                                <p className="mt-1 text-sm text-slate-400">
                                    Members, access and management
                                </p>
                            </div>

                            <button
                                type="button"
                                onClick={() => setLeagueDetailsOpen(false)}
                                className="rounded-lg border border-slate-700 bg-slate-900 p-2 text-slate-300 transition hover:border-teal-400 hover:text-white"
                                aria-label="Close league details"
                            >
                                <X className="h-5 w-5" />
                            </button>
                        </div>

                        <div className="max-h-[calc(92vh-92px)] overflow-y-auto p-4 sm:p-6">
                            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                                <div className="rounded-xl bg-slate-100 p-4">
                                    <p className="text-[10px] font-black uppercase tracking-wide text-slate-500">
                                        Members
                                    </p>
                                    <p className="mt-1 text-xl font-black text-slate-950">
                                        {selectedLeague.member_count}
                                    </p>
                                </div>

                                <div className="rounded-xl bg-slate-100 p-4">
                                    <p className="text-[10px] font-black uppercase tracking-wide text-slate-500">
                                        Capacity
                                    </p>
                                    <p className="mt-1 text-xl font-black text-slate-950">
                                        24
                                    </p>
                                </div>

                                <div className="rounded-xl bg-slate-100 p-4">
                                    <p className="text-[10px] font-black uppercase tracking-wide text-slate-500">
                                        Owner
                                    </p>
                                    <p className="mt-1 truncate text-sm font-black text-slate-950">
                                        {selectedLeague.owner_name}
                                    </p>
                                </div>

                                <div className="rounded-xl bg-slate-100 p-4">
                                    <p className="text-[10px] font-black uppercase tracking-wide text-slate-500">
                                        Access
                                    </p>
                                    <p className="mt-1 text-sm font-black text-slate-950">
                                        {selectedLeague.is_read_only ? "Read only" : "Active"}
                                    </p>
                                </div>
                            </div>

                            <div className="mt-5 overflow-hidden rounded-2xl border border-slate-300">
                                <div className="flex items-center justify-between border-b border-slate-800 bg-slate-950 px-5 py-4 text-white">
                                    <div>
                                        <h3 className="font-black text-white">
                                            League Members
                                        </h3>
                                        <p className="mt-1 text-sm text-slate-400">
                                            {leagueMembers.length} of 24 places filled
                                        </p>
                                    </div>
                                    <Users className="h-5 w-5 text-teal-300" />
                                </div>

                                <div className="max-h-72 divide-y divide-slate-100 overflow-y-auto">
                                    {leagueMembers.map((member) => (
                                        <div
                                            key={member.user_id}
                                            className="flex items-center justify-between gap-4 px-5 py-3.5"
                                        >
                                            <div className="min-w-0">
                                                <div className="flex items-center gap-2">
                                                    <span className="truncate font-semibold text-slate-900">
                                                        {member.display_name}
                                                    </span>

                                                    {member.is_owner && (
                                                        <span title="League owner">
                                                            <Crown className="h-4 w-4 text-amber-500" />
                                                        </span>
                                                    )}

                                                    {member.user_id === currentUserId && (
                                                        <span className="rounded-full bg-teal-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-teal-800">
                                                            You
                                                        </span>
                                                    )}
                                                </div>
                                            </div>

                                            {selectedLeague.is_owner &&
                                                !member.is_owner &&
                                                !selectedLeague.is_read_only && (
                                                    <button
                                                        type="button"
                                                        onClick={() => void removeMember(member)}
                                                        disabled={saving}
                                                        className="inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-sm font-semibold text-slate-700 hover:border-red-200 hover:bg-red-50 hover:text-red-700 disabled:opacity-50"
                                                    >
                                                        <UserMinus className="h-4 w-4" />
                                                        Remove
                                                    </button>
                                                )}
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <div className="mt-5 overflow-hidden rounded-2xl border border-slate-300">
                                <div className="flex items-center gap-2 border-b border-slate-800 bg-slate-950 px-5 py-4 text-white">
                                    <ShieldCheck className="h-5 w-5 text-teal-300" />
                                    <h3 className="font-black">
                                        League Management
                                    </h3>
                                </div>

                                <div className="p-5">
                                    {selectedLeague.is_read_only ? (
                                        <p className="text-sm text-slate-500">
                                            This season is complete, so this league is read-only.
                                        </p>
                                    ) : selectedLeague.is_owner ? (
                                        <div className="grid gap-2 sm:grid-cols-2">
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    setLeagueDetailsOpen(false);
                                                    openModal("rename");
                                                }}
                                                disabled={saving}
                                                className="flex w-full items-center gap-2 rounded-lg border px-3 py-2.5 text-left text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                                            >
                                                <Pencil className="h-4 w-4" />
                                                Rename League
                                            </button>

                                            <button
                                                type="button"
                                                onClick={() => void deleteLeague()}
                                                disabled={saving}
                                                className="flex w-full items-center gap-2 rounded-lg border border-red-200 px-3 py-2.5 text-left text-sm font-semibold text-red-700 hover:bg-red-50 disabled:opacity-50"
                                            >
                                                <Trash2 className="h-4 w-4" />
                                                Delete League
                                            </button>
                                        </div>
                                    ) : (
                                        <button
                                            type="button"
                                            onClick={() => void leaveLeague()}
                                            disabled={saving}
                                            className="flex w-full items-center gap-2 rounded-lg border border-red-200 px-3 py-2.5 text-left text-sm font-semibold text-red-700 hover:bg-red-50 disabled:opacity-50"
                                        >
                                            <LogOut className="h-4 w-4" />
                                            Leave League
                                        </button>
                                    )}
                                </div>
                            </div>
                        </div>
                    </section>
                </div>
            )}

            {leagueCupModalOpen && selectedLeague && selectedLeague.is_owner && (
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4"
                    onMouseDown={(event) => {
                        if (
                            event.target === event.currentTarget &&
                            !leagueCupSaving
                        ) {
                            setLeagueCupModalOpen(false);
                        }
                    }}
                >
                    <div className="w-full max-w-lg overflow-hidden rounded-2xl border border-slate-300 bg-white shadow-2xl">
                        <div className="flex items-start justify-between gap-4 border-b border-slate-800 bg-slate-950 px-6 py-4 text-white">
                            <div>
                                <p className="text-xs font-black uppercase tracking-[0.18em] text-teal-300">
                                    League Cup
                                </p>
                                <h2 className="mt-1 text-2xl font-black">
                                    Create League Cup
                                </h2>
                                <p className="mt-1 text-sm text-slate-400">
                                    All {selectedLeague.member_count} current league members will be entered.
                                </p>
                            </div>

                            <button
                                type="button"
                                onClick={() => setLeagueCupModalOpen(false)}
                                disabled={leagueCupSaving}
                                className="rounded-lg border border-slate-700 bg-slate-900 p-2 text-slate-300 transition hover:border-teal-400 hover:text-white disabled:opacity-50"
                                aria-label="Close League Cup creator"
                            >
                                <X className="h-5 w-5" />
                            </button>
                        </div>

                        <div className="p-6">
                            <label
                                htmlFor="league-cup-name"
                                className="block text-sm font-bold text-slate-800"
                            >
                                Cup name
                            </label>

                            <input
                                id="league-cup-name"
                                value={leagueCupForm.name}
                                onChange={(event) =>
                                    setLeagueCupForm((current) => ({
                                        ...current,
                                        name: event.target.value,
                                    }))
                                }
                                maxLength={100}
                                className="mt-2 w-full rounded-lg border border-slate-300 px-4 py-3 text-slate-900 outline-none focus:border-teal-700 focus:ring-2 focus:ring-teal-100"
                            />

                            <div className="mt-5 grid gap-4 sm:grid-cols-2">
                                <div>
                                    <label
                                        htmlFor="league-cup-groups"
                                        className="block text-sm font-bold text-slate-800"
                                    >
                                        Groups
                                    </label>

                                    <select
                                        id="league-cup-groups"
                                        value={leagueCupForm.groupCount}
                                        onChange={(event) => {
                                            const groupCount = Number(event.target.value);
                                            const teamsPerGroup =
                                                selectedLeague.member_count / groupCount;
                                            const qualifiers =
                                                getValidQualifierCounts(
                                                    groupCount,
                                                    teamsPerGroup
                                                );

                                            setLeagueCupForm((current) => ({
                                                ...current,
                                                groupCount,
                                                automaticQualifiers:
                                                    qualifiers.includes(
                                                        current.automaticQualifiers
                                                    )
                                                        ? current.automaticQualifiers
                                                        : qualifiers[0] ?? 1,
                                            }));
                                        }}
                                        className="mt-2 w-full rounded-lg border border-slate-300 bg-white px-4 py-3 text-slate-900 outline-none focus:border-teal-700 focus:ring-2 focus:ring-teal-100"
                                    >
                                        {leagueCupGroupCounts.map((groupCount) => (
                                            <option
                                                key={groupCount}
                                                value={groupCount}
                                            >
                                                {groupCount} {groupCount === 1 ? "group" : "groups"} · {selectedLeague.member_count / groupCount} teams each
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                <div>
                                    <label
                                        htmlFor="league-cup-qualifiers"
                                        className="block text-sm font-bold text-slate-800"
                                    >
                                        Qualifiers per group
                                    </label>

                                    <select
                                        id="league-cup-qualifiers"
                                        value={leagueCupForm.automaticQualifiers}
                                        onChange={(event) =>
                                            setLeagueCupForm((current) => ({
                                                ...current,
                                                automaticQualifiers:
                                                    Number(event.target.value),
                                            }))
                                        }
                                        className="mt-2 w-full rounded-lg border border-slate-300 bg-white px-4 py-3 text-slate-900 outline-none focus:border-teal-700 focus:ring-2 focus:ring-teal-100"
                                    >
                                        {leagueCupQualifierCounts.map((count) => (
                                            <option key={count} value={count}>
                                                Top {count}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            <div className="mt-5 rounded-xl border border-slate-200 bg-slate-50 p-4">
                                <div className="grid grid-cols-3 gap-3 text-center">
                                    <div>
                                        <p className="text-[10px] font-black uppercase tracking-wide text-slate-500">
                                            Entrants
                                        </p>
                                        <p className="mt-1 text-lg font-black text-slate-950">
                                            {selectedLeague.member_count}
                                        </p>
                                    </div>
                                    <div>
                                        <p className="text-[10px] font-black uppercase tracking-wide text-slate-500">
                                            Group Size
                                        </p>
                                        <p className="mt-1 text-lg font-black text-slate-950">
                                            {leagueCupTeamsPerGroup}
                                        </p>
                                    </div>
                                    <div>
                                        <p className="text-[10px] font-black uppercase tracking-wide text-slate-500">
                                            Knockout
                                        </p>
                                        <p className="mt-1 text-lg font-black text-slate-950">
                                            {leagueCupKnockoutTeams}
                                        </p>
                                    </div>
                                </div>
                            </div>

                            <p className="mt-4 text-sm leading-6 text-slate-500">
                                Participants are seeded automatically and the existing Cup group and knockout system will be used.
                            </p>

                            <div className="mt-6 flex justify-end gap-3">
                                <button
                                    type="button"
                                    onClick={() => setLeagueCupModalOpen(false)}
                                    disabled={leagueCupSaving}
                                    className="rounded-lg border bg-white px-4 py-2.5 font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                                >
                                    Cancel
                                </button>

                                <button
                                    type="button"
                                    onClick={() => void createLeagueCup()}
                                    disabled={
                                        leagueCupSaving ||
                                        !leagueCupForm.name.trim() ||
                                        leagueCupQualifierCounts.length === 0
                                    }
                                    className="rounded-lg bg-teal-700 px-4 py-2.5 font-semibold text-white hover:bg-teal-800 disabled:cursor-not-allowed disabled:opacity-50"
                                >
                                    {leagueCupSaving
                                        ? "Creating..."
                                        : "Create League Cup"}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {modal && (
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4"
                    onMouseDown={(event) => {
                        if (event.target === event.currentTarget) {
                            closeModal();
                        }
                    }}
                >
                    <div className="w-full max-w-md overflow-hidden rounded-2xl border border-slate-300 bg-white shadow-2xl">
                        <div className="border-b border-slate-800 bg-slate-950 px-6 py-4 text-white">
                            <p className="text-xs font-black uppercase tracking-[0.18em] text-teal-300">
                                Private Leagues
                            </p>

                            <h2 className="mt-1 text-2xl font-black">
                                {modal === "create"
                                    ? "Create Private League"
                                    : modal === "rename"
                                        ? "Rename League"
                                        : "Join Private League"}
                            </h2>
                        </div>

                        <div className="p-6">
                        <p className="text-sm text-slate-600">
                            {modal === "create"
                                ? `Create a league for ${selectedSeason
                                    ? `${selectedSeason.name} ${selectedSeason.year}`
                                    : "this season"
                                }.`
                                : modal === "rename"
                                    ? "Choose a new name for this private league."
                                    : "Enter the join code supplied by the league owner."}
                        </p>

                        <label
                            htmlFor="league-modal-input"
                            className="mt-5 block text-sm font-bold text-slate-800"
                        >
                            {modal === "join" ? "Join code" : "League name"}
                        </label>

                        <input
                            id="league-modal-input"
                            value={formValue}
                            onChange={(event) =>
                                setFormValue(event.target.value)
                            }
                            maxLength={
                                modal === "join" ? 12 : 60
                            }
                            autoFocus
                            onKeyDown={(event) => {
                                if (event.key === "Enter") {
                                    void submitModal();
                                }
                            }}
                            placeholder={
                                modal === "join"
                                    ? "e.g. A1B2C3"
                                    : "e.g. Saturday Punters"
                            }
                            className="mt-2 w-full rounded-lg border border-slate-300 px-4 py-3 text-slate-900 outline-none focus:border-teal-700 focus:ring-2 focus:ring-teal-100"
                        />

                        <div className="mt-6 flex justify-end gap-3">
                            <button
                                type="button"
                                onClick={closeModal}
                                disabled={saving}
                                className="rounded-lg border bg-white px-4 py-2.5 font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                            >
                                Cancel
                            </button>

                            <button
                                type="button"
                                onClick={() => void submitModal()}
                                disabled={
                                    saving || !formValue.trim()
                                }
                                className="rounded-lg bg-teal-700 px-4 py-2.5 font-semibold text-white hover:bg-teal-800 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                                {saving
                                    ? "Saving..."
                                    : modal === "create"
                                        ? "Create League"
                                        : modal === "rename"
                                            ? "Save Name"
                                            : "Join League"}
                            </button>
                        </div>
                        </div>
                    </div>
                </div>
            )}
        </main>
    );
}