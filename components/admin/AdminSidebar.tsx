"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  CalendarDays,
  ChevronRight,
  ClipboardList,
  Flag,
  Gauge,
  GitBranch,
  MapPin,
  Medal,
  Shield,
  Trophy,
  Users,
  Waves,
} from "lucide-react";

const links = [
  { href: "/admin", label: "Dashboard", icon: Gauge },
  { href: "/admin/cups", label: "Cups", icon: Trophy },
  { href: "/admin/horses", label: "Horses", icon: Medal },
  { href: "/admin/leagues", label: "Leagues", icon: Users },
  { href: "/admin/race-entries", label: "Race Entries", icon: ClipboardList },
  { href: "/admin/racecourses", label: "Racecourses", icon: MapPin },
  { href: "/admin/races", label: "Races", icon: Flag },
  { href: "/admin/results", label: "Results", icon: BarChart3 },
  { href: "/admin/rounds", label: "Rounds", icon: CalendarDays },
  { href: "/admin/seasons", label: "Seasons", icon: GitBranch },
  { href: "/admin/stats", label: "Stats", icon: Waves },
  { href: "/admin/users", label: "Users", icon: Shield },
] as const;

export default function AdminSidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-full shrink-0 border-b border-slate-800 bg-slate-950 text-white md:min-h-screen md:w-56 md:border-b-0 md:border-r">
      <div className="border-b border-slate-800 px-4 py-4 md:px-5 md:py-5">
        <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-teal-400">
          Administration
        </p>
        <h2 className="mt-1 text-base font-semibold tracking-tight text-white">
          Racecourse Fantasy
        </h2>
      </div>

      <nav aria-label="Admin navigation" className="flex gap-1 overflow-x-auto px-3 py-2 md:flex-col md:overflow-x-visible md:px-3 md:py-3">
        {links.map(({ href, label, icon: Icon }) => {
          const isActive =
            href === "/admin"
              ? pathname === href
              : pathname === href || pathname.startsWith(`${href}/`);

          return (
            <Link
              key={href}
              href={href}
              aria-current={isActive ? "page" : undefined}
              className={`group flex shrink-0 items-center gap-2.5 whitespace-nowrap rounded-md px-3 py-2 text-[13px] font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-400 md:w-full ${
                isActive
                  ? "bg-teal-700 text-white"
                  : "text-slate-300 hover:bg-slate-800 hover:text-white"
              }`}
            >
              <Icon aria-hidden="true" className={`h-4 w-4 shrink-0 ${isActive ? "text-teal-100" : "text-slate-400 group-hover:text-slate-200"}`} />
              <span className="flex-1">{label}</span>
              {isActive && (
                <ChevronRight aria-hidden="true" className="hidden h-3.5 w-3.5 text-teal-200 md:block" />
              )}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
