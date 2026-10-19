type LoginStreakCardProps = {
  currentStreak: number;
  longestStreak: number;
  lastLoginDay: string | null;
  recentLoginDays: string[];
  today: string;
};

function addDays(day: string, amount: number): string {
  const date = new Date(`${day}T12:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + amount);
  return date.toISOString().slice(0, 10);
}

function dayLabel(day: string): string {
  return new Intl.DateTimeFormat("en", { weekday: "short", timeZone: "UTC" })
    .format(new Date(`${day}T12:00:00.000Z`));
}

export default function LoginStreakCard({
  currentStreak,
  longestStreak,
  lastLoginDay,
  recentLoginDays,
  today,
}: LoginStreakCardProps) {
  const activeStreak = lastLoginDay && addDays(lastLoginDay, 1) < today ? 0 : currentStreak;
  const loggedToday = recentLoginDays.includes(today);
  const days = Array.from({ length: 7 }, (_, index) => addDays(today, index - 6));

  return (
    <section
      aria-labelledby="login-streak-heading"
      className="border-y border-[#d9d5ca] bg-[#f5f3ec] px-4 py-5 dark:border-[#394941] dark:bg-[#1e2b25] sm:px-6"
    >
      <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between sm:gap-8">
        <div className="flex min-w-0 items-center gap-4">
          <span aria-hidden="true" className="grid h-12 w-12 shrink-0 place-items-center border border-[#c7b67f] bg-[#f2e8ca] text-[#70571f] dark:border-[#776a49] dark:bg-[#393521] dark:text-[#e5cc8a]">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" className="h-6 w-6">
              <path d="M12 22c4.1 0 7-2.9 7-6.8 0-2.4-1.2-4.5-3.5-6.5-.1 2-1.2 3.1-2 3.5.2-3.6-1.6-6.7-5.2-9.2.4 3.4-.2 5.3-1.5 7.2C5.5 10.9 5 12.8 5 15.2 5 19.1 7.9 22 12 22Z" />
              <path d="M12 22c-1.8 0-3-1.3-3-3.1 0-1.2.6-2.3 2-3.4 0 1.1.5 1.7 1.2 2 .1-1.3.7-2.4 1.7-3.3.3 1.3 1.1 2.1 1.1 4.5 0 1.9-1.2 3.3-3 3.3Z" />
            </svg>
          </span>
          <div className="min-w-0">
            <h2 id="login-streak-heading" className="font-serif text-xl font-semibold text-[#26312d] dark:text-[#f2eee4]">
              Your login streak
            </h2>
            <p className="mt-1 text-sm leading-5 text-[#59685e] dark:text-[#c0c8bf]">
              {loggedToday
                ? "You showed up today. Come back tomorrow to keep it going."
                : activeStreak > 0
                  ? "Sign in today to keep this streak going."
                  : "A fresh start begins with your next sign-in."}
            </p>
          </div>
        </div>

        <div className="flex flex-col gap-4 sm:items-end">
          <p className="flex items-baseline gap-2 text-[#26312d] dark:text-[#f2eee4]">
            <span className="font-serif text-4xl font-semibold tabular-nums">{activeStreak}</span>
            <span className="text-sm font-medium">{activeStreak === 1 ? "day in a row" : "days in a row"}</span>
            <span className="ml-2 text-xs text-[#59685e] dark:text-[#c0c8bf]">Best: {longestStreak} days</span>
          </p>
          <ol aria-label="Login activity for the last seven days" className="grid grid-cols-7 gap-2">
            {days.map((day) => {
              const loggedIn = recentLoginDays.includes(day);
              const isToday = day === today;
              return (
                <li key={day} aria-label={`${dayLabel(day)} ${day}${loggedIn ? ", signed in" : ", no sign-in recorded"}`} className="flex min-w-8 flex-col items-center gap-1.5">
                  <span className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[#59685e] dark:text-[#c0c8bf]">{dayLabel(day)}</span>
                  <span
                    aria-hidden="true"
                    className={`grid h-7 w-7 place-items-center rounded-full border text-[11px] font-semibold tabular-nums ${
                      loggedIn
                        ? "border-[#355f4c] bg-[#355f4c] text-[#fffdf8] dark:border-[#9abd9f] dark:bg-[#9abd9f] dark:text-[#17211d]"
                        : isToday
                          ? "border-[#b18b3c] text-[#70571f] dark:border-[#d7bd7a] dark:text-[#e5cc8a]"
                          : "border-[#d9d5ca] text-[#849087] dark:border-[#526157] dark:text-[#9da99f]"
                    }`}
                  >
                    {loggedIn ? (
                      <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-3.5 w-3.5">
                        <path d="m3.5 8.5 3 3 6-7" />
                      </svg>
                    ) : (
                      new Date(`${day}T12:00:00.000Z`).getUTCDate()
                    )}
                  </span>
                </li>
              );
            })}
          </ol>
        </div>
      </div>
    </section>
  );
}
