import Link from "next/link";
import { notFound } from "next/navigation";
import CertificatePrintButton from "@/components/certificates/CertificatePrintButton";
import { connectDB } from "@/lib/db";
import { Certificate } from "@/lib/models/LearningFeatures";

export const dynamic = "force-dynamic";

export default async function CertificateVerificationPage({
  params,
}: {
  params: Promise<{ serial: string }>;
}) {
  const { serial } = await params;
  if (!/^[\da-f-]{36}$/i.test(serial)) notFound();
  await connectDB();
  const certificate = await Certificate.findOne({ serial }).lean();
  if (!certificate) notFound();
  const issued = new Intl.DateTimeFormat("en", { dateStyle: "long", timeZone: "UTC" }).format(certificate.issuedAt);

  return (
    <>
      <main className="mx-auto max-w-5xl px-5 py-10 md:px-10 md:py-14 print:max-w-none print:px-0 print:py-0">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3 print:hidden">
          <Link href="/certificates" className="text-sm font-semibold text-[#355f4c] underline underline-offset-4 dark:text-[#b5c9b5]">My certificates</Link>
          <CertificatePrintButton />
        </div>
        <article className="relative overflow-hidden border-[10px] border-double border-[#9c7740] bg-[#fffdf8] px-7 py-12 text-center text-[#26312d] shadow-[0_14px_38px_rgba(38,49,45,0.12)] sm:px-14 sm:py-16 print:min-h-[7.5in] print:border-[10px] print:shadow-none">
          <div aria-hidden="true" className="absolute inset-[12px] border border-[#d9d5ca] print:inset-[12px]" />
          <div className="relative mx-auto max-w-3xl">
            <p className="font-serif text-sm font-semibold uppercase tracking-[0.22em] text-[#456b55]">Zitectitute</p>
            <h1 className="mt-12 font-serif text-4xl font-medium tracking-[-0.03em] sm:text-6xl">Certificate of completion</h1>
            <p className="mx-auto mt-8 max-w-[58ch] text-sm leading-7 text-[#59685e] sm:text-base">
              This certifies that
            </p>
            <p className="mt-2 font-serif text-3xl font-semibold text-[#26312d] sm:text-4xl">{certificate.learnerName}</p>
            <p className="mx-auto mt-6 max-w-[62ch] text-sm leading-7 text-[#59685e] sm:text-base">
              has completed the course
            </p>
            <p className="mt-2 font-serif text-2xl font-semibold text-[#355f4c] sm:text-3xl">{certificate.courseTitle}</p>
            <p className="mt-7 text-sm leading-6 text-[#59685e]">
              Final assessment result: {certificate.objectiveScore} of {certificate.objectiveTotal} objective questions correct.
            </p>
            <div className="mx-auto mt-12 grid max-w-xl gap-6 border-t border-[#d9d5ca] pt-5 text-left text-xs text-[#59685e] sm:grid-cols-2">
              <div><p className="font-semibold text-[#26312d]">Date issued</p><time dateTime={certificate.issuedAt.toISOString()}>{issued}</time></div>
              <div><p className="font-semibold text-[#26312d]">Certificate ID</p><p className="break-all font-mono">{certificate.serial}</p></div>
            </div>
            <p className="mt-6 text-xs text-[#59685e]">
              Verification link: <span className="break-all">{`/certificates/${certificate.serial}`}</span>
            </p>
          </div>
        </article>
        <p className="mx-auto mt-5 max-w-[70ch] text-center text-xs leading-5 text-[#59685e] dark:text-[#c0c8bf] print:hidden">
          This public page verifies that this certificate was issued by Zitectitute. Use your browser’s print option to save a PDF copy.
        </p>
      </main>
    </>
  );
}
