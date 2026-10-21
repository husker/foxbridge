import { useState, useCallback } from "react";

interface SetupWizardProps {
  onComplete: () => void;
}

interface WizardState {
  // Step 1: Atlassian
  atlassian_platform: "datacenter";
  atlassian_base_url: string;
  atlassian_auth_method: "basic" | "pat";
  // Step 2: AI
  ai_provider: "anthropic" | "openai" | "azure_openai" | "ollama";
  ai_api_key: string;
  ai_base_url: string;
  ai_model: string;
  // Step 3: Features
  features_jira_read: boolean;
  features_jira_write: boolean;
  features_confluence_read: boolean;
  features_confluence_write: boolean;
  features_bitbucket_read: boolean;
  features_bitbucket_write: boolean;
  features_assets_read: boolean;
}

const INITIAL_STATE: WizardState = {
  atlassian_platform: "datacenter",
  atlassian_base_url: "",
  atlassian_auth_method: "pat",
  ai_provider: "anthropic",
  ai_api_key: "",
  ai_base_url: "",
  ai_model: "",
  features_jira_read: true,
  features_jira_write: false,
  features_confluence_read: true,
  features_confluence_write: false,
  features_bitbucket_read: false,
  features_bitbucket_write: false,
  features_assets_read: false,
};

const STEPS = ["Data Center", "AI Provider", "Features", "Review"];


