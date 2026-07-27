"use client";

export function BackToTop({ label }: { label: string }) {
  return (
    <button
      type="button"
      onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
      className="rounded-[4px] px-2 py-1 text-[12px] font-bold leading-[16px] text-white hover:underline"
    >
      {label}
    </button>
  );
}
