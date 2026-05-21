import { useState } from "react";
import type { MCPServer } from "./api";

interface Props {
  server: MCPServer;
  onConnect: (command: string) => void;
  onCancel: () => void;
}

export function AuthWizard({ server, onConnect, onCancel }: Props) {
  const envVars = server.env ?? [];
  const [values, setValues] = useState<Record<string, string>>(
    Object.fromEntries(envVars.map((e) => [e.name, ""]))
  );

  const missingRequired = envVars
    .filter((e) => e.required && !values[e.name]?.trim());

  function buildCommand() {
    // Build: KEY=value KEY2=value2 npx -y @scope/server
    const envPrefix = envVars
      .filter((e) => values[e.name]?.trim())
      .map((e) => `${e.name}=${values[e.name].trim()}`)
      .join(" ");
    const base = `npx -y ${server.name}`;
    return envPrefix ? `${envPrefix} ${base}` : base;
  }

  // If no env vars needed, connect immediately
  if (envVars.length === 0) {
    onConnect(`npx -y ${server.name}`);
    return null;
  }

  return (
    <div
      className="wizard-overlay"
      onClick={(e) => e.target === e.currentTarget && onCancel()}
    >
      <div className="wizard">
        <div className="wizard-header">
          <div className="wizard-title">
            <span className="wizard-icon">🔑</span>
            <span>{server.name}</span>
          </div>
          <button className="wizard-close" onClick={onCancel} aria-label="Close">✕</button>
        </div>

        <p className="wizard-desc">{server.description}</p>

        <div className="wizard-fields">
          {envVars.map((env) => (
            <div key={env.name} className="wizard-field">
              <div className="wizard-field-top">
                <label className="field-label">
                  {env.name}
                  {env.required
                    ? <span className="required-badge">required</span>
                    : <span className="required-badge" style={{ opacity: 0.5 }}>optional</span>
                  }
                </label>
                {env.url && (
                  <a
                    href={env.url}
                    target="_blank"
                    rel="noreferrer"
                    className="get-token-link"
                  >
                    get token ↗
                  </a>
                )}
              </div>
              <p className="wizard-field-desc">{env.description}</p>
              <input
                className="cmd-input full"
                type={
                  env.name.toLowerCase().includes("secret") ||
                  env.name.toLowerCase().includes("password") ||
                  env.name.toLowerCase().includes("token") ||
                  env.name.toLowerCase().includes("key")
                    ? "password"
                    : "text"
                }
                placeholder={env.required ? "required" : "optional"}
                value={values[env.name]}
                onChange={(e) =>
                  setValues((v) => ({ ...v, [env.name]: e.target.value }))
                }
                onKeyDown={(e) => {
                  if (e.key === "Enter" && missingRequired.length === 0) {
                    onConnect(buildCommand());
                  }
                }}
                autoComplete="off"
                spellCheck={false}
              />
            </div>
          ))}
        </div>

        <div className="wizard-preview">
          <span className="field-label">Command preview</span>
          <code className="preview-code">{buildCommand()}</code>
        </div>

        {missingRequired.length > 0 && (
          <div style={{ fontSize: 12, color: "var(--text-dim)", marginBottom: 12, fontFamily: "var(--font-mono)" }}>
            Missing: {missingRequired.map((e) => e.name).join(", ")}
          </div>
        )}

        <div className="wizard-actions">
          <button className="cancel-btn" onClick={onCancel}>Cancel</button>
          <button
            className="run-btn"
            disabled={missingRequired.length > 0}
            onClick={() => onConnect(buildCommand())}
          >
            Connect →
          </button>
        </div>
      </div>
    </div>
  );
}
