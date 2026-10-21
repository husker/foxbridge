interface FileChipProps {
  file: File;
  onRemove: () => void;
}

const typeIcons: Record<string, string> = {
  "text/csv": "spreadsheet",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "spreadsheet",
  "application/vnd.ms-excel": "spreadsheet",
  "application/pdf": "pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "doc",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation": "slides",
  "image/png": "image",
  "image/jpeg": "image",
  "text/plain": "text",
  "text/markdown": "text",
};

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function FileChip({ file, onRemove }: FileChipProps) {
  const label = typeIcons[file.type] ?? "file";
  const name =
    file.name.length > 25 ? file.name.slice(0, 22) + "..." : file.name;

  return (
    <div
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "6px",
        padding: "4px 8px 4px 6px",
        background: "var(--bg-prompt)",
        borderRadius: "8px",
        fontSize: "12px",
        color: "var(--text)",
        maxWidth: "200px",
      }}
    >
      <span
        style={{
          fontSize: "10px",
          color: "var(--text-muted)",
          textTransform: "uppercase",
          fontWeight: 600,
          flexShrink: 0,
        }}
      >
        {label}
      </span>
      <span
        style={{
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}
      >
        {name}
      </span>
      <span
        style={{
          color: "var(--text-muted)",
          fontSize: "10px",
          flexShrink: 0,
        }}
      >
        {formatSize(file.size)}
      </span>
      <button
        onClick={onRemove}
        style={{
          background: "none",
          border: "none",
          cursor: "pointer",
          color: "var(--text-muted)",
          fontSize: "14px",
          padding: "0 2px",
          lineHeight: 1,
          flexShrink: 0,
        }}
      >
        x
      </button>
    </div>
  );
}
