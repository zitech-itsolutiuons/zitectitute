import type { Metadata } from "next";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { Source_Sans_3, Source_Serif_4 } from "next/font/google";
import { ThemeProvider } from "next-themes";
import { auth } from "@/auth";
import NetworkStatusNotice from "@/components/NetworkStatusNotice";
import ButtonLoadingFeedback from "@/components/ButtonLoadingFeedback";
import BrandPreloader from "@/components/BrandPreloader";
import PlatformRestrictionOverlay from "@/components/PlatformRestrictionOverlay";
import "./globals.css";

const sourceSans = Source_Sans_3({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-source-sans",
  display: "swap",
});

const sourceSerif = Source_Serif_4({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-source-serif",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Zitectitute | Web Design & Programming",
  description: "Learn web design, HTML, CSS, JavaScript, and computer science through structured instructor-led courses.",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const [session, requestHeaders] = await Promise.all([auth(), headers()]);
  const platformRestricted = session?.user.platformRestricted === true;
  const pathname = requestHeaders.get("x-pathname")?.replace(/\/+$/, "") || "/";
  if (platformRestricted && pathname !== "/courses") redirect("/courses");

  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${sourceSans.variable} ${sourceSerif.variable} font-sans antialiased`}>
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
          <div>
            <BrandPreloader />
            <div
              aria-hidden={platformRestricted}
              inert={platformRestricted}
              className={platformRestricted ? "pointer-events-none select-none opacity-35" : ""}
            >
              <NetworkStatusNotice />
              <ButtonLoadingFeedback />
              <div className="flex min-h-screen flex-col">
                <div className="flex-1">{children}</div>
                <footer className="mt-auto border-t border-slate-200 bg-white dark:border-slate-800 dark:bg-[#0b1220]">
                  <div className="mx-auto flex max-w-6xl flex-col gap-1 px-5 py-4 text-xs leading-5 text-slate-500 sm:flex-row sm:items-center sm:justify-between md:px-10">
                    <span className="font-serif text-sm font-semibold text-slate-700 dark:text-slate-200">Zitectitute</span>
                    <p>
                      Built by <span className="font-semibold text-slate-700 dark:text-slate-200">Zitechurity IT Solutions</span>
                    </p>
                  </div>
                </footer>
              </div>
            </div>
            {platformRestricted && <PlatformRestrictionOverlay />}
          </div>
        </ThemeProvider>
      </body>
    </html>
  );
}
