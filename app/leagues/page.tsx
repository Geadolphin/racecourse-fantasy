"use client";

import { Copy, Crown, Pencil, Plus, Trash2, UserMinus, Users, LogOut, Trophy, ShieldCheck, CalendarDays, KeyRound } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

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
    const [formValue, setFormValue] = useState("");

    const [error, setError] = useState("");
    const [successMessage, setSuccessMessage] = useState("");

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
                                            {selectedLeague.member_count} / 24 members
                                            {selectedSeason
                                                ? ` · ${selectedSeason.name} ${selectedSeason.year}`
                                                : ""}
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
                                    </div>
                                </div>

                                <div className="mt-4 inline-flex overflow-hidden rounded-lg border border-slate-700 bg-slate-900">
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
                            </div>

                            <div className="grid grid-cols-2 gap-px bg-slate-200 sm:grid-cols-4">
                                <div className="bg-white p-4">
                                    <p className="text-[10px] font-black uppercase tracking-wide text-slate-500">
                                        Members
                                    </p>
                                    <p className="mt-1 text-xl font-black text-slate-950">
                                        {selectedLeague.member_count}
                                    </p>
                                </div>

                                <div className="bg-white p-4">
                                    <p className="text-[10px] font-black uppercase tracking-wide text-slate-500">
                                        Capacity
                                    </p>
                                    <p className="mt-1 text-xl font-black text-slate-950">
                                        24
                                    </p>
                                </div>

                                <div className="bg-white p-4">
                                    <p className="text-[10px] font-black uppercase tracking-wide text-slate-500">
                                        Owner
                                    </p>
                                    <p className="mt-1 truncate text-sm font-black text-slate-950">
                                        {selectedLeague.owner_name}
                                    </p>
                                </div>

                                <div className="bg-white p-4">
                                    <p className="text-[10px] font-black uppercase tracking-wide text-slate-500">
                                        Access
                                    </p>
                                    <p className="mt-1 text-sm font-black text-slate-950">
                                        {selectedLeague.is_read_only ? "Read only" : "Active"}
                                    </p>
                                </div>
                            </div>
                        </section>

                        {tab === "round" && (
                            <section className="mb-6 rounded-2xl border border-slate-300 bg-white p-5 shadow-sm">
                                <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                                    <div>
                                        <label
                                            htmlFor="league-round"
                                            className="block text-sm font-bold text-slate-800"
                                        >
                                            Select round
                                        </label>

                                        <select
                                            id="league-round"
                                            value={selectedRoundId}
                                            onChange={(event) =>
                                                void changeRound(
                                                    event.target.value
                                                )
                                            }
                                            disabled={
                                                changing ||
                                                leagueRounds.length === 0
                                            }
                                            className="mt-2 min-w-64 rounded-lg border border-slate-300 bg-white px-4 py-3 text-slate-900 outline-none focus:border-teal-700 focus:ring-2 focus:ring-teal-100 disabled:cursor-not-allowed disabled:bg-slate-100"
                                        >
                                            {leagueRounds.map(
                                                (round) => (
                                                    <option
                                                        key={round.id}
                                                        value={round.id}
                                                    >
                                                        Round {round.round_number}
                                                        {round.name
                                                            ? ` — ${round.name}`
                                                            : ""}
                                                    </option>
                                                )
                                            )}
                                        </select>
                                    </div>

                                    {selectedRound && (
                                        <div className="text-sm text-slate-600 sm:text-right">
                                            <p className="font-semibold text-slate-900">
                                                Round{" "}
                                                {selectedRound.round_number}
                                                {selectedRound.name
                                                    ? ` — ${selectedRound.name}`
                                                    : ""}
                                            </p>

                                            <p className="mt-1">
                                                {leaderboardRows.length}{" "}
                                                {leaderboardRows.length === 1
                                                    ? "team"
                                                    : "teams"}
                                            </p>
                                        </div>
                                    )}
                                </div>
                            </section>
                        )}

                        <div className="mb-6">
                            <LeagueLeaderboardTable
                                type={tab}
                                rows={leaderboardRows}
                                currentUserId={currentUserId}
                            />
                        </div>

                        <section className="mb-6 grid gap-6 lg:grid-cols-[1fr_340px]">
                            <div className="overflow-hidden rounded-2xl border border-slate-300 bg-white shadow-sm">
                                <div className="flex items-center justify-between border-b border-slate-800 bg-slate-950 px-5 py-4 text-white">
                                    <div>
                                        <h3 className="font-black text-white">League Members</h3>
                                        <p className="mt-1 text-sm text-slate-400">
                                            {leagueMembers.length} of 24 places filled
                                        </p>
                                    </div>
                                    <Users className="h-5 w-5 text-teal-300" />
                                </div>

                                <div className="max-h-72 divide-y overflow-y-auto">
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

                            <aside className="overflow-hidden rounded-2xl border border-slate-300 bg-white shadow-sm">
                                <div className="border-b border-slate-800 bg-slate-950 px-5 py-4">
                                    <div className="flex items-center gap-2">
                                        <ShieldCheck className="h-5 w-5 text-teal-300" />
                                        <h3 className="font-black text-white">League Management</h3>
                                    </div>
                                </div>

                                <div className="p-5">

                                {selectedLeague.is_read_only ? (
                                    <p className="mt-3 text-sm text-slate-500">
                                        This season is complete, so this league is read-only.
                                    </p>
                                ) : selectedLeague.is_owner ? (
                                    <div className="mt-4 space-y-2">
                                        <button
                                            type="button"
                                            onClick={() => openModal("rename")}
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
                                        className="mt-4 flex w-full items-center gap-2 rounded-lg border border-red-200 px-3 py-2.5 text-left text-sm font-semibold text-red-700 hover:bg-red-50 disabled:opacity-50"
                                    >
                                        <LogOut className="h-4 w-4" />
                                        Leave League
                                    </button>
                                )}
                                </div>
                            </aside>
                        </section>
                    </>
                )}
            </div>

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