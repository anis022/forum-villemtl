export function CharacterCounter({ count, max }: { count: number; max: number }) {
  return (
    <span
      aria-hidden="true"
      className="pointer-events-none absolute right-3 bottom-2 rounded-md bg-white/90 px-1.5 py-0.5 text-[12px] leading-4 font-semibold text-[#6e6a72] tabular-nums"
    >
      {count}/{max}
    </span>
  );
}
