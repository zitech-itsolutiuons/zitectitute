"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import SupportUnreadBadge from "@/components/SupportUnreadBadge";

const links = [
  { href: "/courses", label: "My learning", icon: "courses" },
  { href: "/notifications", label: "Notifications", icon: "notifications" },
  { href: "/certificates", label: "Certificates", icon: "certificates" },
  { href: "/profile", label: "Profile settings", icon: "profile" },
] as const;

const cohortLink = { href: "/cohorts", label: "Cohorts", icon: "cohorts" } as const;
const supportLink = { href: "/support", label: "Support", icon: "support" } as const;
const adminSupportLink = { href: "/admin/support", label: "Support inbox", icon: "support" } as const;

const paths: Record<(typeof links)[number]["icon"] | typeof cohortLink.icon | typeof supportLink.icon | "admin", string> = {
  courses: "M4 5.5A2.5 2.5 0 0 1 6.5 3H20v16H6.5A2.5 2.5 0 0 0 4 21zM4 5.5V21M8 7h8M8 11h8",
  cohorts: "M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM20 8v6M23 11h-6",
  support: "M21 11.5a8.4 8.4 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.4 8.4 0 0 1-3.8-.9L3 21l1.9-5.7a8.4 8.4 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.4 8.4 0 0 1 3.8-.9h.5a8.5 8.5 0 0 1 8 8z",
  notifications: "M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4",
  certificates: "M5 3h14v12H5zM8 7h8M8 10h5M9 15l-2 6 5-2 5 2-2-6",
  profile: "M20 21a8 8 0 0 0-16 0M12 13a5 5 0 1 0 0-10 5 5 0 0 0 0 10z",
  admin: "M12 22s8-4 8-11V5l-8-3-8 3v6c0 7 8 11 8 11zM9 12l2 2 4-4",
};

function NavLinks({
  canUpload,
  hasCohorts,
  supportUnreadCount,
  onNavigate,
}: {
  canUpload: boolean;
  hasCohorts: boolean;
  supportUnreadCount: number;
  onNavigate?: (event: React.MouseEvent<HTMLAnchorElement>) => void;
}) {
  const pathname = usePathname();
  const dashboardLinks = hasCohorts ? [links[0], cohortLink, ...links.slice(1)] : [...links];
  const support = canUpload ? adminSupportLink : supportLink;
  const items = canUpload
    ? [...dashboardLinks, support, { href: "/admin", label: "Admin workspace", icon: "admin" as const }]
    : [...dashboardLinks, support];

  return (
    <nav aria-label="Your account">
      <ul className="space-y-1">
        {items.map((link) => {
          const active = link.href === "/courses"
            ? pathname === "/courses" || pathname.startsWith("/courses/")
            : pathname === link.href || pathname.startsWith(`${link.href}/`);
          return (
            <li key={link.href}>
              <Link
                href={link.href}
                aria-current={active ? "page" : undefined}
                onClick={onNavigate}
                className={`group flex min-h-11 items-center gap-3 px-3 text-sm font-semibold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#355f4c] dark:focus-visible:outline-[#d7bd7a] ${
                  active
                    ? "bg-[#355f4c] text-[#fffdf8] dark:bg-[#9abd9f] dark:text-[#17211d]"
                    : "text-[#46564c] hover:bg-[#e9eee8] hover:text-[#263b30] dark:text-[#d0d8d0] dark:hover:bg-[#2b3a32] dark:hover:text-white"
                }`}
              >
                <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.65" strokeLinecap="round" strokeLinejoin="round" className="h-[18px] w-[18px] shrink-0">
                  <path d={paths[link.icon]} />
                </svg>
                <span>{link.label}</span>
                {link.icon === "support" && (
                  <SupportUnreadBadge initialCount={supportUnreadCount} />
                )}
                {link.href === "/courses" && active && <span className="ml-auto h-1.5 w-1.5 rounded-full bg-[#d9bb78] dark:bg-[#3d6149]" />}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

export default function StudentDashboardSidebar({
  displayName,
  avatarData,
  canUpload,
  hasCohorts,
  supportUnreadCount,
}: {
  displayName: string;
  avatarData: string;
  canUpload: boolean;
  hasCohorts: boolean;
  supportUnreadCount: number;
}) {
  const initials = displayName.trim().split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase() || "L";

  return (
    <>
      <aside className="hidden self-start lg:sticky lg:top-24 lg:block" aria-label="Learning dashboard sidebar">
        <div className="border border-[#d9d5ca] bg-[#eeece4] p-3 dark:border-[#394941] dark:bg-[#1e2b25]">
          <div className="mb-5 flex items-center gap-3 border-b border-[#d9d5ca] px-2 pb-4 dark:border-[#394941]">
            {avatarData ? (
              <img src={avatarData} alt={`${displayName}'s profile`} className="h-10 w-10 shrink-0 rounded-full border border-[#b8c8b8] object-cover dark:border-[#59695e]" />
            ) : (
              <span aria-hidden="true" className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-[#b8c8b8] bg-[#e3ebe1] font-serif text-lg font-semibold text-[#355f4c] dark:border-[#59695e] dark:bg-[#26352e] dark:text-[#b5c9b5]">
                {initials}
              </span>
            )}
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-[#26312d] dark:text-[#f2eee4]">{displayName}</p>
              <p className="mt-0.5 text-[10px] font-semibold uppercase tracking-[0.13em] text-[#59685e] dark:text-[#c0c8bf]">Learning space</p>
            </div>
          </div>
          <NavLinks canUpload={canUpload} hasCohorts={hasCohorts} supportUnreadCount={supportUnreadCount} />
          <p className="mt-5 border-t border-[#d9d5ca] px-3 pt-4 text-xs leading-5 text-[#59685e] dark:border-[#394941] dark:text-[#c0c8bf]">
            Pick up where you left off, or make time for something new.
          </p>
        </div>
      </aside>

      <details className="relative z-20 lg:hidden">
        <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 border border-[#d9d5ca] bg-[#eeece4] px-4 text-sm font-semibold text-[#355f4c] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#355f4c] dark:border-[#394941] dark:bg-[#1e2b25] dark:text-[#b5c9b5]">
          <span className="flex items-center gap-2">
            <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" className="h-5 w-5">
              <path d="M4 6h16M4 12h16M4 18h16" />
            </svg>
            Learning menu
          </span>
          <span className="flex min-w-0 items-center gap-2 text-xs font-medium text-[#59685e] dark:text-[#c0c8bf]">
            <span className="max-w-36 truncate">{displayName}</span>
            {avatarData ? (
              <img src={avatarData} alt="" className="h-7 w-7 shrink-0 rounded-full border border-[#b8c8b8] object-cover dark:border-[#59695e]" />
            ) : (
              <span aria-hidden="true" className="grid h-7 w-7 shrink-0 place-items-center rounded-full border border-[#b8c8b8] bg-[#e3ebe1] text-[10px] font-semibold text-[#355f4c] dark:border-[#59695e] dark:bg-[#26352e] dark:text-[#b5c9b5]">
                {initials}
              </span>
            )}
          </span>
        </summary>
        <div className="absolute left-0 right-0 top-full mt-1 border border-[#d9d5ca] bg-[#fffdf8] p-2 shadow-lg dark:border-[#394941] dark:bg-[#1e2b25]">
          <NavLinks canUpload={canUpload} hasCohorts={hasCohorts} supportUnreadCount={supportUnreadCount} onNavigate={(event) => {
            const details = event?.currentTarget.closest("details");
            if (details) details.open = false;
          }} />
        </div>
      </details>
    </>
  );
}
