import { useState, useCallback, useEffect } from "react";
import { LoginForm } from "./components/LoginForm.js";
import { Workspace } from "./components/Workspace.js";
import { SetupWizard } from "./components/SetupWizard.js";
import { login, logout, fetchFeatures, fetchSetupStatus, fetchSession } from "./api.js";
import type { LoginCredentials, FeatureConfig } from "./types.js";

export function App() {
  const [loggedIn, setLoggedIn] = useState(false);
  const [userName, setUserName] = useState("");
  const [loginError, setLoginError] = useState<string | null>(null);
  const [loggingIn, setLoggingIn] = useState(false);
  const [features, setFeatures] = useState<FeatureConfig | null>(null);
  const [needsSetup, setNeedsSetup] = useState<boolean | null>(null);

  useEffect(() => {
    // First check if the app needs initial setup
    fetchSetupStatus()
      .then(({ configured }) => {
        if (!configured) {
          setNeedsSetup(true);
          return;
        }
        setNeedsSetup(false);

        // Check for OAuth error in URL
        const params = new URLSearchParams(window.location.search);
        const oauthError = params.get("error");
        if (oauthError) {
          setLoginError(`Sign in failed: ${oauthError.replace(/_/g, " ")}`);
          window.history.replaceState({}, "", "/");
        }

        // Try fetching features and detecting existing session
        fetchFeatures()
          .then((f) => {
            setFeatures(f);
            // Detect an existing browser session (not server reachability)
            fetchSession()
              .then((sess) => {
                if (sess.authenticated) {
                  setLoggedIn(true);
                  setUserName(sess.user ?? "");
                }
              })
              .catch(() => {});
          })
          .catch(() => {});
      })
      .catch(() => {
        // If setup status fails, assume setup is needed (server may be in setup mode)
        setNeedsSetup(true);
      });
  }, []);

  const handleLogin = useCallback(async (credentials: LoginCredentials) => {
    setLoginError(null);
    setLoggingIn(true);
    try {
      await login(credentials);
      setUserName(credentials.user);
      setLoggedIn(true);
    } catch (err) {
      setLoginError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setLoggingIn(false);
    }
  }, []);

  const handleLogout = useCallback(async () => {
    await logout();
    setLoggedIn(false);
    setUserName("");
  }, []);

  // Loading state
  if (needsSetup === null) {
    return null;
  }

  // Setup wizard
  if (needsSetup) {
    return <SetupWizard onComplete={() => window.location.reload()} />;
  }

  if (!loggedIn) {
    return (
      <LoginForm
        onLogin={handleLogin}
        error={loginError}
        loading={loggingIn}
        oauthEnabled={features?.oauth_enabled ?? false}
        platform={features?.atlassian_platform ?? "cloud"}
      />
    );
  }

  return <Workspace userName={userName} onLogout={handleLogout} />;
}
