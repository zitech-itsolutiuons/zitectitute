import Link from "next/link";
import { redirect } from "next/navigation";
import { getUserId } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import { Certificate } from "@/lib/models/LearningFeatures";

export const dynamic = "force-dynamic";

export default async function CertificatesPage() {
  const userId = await getUserId();
  if (!userId) redirect("/signin");
  await connectDB();
  const certificates = await Certificate.find({ userId }).sort({ issuedAt: -1 }).lean();
  return (
    <>
      <main className="mx-auto min-h-[70vh] max-w-5xl px-5 py-10 md:px-10 md:py-14">
        <h1 className="font-serif text-3xl font-semibold tracking-[-0.025em] text-[#26312d] dark:text-[#f2eee4]">My certificates</h1>
        <p className="mt-2 max-w-[65ch] text-sm leading-6 text-[#59685e] dark:text-[#c0c8bf]">Certificates are issued after every lesson is completed and the final assessment is passed.</p>
        {certificates.length === 0 ? (
          <div className="mt-8 border-y border-[#d9d5ca] py-8 dark:border-[#394941]">
            <h2 className="font-serif text-xl font-semibold">No certificates yet</h2>
            <p className="mt-2 text-sm leading-6 text-[#59685e] dark:text-[#c0c8bf]">Complete every course lesson and pass the final assessment to earn a certificate.</p>
            <Link href="/courses" className="mt-4 inline-flex min-h-10 items-center border border-[#355f4c] px-4 text-sm font-semibold text-[#355f4c] hover:bg-[#e9f0e8] dark:border-[#9abd9f] dark:text-[#b5c9b5] dark:hover:bg-[#2b3a32]">Browse courses</Link>
          </div>
        ) : (
          <ol className="mt-7 divide-y divide-[#d9d5ca] border-y border-[#d9d5ca] dark:divide-[#394941] dark:border-[#394941]">
            {certificates.map((certificate) => (
              <li key={String(certificate._id)} className="flex flex-wrap items-center justify-between gap-4 py-5">
                <div>
                  <h2 className="font-serif text-xl font-semibold">{certificate.courseTitle}</h2>
                  <p className="mt-1 text-sm text-[#59685e] dark:text-[#c0c8bf]">
                    Issued {new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(certificate.issuedAt)}
                  </p>
                </div>
                <Link href={`/certificates/${certificate.serial}`} className="text-sm font-semibold text-[#355f4c] underline underline-offset-4 dark:text-[#b5c9b5]">View certificate</Link>
              </li>
            ))}
          </ol>
        )}
      </main>
    </>
  );
}
