"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import SupportUnreadBadge from "@/components/SupportUnreadBadge";

const sections = [
  {
    label: "Workspace",
    links: [
      { href: "/admin", label: "Overview", icon: "overview" },
      { href: "/admin/courses", label: "Courses", icon: "courses" },
      { href: "/admin/categories", label: "Categories", icon: "categories" },
      { href: "/admin/pricing", label: "Pricing & promos", icon: "pricing" },
      { href: "/admin/groups", label: "Course groups", icon: "groups" },
      { href: "/admin/support", label: "Support inbox", icon: "support" },
    ],
  },
  {
    label: "People",
    links: [
      { href: "/admin/users", label: "Users", icon: "users" },
      { href: "/admin/users/import", label: "Student import", icon: "import" },
      { href: "/admin/cohorts", label: "Cohorts", icon: "cohorts" },
      { href: "/admin/announcements", label: "Announcements", icon: "announcements" },
    ],
  },
  {
    label: "Insights & safety",
    links: [
      { href: "/admin/reports", label: "Reports", icon: "reports" },
      { href: "/admin/videos", label: "Video protection", icon: "videos" },
      { href: "/admin/audit", label: "Audit & backups", icon: "audit" },
    ],
  },
  {
    label: "Configuration",
    links: [
      { href: "/admin/settings", label: "Settings", icon: "settings" },
      { href: "/admin/signup-access", label: "Signup access", icon: "access" },
      { href: "/admin/homepage", label: "Home page", icon: "home" },
    ],
  },
];

const iconPaths: Record<string, string> = {
  overview: "M3 3h7v7H3zM14 3h7v5h-7zM14 12h7v9h-7zM3 14h7v7H3z",
  courses: "M4 5.5A2.5 2.5 0 0 1 6.5 3H20v16H6.5A2.5 2.5 0 0 0 4 21zM4 5.5V21M8 7h8M8 11h8",
  categories: "M4 5h6v6H4zM14 5h6v6h-6zM4 15h6v6H4zM14 15h6v6h-6z",
  pricing: "M3 7V4h3l14 14-3 3L3 7zM7 7h.01M14 4h6v6",
  groups: "M16 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2M10 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM20 8v6M23 11h-6",
  support: "M21 11.5a8.4 8.4 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.4 8.4 0 0 1-3.8-.9L3 21l1.9-5.7a8.4 8.4 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.4 8.4 0 0 1 3.8-.9h.5a8.5 8.5 0 0 1 8 8z",
  users: "M16 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2M10 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM20 8v6M23 11h-6",
  import: "M12 15V3m0 0L8 7m4-4 4 4M5 13v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6",
  cohorts: "M3 7h18M6 3v4m12-4v4M5 11h4v4H5zM13 11h6v4h-6zM5 18h14",
  reports: "M4 20V10M10 20V4M16 20v-7M22 20H2",
  videos: "M4 5h11v14H4zM15 10l5-3v10l-5-3M7 9h5M7 13h3",
  audit: "M12 22s8-4 8-11V5l-8-3-8 3v6c0 7 8 11 8 11zM9 12l2 2 4-4",
  settings: "M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7zM19.4 15a1.7 1.7 0 0 0 .34 1.88l.06.06-1.7 2.94-.08-.02a1.7 1.7 0 0 0-1.72.38l-.06.06h-3.4l-.04-.08a1.7 1.7 0 0 0-1.48-1.02h-.08l-2.94-1.7.02-.08a1.7 1.7 0 0 0-.38-1.72l-.06-.06v-3.4l.08-.04a1.7 1.7 0 0 0 1.02-1.48v-.08l1.7-2.94.08.02a1.7 1.7 0 0 0 1.72-.38l.06-.06h3.4l.04.08a1.7 1.7 0 0 0 1.48 1.02h.08l2.94 1.7-.02.08a1.7 1.7 0 0 0 .38 1.72l.06.06z",
  access: "M12 22s8-4 8-11V5l-8-3-8 3v6c0 7 8 11 8 11zM9 12h6M12 9v6",
  home: "M3 10.5 12 3l9 7.5M5 9v12h14V9M9 21v-7h6v7",
  announcements: "M4 12v-2a2 2 0 0 1 2-2h2l8-4v16l-8-4H6a2 2 0 0 1-2-2v-2zM8 16l1 5h4l-2-4M18 9a4 4 0 0 1 0 6",
};

function NavIcon({ name }: { name: string }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.65" strokeLinecap="round" strokeLinejoin="round" className="h-[18px] w-[18px] shrink-0">
      <path d={iconPaths[name]} />
    </svg>
  );
}

