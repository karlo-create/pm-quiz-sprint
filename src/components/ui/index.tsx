import type { QuestionCategory, Difficulty } from "@/types";
import { CATEGORY_LABELS } from "@/types";

// ─── Badge ──────────────────────────────────────────────────────────────────
const CATEGORY_COLORS: Record<QuestionCategory, string> = {
  "product-management": "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  "ai-pm": "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200",
  "tech-basics": "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  "ux-ui": "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200",
};

const DIFFICULTY_COLORS: Record<Difficulty, string> = {
  easy: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200",
  medium: "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200",
  hard: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
};

export function CategoryBadge({ category }: { category: QuestionCategory }) {
  return (
    <span
      className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${CATEGORY_COLORS[category]}`}
    >
      {CATEGORY_LABELS[category]}
    </span>
  );
}

export function DifficultyBadge({ difficulty }: { difficulty: Difficulty }) {
  return (
    <span
      className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${DIFFICULTY_COLORS[difficulty]}`}
    >
      {difficulty}
    </span>
  );
}

// ─── Progress Bar ───────────────────────────────────────────────────────────
export function ProgressBar({
  current,
  total,
}: {
  current: number;
  total: number;
}) {
  const pct = total > 0 ? (current / total) * 100 : 0;
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-surface">
      <div
        className="h-full rounded-full bg-primary transition-all duration-300 ease-out"
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

// ─── Card ───────────────────────────────────────────────────────────────────
export function Card({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`rounded-xl border border-border bg-surface p-4 ${className}`}
    >
      {children}
    </div>
  );
}

// ─── Stat Card ──────────────────────────────────────────────────────────────
export function StatCard({
  label,
  value,
  sub,
}: {
  label: string;
  value: string | number;
  sub?: string;
}) {
  return (
    <Card className="flex flex-col items-center justify-center text-center">
      <p className="text-xs text-text-secondary">{label}</p>
      <p className="mt-1 text-2xl font-bold">{value}</p>
      {sub && <p className="text-xs text-text-secondary">{sub}</p>}
    </Card>
  );
}

// ─── Spinner ────────────────────────────────────────────────────────────────
export function Spinner({ className = "" }: { className?: string }) {
  return (
    <div
      className={`inline-block h-5 w-5 animate-spin rounded-full border-2 border-current border-r-transparent ${className}`}
      role="status"
    >
      <span className="sr-only">Loading...</span>
    </div>
  );
}

// ─── Button ─────────────────────────────────────────────────────────────────
interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "ghost" | "success" | "danger";
  size?: "sm" | "md" | "lg";
  loading?: boolean;
}

export function Button({
  variant = "primary",
  size = "md",
  loading,
  disabled,
  children,
  className = "",
  ...props
}: ButtonProps) {
  const base =
    "tap-target inline-flex items-center justify-center rounded-xl font-semibold transition-all active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none";

  const variants: Record<string, string> = {
    primary: "bg-primary text-white hover:bg-primary-hover",
    secondary: "bg-surface border border-border text-foreground hover:bg-border",
    ghost: "text-text-secondary hover:text-foreground hover:bg-surface",
    success: "bg-success text-white hover:opacity-90",
    danger: "bg-error text-white hover:opacity-90",
  };

  const sizes: Record<string, string> = {
    sm: "px-3 py-2 text-sm",
    md: "px-4 py-3 text-base",
    lg: "px-6 py-4 text-lg w-full",
  };

  return (
    <button
      className={`${base} ${variants[variant]} ${sizes[size]} ${className}`}
      disabled={disabled || loading}
      {...props}
    >
      {loading && <Spinner className="mr-2 h-4 w-4" />}
      {children}
    </button>
  );
}
