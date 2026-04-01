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
  colorClass = "bg-primary",
}: {
  current: number;
  total: number;
  colorClass?: string;
}) {
  const pct = total > 0 ? (current / total) * 100 : 0;
  return (
    <div className="h-2.5 w-full overflow-hidden rounded-full bg-border">
      <div
        className={`h-full rounded-full ${colorClass} transition-all duration-500 ease-out`}
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
  icon,
  accent,
}: {
  label: string;
  value: string | number;
  sub?: string;
  icon?: string;
  accent?: "streak" | "accuracy" | "default";
}) {
  const accentClasses: Record<string, string> = {
    streak: "border-amber-300 bg-amber-50 dark:border-amber-700 dark:bg-amber-950/40",
    accuracy: "border-indigo-200 bg-indigo-50 dark:border-indigo-800 dark:bg-indigo-950/40",
    default: "",
  };
  const valueClasses: Record<string, string> = {
    streak: "text-amber-600 dark:text-amber-400",
    accuracy: "text-indigo-600 dark:text-indigo-400",
    default: "",
  };

  const accentKey = accent ?? "default";

  return (
    <Card className={`flex flex-col items-center justify-center text-center py-3 ${accentClasses[accentKey]}`}>
      {icon && (
        <span className="mb-1 text-xl leading-none">{icon}</span>
      )}
      <p className="text-xs text-text-secondary">{label}</p>
      <p className={`mt-0.5 text-2xl font-bold ${valueClasses[accentKey]}`}>{value}</p>
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
    "tap-target inline-flex items-center justify-center rounded-xl font-semibold transition-all active:scale-[0.97] disabled:opacity-50 disabled:pointer-events-none";

  const variants: Record<string, string> = {
    primary: "bg-primary text-white hover:bg-primary-hover shadow-sm hover:shadow-md",
    secondary: "bg-surface border border-border text-foreground hover:bg-border",
    ghost: "text-text-secondary hover:text-foreground hover:bg-surface",
    success: "bg-success text-white hover:opacity-90 shadow-sm",
    danger: "bg-error text-white hover:opacity-90 shadow-sm",
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

// ─── Score Ring ─────────────────────────────────────────────────────────────
export function ScoreRing({ percentage }: { percentage: number }) {
  const colorClass =
    percentage >= 70
      ? "text-success"
      : percentage >= 40
        ? "text-warning"
        : "text-error";

  return (
    <div className="relative h-32 w-32">
      <svg className="h-full w-full -rotate-90" viewBox="0 0 36 36">
        <path
          className="text-border"
          stroke="currentColor"
          strokeWidth="3"
          fill="none"
          d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
        />
        <path
          className={`${colorClass} animate-score-ring`}
          stroke="currentColor"
          strokeWidth="3"
          strokeDasharray={`${percentage}, 100`}
          strokeLinecap="round"
          fill="none"
          d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-xl font-bold">{percentage}%</span>
      </div>
    </div>
  );
}
