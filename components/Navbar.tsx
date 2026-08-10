"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import type { User } from "@supabase/supabase-js";
import {
  LayoutDashboard,
  Users,
  Network,
  Medal,
  History,
  Trophy,
  ChessKnight,
  Shield,
  BookOpen,
  CalendarDays,
  BarChart3,
  LogOut,
  LogIn,
  UserPlus,
  UserCog,
  ChevronDown,
  Menu,
  X,
} from "lucide-react";

import { supabase } from "../lib/supabase";

export default function Navbar() {
  const router = useRouter();
  const pathname = usePathname();

  const [user, setUser] = useState<User | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  const [moreOpen, setMoreOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  const moreMenuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let active = true;
    let loadedUserId: string | null = null;

    async function loadProfile(userId: string) {
      if (loadedUserId === userId) {
        return;
      }

      loadedUserId = userId;

      const { data, error } = await supabase
        .from("profiles")
        .select("is_admin")
        .eq("id", userId)
        .single();

      if (!active) {
        return;
      }

      if (error) {
        console.error("Could not load profile:", error.message);
        setIsAdmin(false);
        return;
      }

      setIsAdmin(Boolean(data?.is_admin));
    }

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      const currentUser = session?.user ?? null;

      if (!active) {
        return;
      }

      setUser(currentUser);

      if (currentUser) {
        void loadProfile(currentUser.id);
      } else {
        loadedUserId = null;
        setIsAdmin(false);
      }

      setLoading(false);
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    setMoreOpen(false);
    setMobileOpen(false);
  }, [pathname]);

  useEffect(() => {
    function handleOutsideClick(event: MouseEvent) {
      if (
        moreMenuRef.current &&
        !moreMenuRef.current.contains(event.target as Node)
      ) {
        setMoreOpen(false);
      }
    }

    document.addEventListener("mousedown", handleOutsideClick);

    return () => {
      document.removeEventListener("mousedown", handleOutsideClick);
    };
  }, []);

  async function handleLogout() {
    setMoreOpen(false);
    setMobileOpen(false);

    const { error } = await supabase.auth.signOut();

    if (error) {
      console.error("Logout failed:", error.message);
      return;
    }

    router.push("/");
    router.refresh();
  }

  function isActive(href: string) {
    return pathname === href || pathname.startsWith(`${href}/`);
  }

  function desktopLinkClasses(href: string) {
    return `flex items-center gap-2 transition ${isActive(href)
      ? "text-teal-300"
      : "text-white hover:text-teal-300"
      }`;
  }

  function mobileLinkClasses(href: string) {
    return `flex items-center gap-3 rounded-lg px-3 py-3 font-medium transition ${isActive(href)
      ? "bg-slate-800 text-teal-300"
      : "text-white hover:bg-slate-800 hover:text-teal-300"
      }`;
  }

  return (
    <header className="relative z-50 border-b border-slate-800 bg-slate-900 text-white">
      <nav className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6">
        <Link
          href="/"
          aria-label="Racecourse Fantasy home"
          className="shrink-0 text-lg font-bold tracking-tight text-white transition hover:text-teal-300 sm:text-xl"
        >
          RACECOURSE FANTASY
        </Link>

        {!loading && user && (
          <>
            <div className="hidden items-center gap-5 text-sm font-medium lg:flex">
              <Link
                href="/dashboard"
                className={desktopLinkClasses("/dashboard")}
              >
                <LayoutDashboard className="h-4 w-4" />
                <span>Dashboard</span>
              </Link>

              <Link
                href="/team"
                className={desktopLinkClasses("/team")}
              >
                <Users className="h-4 w-4" />
                <span>My Team</span>
              </Link>

              <Link
                href="/results"
                className={desktopLinkClasses("/results")}
              >
                <Medal className="h-4 w-4" />
                <span>Results</span>
              </Link>

              <Link
                href="/leaderboard"
                className={desktopLinkClasses("/leaderboard")}
              >
                <Trophy className="h-4 w-4" />
                <span>Leaderboard</span>
              </Link>

              <Link
                href="/leagues"
                className={desktopLinkClasses("/leagues")}
              >
                <Network className="h-4 w-4" />
                <span>Leagues</span>
              </Link>

              <div ref={moreMenuRef} className="relative">
                <button
                  type="button"
                  onClick={() => setMoreOpen((current) => !current)}
                  aria-expanded={moreOpen}
                  aria-haspopup="menu"
                  className={`flex items-center gap-2 transition ${moreOpen
                    ? "text-teal-300"
                    : "text-white hover:text-teal-300"
                    }`}
                >
                  <span>More</span>

                  <ChevronDown
                    className={`h-4 w-4 transition-transform ${moreOpen ? "rotate-180" : ""
                      }`}
                  />
                </button>

                {moreOpen && (
                  <div
                    role="menu"
                    className="absolute right-0 top-full mt-3 w-56 overflow-hidden rounded-xl border border-slate-700 bg-slate-900 py-2 shadow-2xl"
                  >
                    <Link
                      href="/history"
                      role="menuitem"
                      className="flex items-center gap-3 px-4 py-3 text-sm transition hover:bg-slate-800 hover:text-teal-300"
                    >
                      <History className="h-4 w-4" />
                      <span>My Season</span>
                    </Link>

                    <Link
                      href="/rules"
                      role="menuitem"
                      className="flex items-center gap-3 px-4 py-3 text-sm transition hover:bg-slate-800 hover:text-teal-300"
                    >
                      <BookOpen className="h-4 w-4" />
                      <span>Rules</span>
                    </Link>

                    <Link
                      href="/calendar"
                      role="menuitem"
                      className="flex items-center gap-3 px-4 py-3 text-sm transition hover:bg-slate-800 hover:text-teal-300"
                    >
                      <CalendarDays className="h-4 w-4" />
                      <span>Calendar</span>
                    </Link>

                    <Link
                      href="/stats"
                      role="menuitem"
                      className="flex items-center gap-3 px-4 py-3 text-sm transition hover:bg-slate-800 hover:text-teal-300"
                    >
                      <BarChart3 className="h-4 w-4" />
                      <span>Stats</span>
                    </Link>

                    <Link
                      href="/horses"
                      role="menuitem"
                      className="flex items-center gap-3 px-4 py-3 text-sm transition hover:bg-slate-800 hover:text-teal-300"
                    >
                      <ChessKnight className="h-4 w-4" />
                      <span>Horses</span>
                    </Link>

                    <Link
                      href="/compare"
                      role="menuitem"
                      className="flex items-center gap-3 px-4 py-3 text-sm transition hover:bg-slate-800 hover:text-teal-300"
                    >
                      <Users className="h-4 w-4" />
                      <span>Compare Teams</span>
                    </Link>

                    <Link
                      href="/account"
                      role="menuitem"
                      className="flex items-center gap-3 px-4 py-3 text-sm transition hover:bg-slate-800 hover:text-teal-300"
                    >
                      <UserCog className="h-4 w-4" />
                      <span>Account</span>
                    </Link>

                    {isAdmin && (
                      <Link
                        href="/admin"
                        prefetch={false}
                        role="menuitem"
                        className="flex items-center gap-3 px-4 py-3 text-sm transition hover:bg-slate-800 hover:text-amber-300"
                      >
                        <Shield className="h-4 w-4" />
                        <span>Admin</span>
                      </Link>
                    )}

                    <div className="my-2 border-t border-slate-700" />

                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => void handleLogout()}
                      className="flex w-full items-center gap-3 px-4 py-3 text-left text-sm font-semibold text-amber-300 transition hover:bg-slate-800"
                    >
                      <LogOut className="h-4 w-4" />
                      <span>Log out</span>
                    </button>
                  </div>
                )}
              </div>
            </div>

            <button
              type="button"
              onClick={() => setMobileOpen((current) => !current)}
              aria-expanded={mobileOpen}
              aria-label={mobileOpen ? "Close navigation" : "Open navigation"}
              className="rounded-lg border border-slate-700 p-2 transition hover:bg-slate-800 lg:hidden"
            >
              {mobileOpen ? (
                <X className="h-5 w-5" />
              ) : (
                <Menu className="h-5 w-5" />
              )}
            </button>
          </>
        )}

        {!loading && !user && (
          <div className="flex items-center gap-3 text-sm font-medium">
            <Link
              href="/leaderboard"
              className="hidden items-center gap-2 transition hover:text-teal-300 sm:flex"
            >
              <Trophy className="h-4 w-4" />
              <span>Leaderboard</span>
            </Link>

            <Link
              href="/login"
              className="flex items-center gap-2 transition hover:text-teal-300"
            >
              <LogIn className="h-4 w-4" />
              <span>Log in</span>
            </Link>

            <Link
              href="/register"
              className="flex items-center gap-2 rounded-lg bg-amber-400 px-3 py-2 font-semibold text-emerald-950 transition hover:bg-amber-300 sm:px-4"
            >
              <UserPlus className="h-4 w-4" />
              <span className="hidden sm:inline">Register</span>
            </Link>
          </div>
        )}
      </nav>

      {!loading && user && mobileOpen && (
        <div className="border-t border-slate-800 bg-slate-900 px-4 pb-4 pt-3 lg:hidden">
          <div className="mx-auto max-w-7xl space-y-1">
            <Link
              href="/dashboard"
              className={mobileLinkClasses("/dashboard")}
            >
              <LayoutDashboard className="h-5 w-5" />
              <span>Dashboard</span>
            </Link>

            <Link
              href="/team"
              className={mobileLinkClasses("/team")}
            >
              <Users className="h-5 w-5" />
              <span>My Team</span>
            </Link>

            <Link
              href="/results"
              className={mobileLinkClasses("/results")}
            >
              <Medal className="h-5 w-5" />
              <span>Results</span>
            </Link>

            <Link
              href="/leaderboard"
              className={mobileLinkClasses("/leaderboard")}
            >
              <Trophy className="h-5 w-5" />
              <span>Leaderboard</span>
            </Link>

            <Link
              href="/leagues"
              className={mobileLinkClasses("/leagues")}
            >
              <Network className="h-5 w-5" />
              <span>Leagues</span>
            </Link>

            <Link
              href="/history"
              className={mobileLinkClasses("/history")}
            >
              <History className="h-5 w-5" />
              <span>My Season</span>
            </Link>

            <Link
              href="/rules"
              className={mobileLinkClasses("/rules")}
            >
              <BookOpen className="h-5 w-5" />
              <span>Rules</span>
            </Link>

            <Link
              href="/calendar"
              className={mobileLinkClasses("/calendar")}
            >
              <CalendarDays className="h-5 w-5" />
              <span>Calendar</span>
            </Link>

            <Link
              href="/stats"
              className={mobileLinkClasses("/stats")}
            >
              <BarChart3 className="h-5 w-5" />
              <span>Stats</span>
            </Link>

            <Link
              href="/horses"
              className={mobileLinkClasses("/horses")}
            >
              <ChessKnight className="h-5 w-5" />
              <span>Horses</span>
            </Link>

            <Link
              href="/compare"
              className={mobileLinkClasses("/compare")}
            >
              <Users className="h-5 w-5" />
              <span>Compare Teams</span>
            </Link>

            <Link
              href="/account"
              className={mobileLinkClasses("/account")}
            >
              <UserCog className="h-5 w-5" />
              <span>Account</span>
            </Link>

            {isAdmin && (
              <Link
                href="/admin"
                prefetch={false}
                className="flex items-center gap-3 rounded-lg px-3 py-3 font-medium text-white transition hover:bg-slate-800 hover:text-amber-300"
              >
                <Shield className="h-5 w-5" />
                <span>Admin</span>
              </Link>
            )}

            <div className="pt-2">
              <button
                type="button"
                onClick={() => void handleLogout()}
                className="flex w-full items-center justify-center gap-2 rounded-lg bg-amber-400 px-4 py-3 font-semibold text-emerald-950 transition hover:bg-amber-300"
              >
                <LogOut className="h-4 w-4" />
                <span>Log out</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </header>
  );
}