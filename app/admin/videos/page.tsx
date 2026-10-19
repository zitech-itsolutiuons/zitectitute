export const dynamic = "force-dynamic";

function configuredDomains() {
  return [...new Set((process.env.VIDEO_ALLOWED_DOMAINS ?? "")
    .split(",")
    .map((domain) => domain.trim().toLowerCase())
    .filter((domain) => /^[a-z\d.-]+(?::\d{1,5})?$/.test(domain)))];
}

export default function VideoProtectionPage() {
  const domains = configuredDomains();
  return (
    <section aria-labelledby="video-protection-heading" className="max-w-3xl space-y-6">
      <header className="border-b border-slate-200 pb-5">
        <h2 id="video-protection-heading" className="text-xl font-semibold text-slate-950">Video and course-media protection</h2>
        <p className="mt-2 text-sm leading-6 text-slate-600">Uploaded course images use one-hour signed URLs, are not cached, and reject requests from unapproved embedding domains. The site also sends an embedding policy to browsers.</p>
      </header>
      <div className="border border-slate-200 bg-white p-5">
        <h3 className="font-semibold text-slate-900">Allowed site domains</h3>
        {domains.length ? (
          <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-slate-700">{domains.map((domain) => <li key={domain}><code>{domain}</code></li>)}</ul>
        ) : (
          <p className="mt-3 text-sm text-slate-600">No extra domains configured. Same-origin embedding is allowed by default.</p>
        )}
        <p className="mt-4 text-sm leading-6 text-slate-600">Set <code>VIDEO_ALLOWED_DOMAINS</code> to a comma-separated list of exact host names (for example <code>learn.example.edu,portal.example.edu</code>) in the server environment, then restart/redeploy the app. Do not include URL paths or wildcards.</p>
      </div>
      <div className="border-l-2 border-amber-500 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-950">
        YouTube and Vimeo streams are delivered by those providers, not stored by this app. The app sends its origin as the referrer for external players; configure the same allowed domains in the provider’s own embed/privacy settings to prevent playback outside this site. Direct video file hosts must enforce their own hotlink policy.
      </div>
    </section>
  );
}
