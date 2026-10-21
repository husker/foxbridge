import type { Theme } from "../types.js";

interface ThemeToggleProps {
  theme: Theme;
  onToggle: () => void;
}

export function ThemeToggle({ theme, onToggle }: ThemeToggleProps) {
  return (
    <button
      onClick={onToggle}
      style={{
        background: "none",
        border: "1px solid var(--border)",
        borderRadius: "4px",
        padding: "4px 8px",
        fontSize: "0.8125rem",
        color: "var(--text-secondary)",
        cursor: "pointer",
      }}
      title={`Switch to ${theme === "light" ? "dark" : "light"} mode`}
    >
      {theme === "light" ? "Dark mode" : "Light mode"}
    </button>
  );
}
