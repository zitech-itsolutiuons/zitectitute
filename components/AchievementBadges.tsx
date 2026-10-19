import type { AchievementBadgeMetric } from "@/lib/achievementBadges";

function BadgeSeal({ earned }: { earned: boolean }) {
  return (
    <span
      aria-hidden="true"
      className={`grid h-9 w-9 shrink-0 place-items-center border ${
        earned
          ? "border-[#c7b67f] bg-[#f2e8ca] text-[#70571f] dark:border-[#776a49] dark:bg-[#393521] dark:text-[#e5cc8a]"
          : "border-[#d9d5ca] bg-[#eeece4] text-[#849087] dark:border-[#526157] dark:bg-[#26352e] dark:text-[#9da99f]"
      }`}
    >
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
        <path d="m12 2 2.7 2.1 3.4-.1.9 3.3 2.7 2.1-1.2 3.2.8 3.3-3 1.5-1.5 3-3.3-.8-3.2 1.2-2.1-2.7-3.3-.9.1-3.4L3 12l2.1-2.7L5 5.9l3.3-.9L10.4 2l1.6 0Z" />
        <path d="m8.5 12 2.2 2.2 4.8-4.8" />
      </svg>
    </span>
  );
}

export default function AchievementBadges({ metrics }: { metrics: AchievementBadgeMetric[] }) {
  return (
    <section
      aria-labelledby="achievement-badges-heading"
      className="border-y border-[#d9d5ca] bg-[#f5f3ec] px-4 py-5 dark:border-[#394941] dark:bg-[#1e2b25] sm:px-6"
    >
      <header className="mb-5">
        <h2 id="achievement-badges-heading" className="font-serif text-xl font-semibold text-[#26312d] dark:text-[#f2eee4]">
          Your achievement badges
        </h2>
        <p className="mt-1 text-sm leading-5 text-[#59685e] dark:text-[#c0c8bf]">
          Earned as you show up, finish modules, and complete courses.
        </p>
      </header>
      <div className="grid gap-x-8 gap-y-6 md:grid-cols-2 xl:grid-cols-3">
        {metrics.map((metric) => (
          <section key={metric.key} aria-labelledby={`badge-${metric.key}-heading`}>
            <div className="flex items-baseline justify-between gap-3 border-b border-[#d9d5ca] pb-2 dark:border-[#394941]">
              <h3 id={`badge-${metric.key}-heading`} className="text-sm font-semibold text-[#26312d] dark:text-[#f2eee4]">
                {metric.label}
              </h3>
              <p className="text-xs tabular-nums text-[#59685e] dark:text-[#c0c8bf]">
                {metric.value} {metric.value === 1 ? metric.singularUnit : metric.unit}
              </p>
            </div>
            <ul className="mt-2 divide-y divide-[#e4e0d6] dark:divide-[#303f37]">
              {metric.tiers.map((tier) => {
                const earned = metric.value >= tier.threshold;
                return (
                  <li key={tier.name} className="flex min-h-14 items-center gap-3 py-2">
                    <BadgeSeal earned={earned} />
                    <div className="min-w-0 flex-1">
                      <p className={`text-sm font-medium ${earned ? "text-[#26312d] dark:text-[#f2eee4]" : "text-[#59685e] dark:text-[#c0c8bf]"}`}>
                        {tier.name}
                      </p>
                      <p className="text-xs text-[#59685e] dark:text-[#c0c8bf]">
                        {tier.threshold} {tier.threshold === 1 ? metric.singularUnit : metric.unit}
                      </p>
                    </div>
                    <span className={`shrink-0 text-xs font-semibold ${earned ? "text-[#355f4c] dark:text-[#b5c9b5]" : "text-[#849087] dark:text-[#9da99f]"}`}>
                      {earned ? "Earned" : "Locked"}
                    </span>
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
      </div>
    </section>
  );
}
