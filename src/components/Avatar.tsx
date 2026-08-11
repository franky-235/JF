const avatarColors = ["#6366f1", "#22d3ee", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6"];

function getInitials(name: string) {
  return name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2);
}

function colorFor(name: string) {
  const idx = name ? name.charCodeAt(0) % avatarColors.length : 0;
  return avatarColors[idx];
}

interface AvatarProps {
  name: string;
  avatarUrl?: string | null;
  size?: number;
  className?: string;
}

export default function Avatar({ name, avatarUrl, size = 32, className = "" }: AvatarProps) {
  const px = `${size}px`;
  if (avatarUrl) {
    return (
      <img
        src={avatarUrl}
        alt={name}
        title={name}
        className={`rounded-full object-cover shrink-0 ${className}`}
        style={{ width: px, height: px }}
      />
    );
  }
  return (
    <div
      title={name}
      className={`rounded-full flex items-center justify-center text-white font-semibold shrink-0 ${className}`}
      style={{ width: px, height: px, backgroundColor: colorFor(name), fontSize: Math.max(10, Math.round(size * 0.36)) }}
    >
      {getInitials(name || "?")}
    </div>
  );
}
