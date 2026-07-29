"use client";

export function BackToTop({ label }: { label: string }) {
  return (
    <button
      type="button"
      onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
      className="rounded-full px-2.5 py-1 text-[12px] font-bold leading-[16px] text-white hover:underline"
    >
      {label}
    </button>
  );
}