function NavigationLinks({ onNavigate, supportUnreadCount }: { onNavigate?: () => void; supportUnreadCount: number }) {
  const pathname = usePathname();
  return (
    <nav aria-label="Admin sections" className="space-y-6">
      {sections.map((section) => (
        <section key={section.label} aria-label={section.label}>
          <h2 className="mb-2 px-3 text-[10px] font-bold uppercase tracking-[0.16em] text-[#758278] dark:text-[#abb8ae]">
            {section.label}
          </h2>
          <ul className="space-y-1">
            {section.links.map((link) => {
              const active = pathname === link.href || (link.href !== "/admin" && pathname.startsWith(`${link.href}/`));
              return (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    aria-current={active ? "page" : undefined}
                    onClick={onNavigate}
                    className={`group relative flex min-h-10 items-center gap-3 rounded-md px-3 text-[13px] font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#355f4c] dark:focus-visible:outline-[#d7bd7a] ${
                      active
                        ? "bg-[#355f4c] text-[#fffdf8] dark:bg-[#9abd9f] dark:text-[#17211d]"
                        : "text-[#46564c] hover:bg-[#e9eee8] hover:text-[#263b30] dark:text-[#d0d8d0] dark:hover:bg-[#2b3a32] dark:hover:text-white"
                    }`}
                  >
                    <span aria-hidden="true" className={`absolute bottom-2 left-0 top-2 w-[2px] rounded-full ${active ? "bg-[#d9bb78] dark:bg-[#3d6149]" : "bg-transparent"}`} />
                    <NavIcon name={link.icon} />
                    <span>{link.label}</span>
                    {link.href === "/admin/support" && <SupportUnreadBadge initialCount={supportUnreadCount} />}
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </nav>
  );
}

function SidebarBrand() {
  return (
    <div className="mb-6 flex items-center gap-3 border-b border-[#e3e6df] px-2 pb-5 dark:border-[#394941]">
      <span className="flex h-10 w-10 items-center justify-center rounded-md bg-[#355f4c] font-serif text-xl font-semibold text-[#fffdf8] dark:bg-[#9abd9f] dark:text-[#17211d]">Z</span>
      <div>
        <p className="font-semibold leading-tight text-[#26312d] dark:text-[#f2eee4]">Zitectitute</p>
        <p className="mt-1 text-[10px] font-semibold uppercase tracking-[0.15em] text-[#758278] dark:text-[#abb8ae]">Admin workspace</p>
      </div>
    </div>
  );
}

export default function AdminNav({ supportUnreadCount }: { supportUnreadCount: number }) {
  const [open, setOpen] = useState(false);
  const drawerRef = useRef<HTMLDivElement>(null);
  const menuButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const previousFocus = document.activeElement;
    drawerRef.current?.querySelector<HTMLElement>("a")?.focus();
    const handleKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        return;
      }
      if (event.key !== "Tab" || !drawerRef.current) return;
      const focusable = [...drawerRef.current.querySelectorAll<HTMLElement>("a[href], button:not([disabled])")];
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      if (previousFocus instanceof HTMLElement) previousFocus.focus();
    };
  }, [open]);

  return (
    <>
      <button
        ref={menuButtonRef}
        type="button"
        aria-expanded={open}
        onClick={() => setOpen(true)}
        className="mb-4 inline-flex min-h-11 items-center gap-2 rounded-md border border-[#d9d5ca] bg-[#fffdf8] px-4 text-sm font-semibold text-[#355f4c] shadow-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#355f4c] lg:hidden dark:border-[#394941] dark:bg-[#1e2b25] dark:text-[#d6e6d7] dark:focus-visible:outline-[#d7bd7a]"
      >
        <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" className="h-5 w-5">
          <path d="M4 6h16M4 12h16M4 18h16" />
        </svg>
        Admin menu
      </button>

      <aside className="hidden lg:sticky lg:top-6 lg:block lg:self-start">
        <div className="rounded-lg border border-[#d9d5ca] bg-[#fffdf8] p-3 dark:border-[#394941] dark:bg-[#1e2b25]">
          <SidebarBrand />
          <NavigationLinks supportUnreadCount={supportUnreadCount} />
          <div className="mt-6 border-t border-[#e3e6df] px-3 pt-4 dark:border-[#394941]">
            <p className="text-xs font-medium text-[#59685e] dark:text-[#c0c8bf]">Administration</p>
            <p className="mt-1 text-[11px] leading-5 text-[#758278] dark:text-[#abb8ae]">Manage learning, people and platform settings.</p>
          </div>
        </div>
      </aside>

      {open && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            type="button"
            aria-label="Close admin menu"
            onClick={() => setOpen(false)}
            className="absolute inset-0 cursor-default bg-[#15221b]/55"
          />
          <div
            id="admin-mobile-navigation"
            ref={drawerRef}
            role="dialog"
            aria-modal="true"
            aria-label="Admin navigation"
            className="relative flex h-full w-[min(20rem,calc(100vw-2.5rem))] flex-col overflow-y-auto border-r border-[#d9d5ca] bg-[#f5f3ed] p-4 shadow-xl dark:border-[#394941] dark:bg-[#17211d]"
          >
            <div className="mb-5 flex items-center justify-between">
              <SidebarBrand />
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close admin menu"
                className="mb-5 inline-flex h-10 w-10 items-center justify-center rounded-md text-[#46564c] hover:bg-[#e9eee8] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#355f4c] dark:text-[#d0d8d0] dark:hover:bg-[#2b3a32] dark:focus-visible:outline-[#d7bd7a]"
              >
                <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" className="h-5 w-5">
                  <path d="m6 6 12 12M18 6 6 18" />
                </svg>
              </button>
            </div>
            <NavigationLinks supportUnreadCount={supportUnreadCount} onNavigate={() => setOpen(false)} />
          </div>
        </div>
      )}
    </>
  );
}
