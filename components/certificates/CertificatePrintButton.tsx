"use client";

export default function CertificatePrintButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="min-h-11 border border-[#355f4c] bg-[#355f4c] px-5 text-sm font-semibold text-[#fffdf8] hover:bg-[#294a3b] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#355f4c] print:hidden"
    >
      Print or save as PDF
    </button>
  );
}
