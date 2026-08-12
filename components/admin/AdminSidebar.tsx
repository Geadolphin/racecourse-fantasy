"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const links = [
  { href: "/admin", label: "Dashboard" },
  { href: "/admin/seasons", label: "Seasons" },
  { href: "/admin/rounds", label: "Rounds" },
  { href: "/admin/racecourses", label: "Racecourses" },
  { href: "/admin/races", label: "Races" },
  { href: "/admin/horses", label: "Horses" },
  { href: "/admin/race-entries", label: "Race Entries" },
  { href: "/admin/results", label: "Results" },
  { href: "/admin/users", label: "Users" },
  { href: "/admin/leagues", label: "Leagues" },
  { href: "/admin/cups", label: "Cups" },
];

export default function AdminSidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-full bg-slate-950 text-white md:min-h-screen md:w-64">
      <div className="border-b border-slate-800 p-6">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-teal-400">
          Administration
        </p>

        <h2 className="mt-1 text-xl font-bold">
          Racecourse Fantasy
        </h2>
      </div>

      <nav className="flex gap-2 overflow-x-auto p-4 md:flex-col">
        {links.map((link) => {
          const isActive =
            link.href === "/admin"
              ? pathname === "/admin"
              : pathname.startsWith(link.href);

          return (
            <Link
              key={link.href}
              href={link.href}
              className={`whitespace-nowrap rounded-lg px-4 py-3 text-sm font-medium transition ${
                isActive
                  ? "bg-teal-600 text-white"
                  : "text-slate-300 hover:bg-slate-800 hover:text-white"
              }`}
            >
              {link.label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}