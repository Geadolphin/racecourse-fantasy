"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

import { supabase } from "@/lib/supabase";

export type SiteSeason = {
  id: string;
  name: string;
  year: number;
  starts_on: string;
  ends_on: string;
  salary_cap: number;
  team_size: number;
  is_active: boolean;
  salary_cap_mode: "rolling" | "per_round";
};

type SeasonContextValue = {
  seasons: SiteSeason[];
  selectedSeason: SiteSeason | null;
  selectedSeasonId: string | null;
  loadingSeasons: boolean;
  seasonError: string;
  selectSeason: (seasonId: string) => void;
  refreshSeasons: () => Promise<void>;
};

const SeasonContext = createContext<SeasonContextValue | null>(null);

const STORAGE_KEY = "racecourse-fantasy-selected-season";

export function SeasonProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [seasons, setSeasons] = useState<SiteSeason[]>([]);
  const [selectedSeasonId, setSelectedSeasonId] = useState<string | null>(
    null
  );
  const [loadingSeasons, setLoadingSeasons] = useState(true);
  const [seasonError, setSeasonError] = useState("");

  const loadSeasons = useCallback(async () => {
    setLoadingSeasons(true);
    setSeasonError("");

    const { data, error } = await supabase
      .from("seasons")
      .select(
        `
          id,
          name,
          year,
          starts_on,
          ends_on,
          salary_cap,
          team_size,
          is_active,
          salary_cap_mode
        `
      )
      .order("is_active", { ascending: false })
      .order("starts_on", { ascending: true });

    if (error) {
      console.error("Season load error:", error);
      setSeasons([]);
      setSeasonError(error.message);
      setLoadingSeasons(false);
      return;
    }

    const loadedSeasons = (data ?? []) as SiteSeason[];

    setSeasons(loadedSeasons);

    let storedSeasonId: string | null = null;

    try {
      storedSeasonId = window.localStorage.getItem(STORAGE_KEY);
    } catch (error) {
      console.error("Could not read selected season:", error);
    }

    const storedSeasonStillAvailable =
      storedSeasonId !== null &&
      loadedSeasons.some((season) => season.id === storedSeasonId);

    if (storedSeasonStillAvailable) {
      setSelectedSeasonId(storedSeasonId);
    } else {
      const defaultSeason =
        loadedSeasons.find((season) => season.is_active) ??
        loadedSeasons[0] ??
        null;

      const defaultSeasonId = defaultSeason?.id ?? null;

      setSelectedSeasonId(defaultSeasonId);

      if (defaultSeasonId) {
        try {
          window.localStorage.setItem(STORAGE_KEY, defaultSeasonId);
        } catch (error) {
          console.error("Could not store selected season:", error);
        }
      }
    }

    setLoadingSeasons(false);
  }, []);

  useEffect(() => {
    void loadSeasons();
  }, [loadSeasons]);

  const selectedSeason = useMemo(() => {
    if (!selectedSeasonId) {
      return null;
    }

    return (
      seasons.find((season) => season.id === selectedSeasonId) ?? null
    );
  }, [seasons, selectedSeasonId]);

  const selectSeason = useCallback(
    (seasonId: string) => {
      const seasonExists = seasons.some(
        (season) => season.id === seasonId
      );

      if (!seasonExists) {
        return;
      }

      setSelectedSeasonId(seasonId);

      try {
        window.localStorage.setItem(STORAGE_KEY, seasonId);
      } catch (error) {
        console.error("Could not store selected season:", error);
      }
    },
    [seasons]
  );

  const value = useMemo<SeasonContextValue>(
    () => ({
      seasons,
      selectedSeason,
      selectedSeasonId,
      loadingSeasons,
      seasonError,
      selectSeason,
      refreshSeasons: loadSeasons,
    }),
    [
      seasons,
      selectedSeason,
      selectedSeasonId,
      loadingSeasons,
      seasonError,
      selectSeason,
      loadSeasons,
    ]
  );

  return (
    <SeasonContext.Provider value={value}>
      {children}
    </SeasonContext.Provider>
  );
}

export function useSeason() {
  const context = useContext(SeasonContext);

  if (!context) {
    throw new Error(
      "useSeason must be used inside a SeasonProvider."
    );
  }

  return context;
}