"use client";

export function BackToTop({ label }: { label: string }) {
  return (
    <button
      type="button"
      onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
      /* Underlined text in the footer reads as a link, not a button, so it
         keeps the small base-layer radius rather than a pill ring. The padding
         is what carries it to a thumb-sized target — the label is 12px and on
         its own would be a 16px-tall thing to hit. */
      className="inline-flex min-h-[40px] shrink-0 items-center whitespace-nowrap px-2.5 py-3 text-[12px] font-bold leading-[16px] text-[#6e6a72] transition-colors hover:text-[#fa3250] hover:underline"
    >
      {label}
    </button>
  );
}