export function SetupWizard({ onComplete }: SetupWizardProps) {
  const [step, setStep] = useState(0);
  const [state, setState] = useState<WizardState>(INITIAL_STATE);
  const [saving, setSaving] = useState(false);
  const [restarting, setRestarting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const update = useCallback(
    <K extends keyof WizardState>(key: K, value: WizardState[K]) => {
      setState((prev) => ({ ...prev, [key]: value }));
    },
    [],
  );

  const canAdvance = (): boolean => {
    if (step === 0) {
      if (!state.atlassian_base_url.trim()) return false;
      try {
        new URL(state.atlassian_base_url);
      } catch {
        return false;
      }
      return true;
    }
    if (step === 1) {
      if (state.ai_provider !== "ollama" && !state.ai_api_key.trim()) return false;
      if ((state.ai_provider === "ollama" || state.ai_provider === "azure_openai") && !state.ai_base_url.trim()) return false;
      return true;
    }
    return true;
  };

  const handleSave = useCallback(async () => {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/setup/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(state),
      });
      const body = await res.json();
      if (!res.ok) {
        setError(body.error ?? "Failed to save");
        setSaving(false);
        return;
      }

      // Trigger restart
      setRestarting(true);
      await fetch("/api/setup/restart", { method: "POST" }).catch(() => {});

      // Poll healthz until server comes back with non-setup status
      const poll = async () => {
        for (let i = 0; i < 30; i++) {
          await new Promise((r) => setTimeout(r, 2000));
          try {
            const hr = await fetch("/healthz");
            const hb = await hr.json();
            if (hb.status !== "setup_required") {
              onComplete();
              return;
            }
          } catch {
            // Server is restarting, keep polling
          }
        }
        setError("Server did not restart within 60 seconds. Try refreshing the page.");
        setRestarting(false);
      };
      poll();
    } catch (err: any) {
      setError(err.message ?? "Failed to save");
      setSaving(false);
    }
  }, [state, onComplete]);

  if (restarting) {
    return (
      <div style={styles.container}>
        <div style={styles.card}>
          <h1 style={styles.title}>Foxbridge</h1>
          <p style={styles.subtitle}>Configuration saved! Restarting...</p>
          <div style={styles.spinner} />
          <p style={{ ...styles.hint, textAlign: "center" as const }}>
            This usually takes a few seconds.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <div style={{ ...styles.card, maxWidth: "520px" }}>
        <h1 style={styles.title}>Foxbridge Setup</h1>
        <p style={styles.subtitle}>Configure your Atlassian Data Center AI assistant</p>

        {/* Progress bar */}
        <div style={styles.progressBar}>
          {STEPS.map((name, i) => (
            <div
              key={name}
              style={{
                ...styles.progressStep,
                ...(i <= step ? styles.progressStepActive : {}),
                ...(i === step ? styles.progressStepCurrent : {}),
              }}
            >
              {i + 1}. {name}
            </div>
          ))}
        </div>

        {error && <div style={styles.error}>{error}</div>}

        {/* Step 1: Atlassian Data Center */}
        {step === 0 && (
          <div>
            <label style={styles.label}>Base URL</label>
            <input
              style={styles.input}
              type="url"
              placeholder="https://jira.yourcompany.com"
              value={state.atlassian_base_url}
              onChange={(e) => update("atlassian_base_url", e.target.value)}
            />

            <label style={styles.label}>Auth Method</label>
            <select
              style={styles.input}
              value={state.atlassian_auth_method}
              onChange={(e) => update("atlassian_auth_method", e.target.value as "basic" | "pat")}
            >
              <option value="pat">Personal Access Token</option>
              <option value="basic">Username + Password</option>
            </select>
          </div>
        )}

        {/* Step 2: AI Provider */}
        {step === 1 && (
          <div>
            <label style={styles.label}>AI Provider</label>
            <select
              style={styles.input}
              value={state.ai_provider}
              onChange={(e) => update("ai_provider", e.target.value as WizardState["ai_provider"])}
            >
              <option value="anthropic">Anthropic (Claude)</option>
              <option value="openai">OpenAI</option>
              <option value="azure_openai">Azure OpenAI</option>
              <option value="ollama">Ollama (local)</option>
            </select>

            {state.ai_provider !== "ollama" && (
              <>
                <label style={styles.label}>API Key</label>
                <input
                  style={styles.input}
                  type="password"
                  placeholder={state.ai_provider === "anthropic" ? "sk-ant-..." : "sk-..."}
                  value={state.ai_api_key}
                  onChange={(e) => update("ai_api_key", e.target.value)}
                />
              </>
            )}

            {(state.ai_provider === "ollama" || state.ai_provider === "azure_openai") && (
              <>
                <label style={styles.label}>Base URL</label>
                <input
                  style={styles.input}
                  type="url"
                  placeholder={state.ai_provider === "ollama" ? "http://host.docker.internal:11434" : "https://your-resource.openai.azure.com"}
                  value={state.ai_base_url}
                  onChange={(e) => update("ai_base_url", e.target.value)}
                />
              </>
            )}

            <label style={styles.label}>Model (optional)</label>
            <input
              style={styles.input}
              placeholder="Leave blank for default"
              value={state.ai_model}
              onChange={(e) => update("ai_model", e.target.value)}
            />
          </div>
        )}

        {/* Step 3: Features */}
        {step === 2 && (
          <div>
            <p style={styles.hint}>Choose which Atlassian products to connect.</p>

            <div style={styles.featureGroup}>
              <strong>Jira</strong>
              <label style={styles.checkboxLabel}>
                <input type="checkbox" checked={state.features_jira_read} onChange={(e) => update("features_jira_read", e.target.checked)} />
                Read (search, view issues)
              </label>
              <label style={styles.checkboxLabel}>
                <input type="checkbox" checked={state.features_jira_write} onChange={(e) => update("features_jira_write", e.target.checked)} />
                Write (create, update issues)
              </label>
            </div>

            <div style={styles.featureGroup}>
              <strong>Confluence</strong>
              <label style={styles.checkboxLabel}>
                <input type="checkbox" checked={state.features_confluence_read} onChange={(e) => update("features_confluence_read", e.target.checked)} />
                Read (search, view pages)
              </label>
              <label style={styles.checkboxLabel}>
                <input type="checkbox" checked={state.features_confluence_write} onChange={(e) => update("features_confluence_write", e.target.checked)} />
                Write (create, update pages)
              </label>
            </div>

            <div style={styles.featureGroup}>
              <strong>Bitbucket</strong>
              <label style={styles.checkboxLabel}>
                <input type="checkbox" checked={state.features_bitbucket_read} onChange={(e) => update("features_bitbucket_read", e.target.checked)} />
                Read (repos, PRs)
              </label>
              <label style={styles.checkboxLabel}>
                <input type="checkbox" checked={state.features_bitbucket_write} onChange={(e) => update("features_bitbucket_write", e.target.checked)} />
                Write (comments, approvals)
              </label>
            </div>

            <div style={styles.featureGroup}>
              <strong>Assets (Insight)</strong>
              <label style={styles.checkboxLabel}>
                <input type="checkbox" checked={state.features_assets_read} onChange={(e) => update("features_assets_read", e.target.checked)} />
                Read (search objects)
              </label>
            </div>
          </div>
        )}

        {/* Step 4: Review */}
        {step === 3 && (
          <div>
            <table style={styles.reviewTable}>
              <tbody>
                <tr><td style={styles.reviewLabel}>Platform</td><td>Data Center</td></tr>
                <tr><td style={styles.reviewLabel}>Base URL</td><td>{state.atlassian_base_url}</td></tr>
                <tr><td style={styles.reviewLabel}>Auth</td><td>{state.atlassian_auth_method === "pat" ? "Personal Access Token" : "Basic Auth"}</td></tr>
                <tr><td style={styles.reviewLabel}>AI Provider</td><td>{state.ai_provider}</td></tr>
                <tr><td style={styles.reviewLabel}>AI Key</td><td>{state.ai_api_key ? "****" + state.ai_api_key.slice(-4) : "(none)"}</td></tr>
                <tr><td style={styles.reviewLabel}>Jira</td><td>{state.features_jira_read ? "read" : ""}{state.features_jira_write ? "/write" : ""}</td></tr>
                <tr><td style={styles.reviewLabel}>Confluence</td><td>{state.features_confluence_read ? "read" : ""}{state.features_confluence_write ? "/write" : ""}</td></tr>
                <tr><td style={styles.reviewLabel}>Bitbucket</td><td>{state.features_bitbucket_read ? "read" : ""}{state.features_bitbucket_write ? "/write" : ""}</td></tr>
              </tbody>
            </table>
          </div>
        )}

        {/* Navigation */}
        <div style={styles.navRow}>
          {step > 0 && (
            <button style={styles.backButton} onClick={() => setStep(step - 1)}>
              Back
            </button>
          )}
          <div style={{ flex: 1 }} />
          {step < STEPS.length - 1 ? (
            <button
              style={{ ...styles.button, opacity: canAdvance() ? 1 : 0.5 }}
              disabled={!canAdvance()}
              onClick={() => setStep(step + 1)}
            >
              Next
            </button>
          ) : (
            <button
              style={styles.button}
              disabled={saving}
              onClick={handleSave}
            >
              {saving ? "Saving..." : "Save and Restart"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

const styles = {
  container: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    minHeight: "100vh",
    background: "#f5f5f5",
  } as const,
  card: {
    background: "#fff",
    borderRadius: "8px",
    padding: "2rem",
    boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
    width: "100%",
    maxWidth: "520px",
  } as const,
  title: {
    fontSize: "1.75rem",
    fontWeight: 700,
    marginBottom: "0.25rem",
    color: "#1a1a1a",
  } as const,
  subtitle: {
    fontSize: "1rem",
    color: "#666",
    marginBottom: "1.5rem",
  } as const,
  label: {
    display: "block",
    fontSize: "0.875rem",
    fontWeight: 500,
    marginBottom: "0.25rem",
    color: "#333",
  } as const,
  input: {
    width: "100%",
    padding: "0.5rem 0.75rem",
    border: "1px solid #ccc",
    borderRadius: "4px",
    fontSize: "0.875rem",
    marginBottom: "0.75rem",
    outline: "none",
    boxSizing: "border-box" as const,
  } as const,
  button: {
    padding: "0.625rem 1.5rem",
    background: "#0052cc",
    color: "#fff",
    border: "none",
    borderRadius: "4px",
    fontSize: "0.875rem",
    fontWeight: 600,
    cursor: "pointer",
  } as const,
  backButton: {
    padding: "0.625rem 1.5rem",
    background: "transparent",
    color: "#666",
    border: "1px solid #ccc",
    borderRadius: "4px",
    fontSize: "0.875rem",
    cursor: "pointer",
  } as const,
  progressBar: {
    display: "flex",
    gap: "0.25rem",
    marginBottom: "1.5rem",
    flexWrap: "wrap" as const,
  } as const,
  progressStep: {
    fontSize: "0.75rem",
    padding: "0.25rem 0.5rem",
    borderRadius: "3px",
    background: "#eee",
    color: "#999",
  } as const,
  progressStepActive: {
    background: "#e3edff",
    color: "#0052cc",
  } as const,
  progressStepCurrent: {
    background: "#0052cc",
    color: "#fff",
    fontWeight: 600,
  } as const,
  error: {
    background: "#fef2f2",
    color: "#dc2626",
    padding: "0.75rem",
    borderRadius: "4px",
    marginBottom: "1rem",
    fontSize: "0.875rem",
  } as const,
  hint: {
    fontSize: "0.8rem",
    color: "#888",
    marginTop: "-0.25rem",
    marginBottom: "0.75rem",
  } as const,
  radioGroup: {
    display: "flex",
    gap: "1rem",
    marginBottom: "0.75rem",
  } as const,
  radioLabel: {
    display: "flex",
    alignItems: "center",
    gap: "0.375rem",
    fontSize: "0.875rem",
    cursor: "pointer",
  } as const,
  checkboxLabel: {
    display: "flex",
    alignItems: "center",
    gap: "0.375rem",
    fontSize: "0.875rem",
    marginBottom: "0.375rem",
    cursor: "pointer",
  } as const,
  featureGroup: {
    marginBottom: "1rem",
    paddingBottom: "0.75rem",
    borderBottom: "1px solid #eee",
  } as const,
  navRow: {
    display: "flex",
    gap: "0.5rem",
    marginTop: "1.5rem",
  } as const,
  reviewTable: {
    width: "100%",
    fontSize: "0.875rem",
    borderCollapse: "collapse" as const,
  } as const,
  reviewLabel: {
    fontWeight: 600,
    color: "#555",
    padding: "0.375rem 0.5rem 0.375rem 0",
    borderBottom: "1px solid #eee",
    width: "120px",
  } as const,
  spinner: {
    width: "2rem",
    height: "2rem",
    border: "3px solid #eee",
    borderTopColor: "#0052cc",
    borderRadius: "50%",
    margin: "1rem auto",
    animation: "spin 0.8s linear infinite",
  } as const,
};
