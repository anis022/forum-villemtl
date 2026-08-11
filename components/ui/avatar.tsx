import Image from "next/image";

/**
 * A face for every author.
 *
 * Almost nobody will have uploaded a photo, so the fallback is the real
 * default and has to look deliberate rather than broken: initials on a colour
 * derived from the user id, so the same person is always the same colour and
 * a thread of replies stays visually distinguishable.
 */

export type AvatarPerson = {
  id: string;
  firstName: string;
  lastName: string;
  avatarUrl: string | null;
};

/**
 * Eight colours that carry white initials and stay apart from each other in a
 * thread. Weighted toward the brand's purples and blues without ever being the
 * accent itself: a face the exact colour of the primary button reads as a
 * control, and the whole point of the fallback is that it reads as a person.
 */
const PALETTE = [
  "#3b2a8f",
  "#7a2f8f",
  "#a41f3c",
  "#b8660a",
  "#0b6042",
  "#1f6f8b",
  "#5c4a7d",
  "#8f2f5e",
];

function colorFor(id: string): string {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
  return PALETTE[hash % PALETTE.length];
}

export function initials(firstName: string, lastName: string): string {
  const a = firstName.trim()[0] ?? "";
  const b = lastName.trim()[0] ?? "";
  return (a + b).toUpperCase() || "?";
}

const SIZES = { sm: 28, md: 40, lg: 64 } as const;

export function Avatar({
  person,
  size = "md",
  className = "",
}: {
  person: AvatarPerson;
  size?: keyof typeof SIZES;
  className?: string;
}) {
  const px = SIZES[size];
  const shared = `shrink-0 rounded-full object-cover ${className}`;

  if (person.avatarUrl) {
    return (
      <Image
        src={person.avatarUrl}
        alt=""
        width={px}
        height={px}
        className={`${shared} border-[0.8px] border-[#e9e0d6]`}
        style={{ width: px, height: px }}
      />
    );
  }

  return (
    <span
      aria-hidden="true"
      className={`${shared} inline-flex items-center justify-center font-bold text-white`}
      style={{
        width: px,
        height: px,
        background: colorFor(person.id),
        fontSize: Math.round(px * 0.38),
      }}
    >
      {initials(person.firstName, person.lastName)}
    </span>
  );
}

/**
 * Overlapping avatars for the people backing an issue. Reads as a crowd at a
 * glance, which a bare number never does.
 */
export function FacePile({
  people,
  total,
  size = "sm",
}: {
  people: AvatarPerson[];
  total: number;
  size?: keyof typeof SIZES;
}) {
  if (!people.length) return null;
  const extra = total - people.length;

  return (
    <span className="inline-flex items-center">
      <span className="flex -space-x-2">
        {people.map((p) => (
          <Avatar
            key={p.id}
            person={p}
            size={size}
            className="ring-2 ring-white"
          />
        ))}
      </span>
      {extra > 0 && (
        <span className="ml-2 text-[13px] text-[#6e6a72]">+{extra}</span>
      )}
    </span>
  );
}
