import { useState } from "react";
import type { FormEvent } from "react";
import type { LoginCredentials } from "../types.js";

interface LoginFormProps {
  onLogin: (credentials: LoginCredentials) => void;
  error: string | null;
  loading: boolean;
  oauthEnabled: boolean;
  platform: string;
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
    maxWidth: "400px",
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
    fontSize: "1rem",
    fontWeight: 500,
    marginBottom: "0.25rem",
    color: "#333",
  } as const,
  input: {
    width: "100%",
    padding: "0.5rem 0.75rem",
    border: "1px solid #ccc",
    borderRadius: "4px",
    fontSize: "1rem",
    marginBottom: "1rem",
    outline: "none",
  } as const,
  button: {
    width: "100%",
    padding: "0.625rem",
    background: "#0052cc",
    color: "#fff",
    border: "none",
    borderRadius: "4px",
    fontSize: "1rem",
    fontWeight: 600,
    cursor: "pointer",
  } as const,
  buttonDisabled: {
    opacity: 0.6,
    cursor: "not-allowed",
  } as const,
  error: {
    background: "#ffeef0",
    color: "#c00",
    padding: "0.5rem 0.75rem",
    borderRadius: "4px",
    fontSize: "0.875rem",
    marginBottom: "1rem",
  } as const,
};

export function LoginForm({ onLogin, error, loading, oauthEnabled, platform }: LoginFormProps) {
  const [user, setUser] = useState("");
  const [token, setToken] = useState("");
  const [showManual, setShowManual] = useState(false);

  const showOAuth = oauthEnabled && platform === "cloud";

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (user.trim() && token.trim()) {
      onLogin({ user: user.trim(), token: token.trim() });
    }
  };

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <div style={styles.title}>Foxbridge</div>
        <div style={styles.subtitle}>Sign in with your Atlassian credentials</div>

        {error && <div style={styles.error}>{error}</div>}

        {showOAuth && !showManual ? (
          <>
            <button
              type="button"
              onClick={() => { window.location.href = "/api/auth/atlassian"; }}
              style={styles.button}
            >
              Sign in with Atlassian
            </button>
            <div style={{ textAlign: "center", marginTop: "1rem" }}>
              <button
                type="button"
                onClick={() => setShowManual(true)}
                style={{
                  background: "none", border: "none",
                  color: "#0052cc", cursor: "pointer", fontSize: "0.875rem",
                }}
              >
                Use API token instead
              </button>
            </div>
          </>
        ) : (
          <form onSubmit={handleSubmit}>
            <label style={styles.label} htmlFor="user">
              {platform === "datacenter" ? "Username" : "Email"}
            </label>
            <input
              style={styles.input}
              id="user"
              type="text"
              value={user}
              onChange={(e) => setUser(e.target.value)}
              placeholder={platform === "datacenter" ? "username" : "you@company.com"}
              autoComplete="username"
            />

            <label style={styles.label} htmlFor="token">
              {platform === "datacenter" ? "Password" : "API Token"}
            </label>
            <input
              style={styles.input}
              id="token"
              type="password"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              placeholder={platform === "datacenter" ? "Your password" : "Your Atlassian API token"}
              autoComplete="current-password"
            />

            <button
              type="submit"
              style={{
                ...styles.button,
                ...(loading ? styles.buttonDisabled : {}),
              }}
              disabled={loading}
            >
              {loading ? "Signing in..." : "Sign in"}
            </button>

            {showOAuth && (
              <div style={{ textAlign: "center", marginTop: "1rem" }}>
                <button
                  type="button"
                  onClick={() => setShowManual(false)}
                  style={{
                    background: "none", border: "none",
                    color: "#0052cc", cursor: "pointer", fontSize: "0.875rem",
                  }}
                >
                  Sign in with Atlassian instead
                </button>
              </div>
            )}
          </form>
        )}
      </div>
    </div>
  );
}
