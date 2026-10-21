interface ToolActivityProps {
  activity: string | null;
}

export function ToolActivity({ activity }: ToolActivityProps) {
  if (!activity) return null;

  return (
    <div style={{
      display: "flex",
      alignItems: "center",
      gap: "6px",
      padding: "4px 12px",
      fontSize: "0.8125rem",
      color: "var(--text-muted)",
    }}>
      <div style={{
        width: "6px",
        height: "6px",
        borderRadius: "50%",
        background: "var(--primary)",
        animation: "pulse 1.5s infinite",
      }} />
      {activity}
      <style>{`@keyframes pulse { 0%,100% { opacity: 0.4; } 50% { opacity: 1; } }`}</style>
    </div>
  );
}
