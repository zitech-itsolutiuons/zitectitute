import { signIn } from "@/auth";

const btn =
  "w-full border border-blue-200 bg-white px-4 py-3 text-left text-sm font-medium text-blue-700 hover:bg-blue-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600";

/** Renders one button per configured OAuth provider, and nothing when none are configured. */
export default function OAuthButtons({ redirectTo }: { redirectTo: string }) {
  const providers = [
    process.env.AUTH_GOOGLE_ID && { id: "google", label: "Continue with Google" },
    process.env.AUTH_GITHUB_ID && { id: "github", label: "Continue with GitHub" },
  ].filter(Boolean) as { id: string; label: string }[];
  if (providers.length === 0) return null;

  return (
    <div className="mt-8 space-y-3 border-0 border-t border-zinc-300 pt-8 dark:border-zinc-800">
      {providers.map((p) => (
        <form
          key={p.id}
          action={async () => {
            "use server";
            await signIn(p.id, { redirectTo });
          }}
        >
          <button type="submit" className={btn}>
            {p.label}
          </button>
        </form>
      ))}
    </div>
  );
}
