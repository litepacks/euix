import path from "node:path";
import type { DoctorResult } from "../ir/types.js";
import { RULE_CATALOG } from "../diagnostics/catalog.js";
import { renderCodeFrame } from "./terminal.js";

function escapeHtml(str: string | null | undefined): string {
    if (!str) return "";
    return str
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

function formatDurationMs(ms: number | null | undefined): string {
    if (typeof ms !== "number" || isNaN(ms) || ms < 0) return "0ms";
    if (ms === 0) return "0ms";
    if (ms < 0.01) return "<0.01ms";
    if (ms < 1) return `${ms.toFixed(2)}ms`;
    if (ms < 1000) return `${ms.toFixed(1)}ms`;
    return `${(ms / 1000).toFixed(2)}s`;
}

export function generateHtmlReport(result: DoctorResult): string {
    const { project } = result;
    const totalLines = project.files.reduce((n, f) => n + f.lines, 0);
    const totalBytes = project.files.reduce((n, f) => n + f.bytes, 0);

    const errors = project.diagnostics.filter((d) => d.severity === "error");
    const warnings = project.diagnostics.filter((d) => d.severity === "warning");
    const info = project.diagnostics.filter((d) => d.severity === "info");
    const autoFixableCount = project.diagnostics.filter((d) => d.fix != null).length;

    const fileSources = new Map(project.files.map((f) => [f.path, f.source]));

    const diagnosticsWithFrames = project.diagnostics.map((d) => {
        const source = fileSources.get(d.file) ?? "";
        const codeFrame = source ? renderCodeFrame(source, d.line, d.column, 2) : null;
        const catalogEntry = RULE_CATALOG[d.rule];
        return {
            ...d,
            relFile: path.relative(project.root, d.file) || path.basename(d.file),
            codeFrame,
            catalog: catalogEntry,
        };
    });

    const componentsList = [...project.components.values()].map((c) => {
        const compDiags = project.diagnostics.filter((d) => d.file === c.file);
        const compErrors = compDiags.filter((d) => d.severity === "error").length;
        const compWarnings = compDiags.filter((d) => d.severity === "warning").length;
        const file = project.files.find((f) => f.path === c.file);
        const pathCount = c.eventIds.length;
        const risk = pathCount > 4 || compErrors > 0 ? "HIGH" : compWarnings > 0 ? "MEDIUM" : "LOW";
        return {
            id: c.id,
            name: c.name,
            file: path.relative(project.root, c.file) || path.basename(c.file),
            fullPath: c.file,
            lines: file?.lines ?? 0,
            statesCount: c.stateIds.length,
            computedCount: c.computedIds.length,
            actionsCount: c.actionIds.length,
            watchersCount: c.watcherIds.length,
            eventsCount: c.eventIds.length,
            errors: compErrors,
            warnings: compWarnings,
            risk,
        };
    });

    const healthColor =
        result.health.score >= 90 ? "#10B981" : result.health.score >= 70 ? "#F59E0B" : "#EF4444";

    const dataJson = JSON.stringify({
        projectRoot: project.root,
        health: result.health,
        stats: {
            filesCount: project.files.length,
            totalLines,
            totalBytes,
            componentsCount: project.components.size,
            statesCount: project.states.size,
            computedCount: project.computed.size,
            actionsCount: project.actions.size,
            watchersCount: project.watchers.size,
            routesCount: project.routes.size,
            apiCount: project.apiCalls.size,
            errorsCount: errors.length,
            warningsCount: warnings.length,
            infoCount: info.length,
            autoFixableCount,
        },
        diagnostics: diagnosticsWithFrames,
        components: componentsList,
        testResults: result.testResults,
        coverage: result.coverage,
        durationMs: result.durationMs,
        timestamp: new Date().toISOString(),
    });

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>EUIX Doctor Report — ${escapeHtml(path.basename(project.root))}</title>
  <style>
    :root {
      --bg-base: #0B0F19;
      --bg-surface: #111827;
      --bg-card: rgba(17, 24, 39, 0.85);
      --bg-card-hover: #1F2937;
      --border-color: rgba(255, 255, 255, 0.08);
      --border-focus: rgba(99, 102, 241, 0.5);
      --text-main: #F9FAFB;
      --text-muted: #9CA3AF;
      --text-dim: #6B7280;
      --accent: #6366F1;
      --accent-light: #818CF8;
      --color-error: #EF4444;
      --color-error-bg: rgba(239, 68, 68, 0.12);
      --color-error-border: rgba(239, 68, 68, 0.3);
      --color-warning: #F59E0B;
      --color-warning-bg: rgba(245, 158, 11, 0.12);
      --color-warning-border: rgba(245, 158, 11, 0.3);
      --color-info: #0EA5E9;
      --color-info-bg: rgba(14, 165, 233, 0.12);
      --color-info-border: rgba(14, 165, 233, 0.3);
      --color-success: #10B981;
      --color-success-bg: rgba(16, 185, 129, 0.12);
      --color-success-border: rgba(16, 185, 129, 0.3);
      --font-mono: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace;
      --font-sans: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    }

    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      background-color: var(--bg-base);
      color: var(--text-main);
      font-family: var(--font-sans);
      line-height: 1.5;
      padding: 0;
      min-height: 100vh;
      display: flex;
      flex-direction: column;
    }

    header {
      background: rgba(17, 24, 39, 0.7);
      backdrop-filter: blur(12px);
      border-bottom: 1px solid var(--border-color);
      position: sticky;
      top: 0;
      z-index: 50;
      padding: 1rem 2rem;
      display: flex;
      justify-content: space-between;
      align-items: center;
      flex-wrap: wrap;
      gap: 1rem;
    }

    .brand {
      display: flex;
      align-items: center;
      gap: 0.75rem;
    }

    .brand-logo {
      font-size: 1.5rem;
      background: linear-gradient(135deg, #6366F1, #EC4899);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      font-weight: 800;
      letter-spacing: -0.025em;
    }

    .brand-badge {
      font-size: 0.75rem;
      background: rgba(99, 102, 241, 0.2);
      color: var(--accent-light);
      padding: 0.2rem 0.5rem;
      border-radius: 9999px;
      border: 1px solid rgba(99, 102, 241, 0.3);
      font-weight: 600;
    }

    .header-actions {
      display: flex;
      gap: 0.5rem;
      align-items: center;
    }

    .btn {
      background: var(--bg-surface);
      border: 1px solid var(--border-color);
      color: var(--text-main);
      padding: 0.45rem 0.85rem;
      border-radius: 8px;
      font-size: 0.85rem;
      font-weight: 500;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      gap: 0.4rem;
      transition: all 0.15s ease;
    }
    .btn:hover {
      background: var(--bg-card-hover);
      border-color: rgba(255, 255, 255, 0.2);
    }
    .btn-primary {
      background: var(--accent);
      border-color: var(--accent);
      color: white;
    }
    .btn-primary:hover {
      background: #4F46E5;
    }

    main {
      flex: 1;
      max-width: 1400px;
      width: 100%;
      margin: 0 auto;
      padding: 2rem;
      display: flex;
      flex-direction: column;
      gap: 2rem;
    }

    /* Dashboard Metrics Grid */
    .dashboard-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
      gap: 1.25rem;
    }

    .metric-card {
      background: var(--bg-card);
      border: 1px solid var(--border-color);
      border-radius: 12px;
      padding: 1.25rem;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      backdrop-filter: blur(8px);
      box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.2);
    }

    .metric-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 0.75rem;
    }

    .metric-title {
      font-size: 0.85rem;
      color: var(--text-muted);
      font-weight: 500;
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }

    .metric-value-huge {
      font-size: 2.25rem;
      font-weight: 800;
      line-height: 1;
      display: flex;
      align-items: baseline;
      gap: 0.25rem;
    }

    .health-score-val {
      color: ${healthColor};
    }

    .metric-subtext {
      font-size: 0.8rem;
      color: var(--text-dim);
      margin-top: 0.5rem;
    }

    .pill-group {
      display: flex;
      gap: 0.5rem;
      margin-top: 0.5rem;
      flex-wrap: wrap;
    }

    .stat-pill {
      font-size: 0.75rem;
      padding: 0.2rem 0.5rem;
      border-radius: 6px;
      font-weight: 600;
      display: inline-flex;
      align-items: center;
      gap: 0.3rem;
    }

    .pill-error { background: var(--color-error-bg); color: var(--color-error); border: 1px solid var(--color-error-border); }
    .pill-warning { background: var(--color-warning-bg); color: var(--color-warning); border: 1px solid var(--color-warning-border); }
    .pill-info { background: var(--color-info-bg); color: var(--color-info); border: 1px solid var(--color-info-border); }
    .pill-success { background: var(--color-success-bg); color: var(--color-success); border: 1px solid var(--color-success-border); }

    /* Nav Tabs */
    .tabs-nav {
      display: flex;
      gap: 0.5rem;
      border-bottom: 1px solid var(--border-color);
      padding-bottom: 0.25rem;
      overflow-x: auto;
    }

    .tab-btn {
      background: none;
      border: none;
      color: var(--text-muted);
      font-size: 0.95rem;
      font-weight: 600;
      padding: 0.6rem 1.2rem;
      border-radius: 8px;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      gap: 0.5rem;
      transition: all 0.15s ease;
    }
    .tab-btn:hover {
      color: var(--text-main);
      background: var(--bg-card-hover);
    }
    .tab-btn.active {
      color: var(--text-main);
      background: rgba(99, 102, 241, 0.15);
      border: 1px solid rgba(99, 102, 241, 0.3);
    }
    .tab-badge {
      background: rgba(255, 255, 255, 0.1);
      padding: 0.15rem 0.45rem;
      border-radius: 9999px;
      font-size: 0.75rem;
    }

    /* Filter Bar */
    .filter-bar {
      display: flex;
      gap: 1rem;
      flex-wrap: wrap;
      align-items: center;
      background: var(--bg-surface);
      padding: 1rem;
      border-radius: 12px;
      border: 1px solid var(--border-color);
    }

    .search-input {
      flex: 1;
      min-width: 260px;
      background: var(--bg-base);
      border: 1px solid var(--border-color);
      color: var(--text-main);
      padding: 0.55rem 0.9rem;
      border-radius: 8px;
      font-size: 0.9rem;
      outline: none;
      transition: border-color 0.15s ease;
    }
    .search-input:focus {
      border-color: var(--accent);
    }

    .chip-group {
      display: flex;
      gap: 0.4rem;
      flex-wrap: wrap;
    }

    .chip-btn {
      background: var(--bg-base);
      border: 1px solid var(--border-color);
      color: var(--text-muted);
      padding: 0.35rem 0.75rem;
      border-radius: 8px;
      font-size: 0.8rem;
      font-weight: 500;
      cursor: pointer;
      transition: all 0.15s ease;
    }
    .chip-btn:hover {
      color: var(--text-main);
      border-color: rgba(255, 255, 255, 0.2);
    }
    .chip-btn.active {
      background: var(--accent);
      color: white;
      border-color: var(--accent);
    }

    /* Diagnostic Card */
    .diagnostic-list {
      display: flex;
      flex-direction: column;
      gap: 1rem;
    }

    .diag-card {
      background: var(--bg-card);
      border: 1px solid var(--border-color);
      border-radius: 12px;
      overflow: hidden;
      transition: border-color 0.15s ease;
    }
    .diag-card:hover {
      border-color: rgba(255, 255, 255, 0.15);
    }
    .diag-card.severity-error { border-left: 4px solid var(--color-error); }
    .diag-card.severity-warning { border-left: 4px solid var(--color-warning); }
    .diag-card.severity-info { border-left: 4px solid var(--color-info); }

    .diag-header {
      padding: 1rem 1.25rem;
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      gap: 1rem;
      cursor: pointer;
      user-select: none;
    }

    .diag-title-group {
      display: flex;
      flex-direction: column;
      gap: 0.35rem;
      flex: 1;
    }

    .diag-badges {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      flex-wrap: wrap;
    }

    .rule-pill {
      font-family: var(--font-mono);
      font-size: 0.75rem;
      font-weight: 700;
      padding: 0.15rem 0.45rem;
      border-radius: 4px;
      background: rgba(255, 255, 255, 0.08);
      color: #E2E8F0;
    }

    .category-pill {
      font-size: 0.7rem;
      text-transform: uppercase;
      font-weight: 600;
      color: var(--text-dim);
      background: rgba(255, 255, 255, 0.04);
      padding: 0.15rem 0.4rem;
      border-radius: 4px;
    }

    .diag-message {
      font-size: 0.95rem;
      font-weight: 600;
      color: var(--text-main);
    }

    .diag-loc {
      font-family: var(--font-mono);
      font-size: 0.8rem;
      color: var(--text-muted);
      display: inline-flex;
      align-items: center;
      gap: 0.3rem;
      text-decoration: none;
    }
    .diag-loc:hover {
      color: var(--accent-light);
      text-decoration: underline;
    }

    .diag-body {
      padding: 0 1.25rem 1.25rem 1.25rem;
      display: flex;
      flex-direction: column;
      gap: 0.85rem;
      border-top: 1px solid rgba(255, 255, 255, 0.04);
      margin-top: 0.5rem;
      padding-top: 1rem;
    }

    .code-frame {
      background: #060911;
      border: 1px solid rgba(255, 255, 255, 0.06);
      border-radius: 8px;
      padding: 0.75rem 1rem;
      font-family: var(--font-mono);
      font-size: 0.85rem;
      overflow-x: auto;
      color: #E2E8F0;
      white-space: pre;
    }

    .explanation-box {
      background: rgba(255, 255, 255, 0.02);
      border: 1px solid var(--border-color);
      border-radius: 8px;
      padding: 0.85rem 1rem;
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
      gap: 1rem;
    }

    .explanation-col {
      display: flex;
      flex-direction: column;
      gap: 0.25rem;
    }

    .explanation-col h4 {
      font-size: 0.75rem;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: var(--text-muted);
    }

    .explanation-col p {
      font-size: 0.85rem;
      color: #D1D5DB;
    }

    .fix-box {
      background: rgba(16, 185, 129, 0.05);
      border: 1px solid rgba(16, 185, 129, 0.2);
      border-radius: 8px;
      padding: 0.75rem 1rem;
      display: flex;
      align-items: flex-start;
      gap: 0.6rem;
      font-size: 0.85rem;
      color: #A7F3D0;
    }

    /* Component Table */
    .table-container {
      background: var(--bg-card);
      border: 1px solid var(--border-color);
      border-radius: 12px;
      overflow: hidden;
    }

    table {
      width: 100%;
      border-collapse: collapse;
      text-align: left;
      font-size: 0.9rem;
    }

    th {
      background: rgba(255, 255, 255, 0.03);
      padding: 0.85rem 1rem;
      font-weight: 600;
      color: var(--text-muted);
      border-bottom: 1px solid var(--border-color);
      text-transform: uppercase;
      font-size: 0.75rem;
      letter-spacing: 0.05em;
    }

    td {
      padding: 0.85rem 1rem;
      border-bottom: 1px solid var(--border-color);
      color: var(--text-main);
    }

    tr:last-child td {
      border-bottom: none;
    }

    tr:hover td {
      background: rgba(255, 255, 255, 0.02);
    }

    /* Test Results */
    .test-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
      gap: 1rem;
    }

    .test-card {
      background: var(--bg-card);
      border: 1px solid var(--border-color);
      border-radius: 10px;
      padding: 1rem;
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
    }

    .test-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .test-name {
      font-weight: 600;
      font-size: 0.9rem;
    }

    footer {
      border-top: 1px solid var(--border-color);
      padding: 1.5rem 2rem;
      text-align: center;
      font-size: 0.8rem;
      color: var(--text-dim);
      margin-top: auto;
    }

    .empty-state {
      text-align: center;
      padding: 3rem 1rem;
      color: var(--text-muted);
    }

    @media print {
      body { background: white; color: black; }
      header, .tabs-nav, .filter-bar, .btn { display: none; }
      .diag-card { border: 1px solid #ccc; break-inside: avoid; }
    }
  </style>
</head>
<body>
  <header>
    <div class="brand">
      <div class="brand-logo">🩺 EUIX Doctor</div>
      <div class="brand-badge">Report Dashboard</div>
    </div>
    <div class="header-actions">
      <button class="btn" onclick="copyReportJson()">📋 Copy JSON</button>
      <button class="btn" onclick="window.print()">🖨️ Print / PDF</button>
      <button class="btn btn-primary" onclick="expandAllDiagnostics()">Expand All</button>
    </div>
  </header>

  <main>
    <!-- Summary Metrics -->
    <div class="dashboard-grid">
      <div class="metric-card">
        <div class="metric-header">
          <span class="metric-title">Health Score</span>
          <span class="stat-pill ${result.health.score >= 90 ? "pill-success" : result.health.score >= 70 ? "pill-warning" : "pill-error"}">
            ${result.health.score >= 90 ? "HEALTHY" : result.health.score >= 70 ? "NEEDS ATTENTION" : "AT RISK"}
          </span>
        </div>
        <div class="metric-value-huge health-score-val">
          ${result.health.score}<span style="font-size: 1.25rem; color: var(--text-dim);">/100</span>
        </div>
        <div class="metric-subtext">
          ${result.health.contributors.map((c) => `${escapeHtml(c.label)}: ${c.impact}`).join(" · ") || "No penalties applied"}
        </div>
      </div>

      <div class="metric-card">
        <div class="metric-header">
          <span class="metric-title">Diagnostics</span>
          <span class="stat-pill ${errors.length === 0 ? "pill-success" : "pill-error"}">
            ${errors.length === 0 ? "0 ERRORS" : `${errors.length} ERRORS`}
          </span>
        </div>
        <div class="metric-value-huge">
          ${project.diagnostics.length}
        </div>
        <div class="pill-group">
          <span class="stat-pill pill-error">${errors.length} Errors</span>
          <span class="stat-pill pill-warning">${warnings.length} Warnings</span>
          <span class="stat-pill pill-info">${info.length} Info</span>
          ${autoFixableCount > 0 ? `<span class="stat-pill pill-success">🔧 ${autoFixableCount} Fixable</span>` : ""}
        </div>
      </div>

      <div class="metric-card">
        <div class="metric-header">
          <span class="metric-title">Architecture Surface</span>
          <span class="stat-pill pill-info">${project.components.size} Components</span>
        </div>
        <div class="metric-value-huge">
          ${project.files.length} <span style="font-size: 1.1rem; color: var(--text-muted); font-weight: 500;">files (${totalLines.toLocaleString()} LOC)</span>
        </div>
        <div class="metric-subtext">
          ${project.states.size} States · ${project.computed.size} Computed · ${project.actions.size} Actions · ${project.apiCalls.size} APIs
        </div>
      </div>

      <div class="metric-card">
        <div class="metric-header">
          <span class="metric-title">Behavior Coverage</span>
          <span class="stat-pill pill-success">${result.coverage.percentage}%</span>
        </div>
        <div class="metric-value-huge">
          ${result.coverage.pathsExecuted}<span style="font-size: 1.25rem; color: var(--text-dim);">/${result.coverage.pathsDiscovered}</span>
        </div>
        <div class="metric-subtext">
          ${result.testResults.filter((r) => r.passed).length}/${result.testResults.length} scenarios passed · Discovered in ${Math.round(result.durationMs)}ms
        </div>
      </div>
    </div>

    <!-- Navigation Tabs -->
    <div class="tabs-nav">
      <button class="tab-btn active" onclick="switchTab('diagnostics')">
        🚨 Diagnostics <span class="tab-badge" id="badge-diag-count">${project.diagnostics.length}</span>
      </button>
      <button class="tab-btn" onclick="switchTab('components')">
        🧩 Components <span class="tab-badge">${project.components.size}</span>
      </button>
      <button class="tab-btn" onclick="switchTab('tests')">
        🧪 Behavior & Tests <span class="tab-badge">${result.testResults.length}</span>
      </button>
      <button class="tab-btn" onclick="switchTab('catalog')">
        📖 Rule Catalog
      </button>
    </div>

    <!-- TAB 1: Diagnostics -->
    <section id="tab-diagnostics">
      <div class="filter-bar">
        <input
          type="text"
          id="search-diagnostics"
          class="search-input"
          placeholder="Filter by rule (e.g. EUIX0001), message, file name or category..."
          oninput="filterDiagnostics()"
        />
        <div class="chip-group" id="severity-chips">
          <button class="chip-btn active" data-filter="all" onclick="setSeverityFilter('all')">All (${project.diagnostics.length})</button>
          <button class="chip-btn" data-filter="error" onclick="setSeverityFilter('error')">Errors (${errors.length})</button>
          <button class="chip-btn" data-filter="warning" onclick="setSeverityFilter('warning')">Warnings (${warnings.length})</button>
          <button class="chip-btn" data-filter="info" onclick="setSeverityFilter('info')">Info (${info.length})</button>
          ${autoFixableCount > 0 ? `<button class="chip-btn" data-filter="fixable" onclick="setSeverityFilter('fixable')">🔧 Auto-Fixable (${autoFixableCount})</button>` : ""}
        </div>
      </div>

      <div class="diagnostic-list" id="diag-container" style="margin-top: 1.25rem;">
        ${
            project.diagnostics.length === 0
                ? `<div class="empty-state"><h3>✨ No issues found! Your EUIX application passes all Doctor checks.</h3></div>`
                : diagnosticsWithFrames
                      .map(
                          (d, idx) => `
          <div
            class="diag-card severity-${d.severity}"
            data-severity="${d.severity}"
            data-rule="${d.rule}"
            data-category="${d.category ?? "general"}"
            data-fixable="${d.fix != null}"
            data-file="${escapeHtml(d.relFile)}"
            data-msg="${escapeHtml(d.message)}"
            id="diag-card-${idx}"
          >
            <div class="diag-header" onclick="toggleDiagBody(${idx})">
              <div class="diag-title-group">
                <div class="diag-badges">
                  <span class="stat-pill ${d.severity === "error" ? "pill-error" : d.severity === "warning" ? "pill-warning" : "pill-info"}">
                    ${d.severity.toUpperCase()}
                  </span>
                  <span class="rule-pill">${escapeHtml(d.rule)}</span>
                  ${d.category ? `<span class="category-pill">${escapeHtml(d.category)}</span>` : ""}
                  ${d.fix != null ? `<span class="stat-pill pill-success">🔧 Auto-Fix</span>` : ""}
                </div>
                <div class="diag-message">${escapeHtml(d.message)}</div>
              </div>
              <a href="vscode://file${escapeHtml(d.file)}:${d.line}:${d.column}" class="diag-loc" title="Open in VS Code" onclick="event.stopPropagation()">
                📄 ${escapeHtml(d.relFile)}:${d.line}:${d.column}
              </a>
            </div>

            <div class="diag-body" id="diag-body-${idx}">
              ${
                  d.codeFrame
                      ? `
                <div>
                  <div style="font-size: 0.75rem; font-weight: 700; text-transform: uppercase; color: var(--text-muted); margin-bottom: 0.35rem;">
                    Source Location
                  </div>
                  <div class="code-frame">${escapeHtml(d.codeFrame)}</div>
                </div>
              `
                      : ""
              }

              ${
                  d.catalog
                      ? `
                <div class="explanation-box">
                  <div class="explanation-col">
                    <h4>Why this happened &amp; Risk</h4>
                    <p>${escapeHtml(d.catalog.risk)}</p>
                  </div>
                  <div class="explanation-col">
                    <h4>How to fix</h4>
                    <p>${escapeHtml(d.catalog.solution)}</p>
                  </div>
                </div>
              `
                      : ""
              }

              ${
                  d.hint
                      ? `
                <div class="fix-box">
                  <span>💡</span>
                  <div><strong>Fix Hint:</strong> ${escapeHtml(d.hint)}</div>
                </div>
              `
                      : ""
              }

              ${
                  d.fix
                      ? `
                <div class="fix-box" style="background: rgba(99, 102, 241, 0.08); border-color: rgba(99, 102, 241, 0.3); color: #C7D2FE;">
                  <span>🔧</span>
                  <div><strong>Auto-Fix Action:</strong> ${escapeHtml(d.fix.description)} (Apply with <code>euix doctor --fix</code>)</div>
                </div>
              `
                      : ""
              }
            </div>
          </div>
        `,
                      )
                      .join("")
        }
      </div>
    </section>

    <!-- TAB 2: Components -->
    <section id="tab-components" style="display: none;">
      <div class="table-container">
        <table>
          <thead>
            <tr>
              <th>Component Name</th>
              <th>File</th>
              <th>LOC</th>
              <th>States</th>
              <th>Computed</th>
              <th>Actions</th>
              <th>Watchers</th>
              <th>Issues</th>
              <th>Risk</th>
            </tr>
          </thead>
          <tbody>
            ${componentsList
                .map(
                    (c) => `
              <tr>
                <td><strong>${escapeHtml(c.name)}</strong></td>
                <td><a href="vscode://file${escapeHtml(c.fullPath)}" class="diag-loc">${escapeHtml(c.file)}</a></td>
                <td>${c.lines}</td>
                <td>${c.statesCount}</td>
                <td>${c.computedCount}</td>
                <td>${c.actionsCount}</td>
                <td>${c.watchersCount}</td>
                <td>
                  ${c.errors > 0 ? `<span class="stat-pill pill-error">${c.errors} errors</span> ` : ""}
                  ${c.warnings > 0 ? `<span class="stat-pill pill-warning">${c.warnings} warnings</span>` : ""}
                  ${c.errors === 0 && c.warnings === 0 ? `<span class="stat-pill pill-success">Clean</span>` : ""}
                </td>
                <td>
                  <span class="stat-pill ${c.risk === "LOW" ? "pill-success" : c.risk === "MEDIUM" ? "pill-warning" : "pill-error"}">
                    ${c.risk}
                  </span>
                </td>
              </tr>
            `,
                )
                .join("")}
          </tbody>
        </table>
      </div>
    </section>

    <!-- TAB 3: Tests -->
    <section id="tab-tests" style="display: none;">
      <div class="test-grid">
        ${
            result.testResults.length === 0
                ? `<div class="empty-state" style="grid-column: 1 / -1;">No flow scenarios executed. Run with <code>--test</code> to discover and verify flows.</div>`
                : result.testResults
                      .map(
                          (t) => `
          <div class="test-card">
            <div class="test-header">
              <div class="test-name">${escapeHtml(t.name)}</div>
              <span class="stat-pill ${t.passed ? "pill-success" : "pill-error"}">
                ${t.passed ? "✓ PASSED" : "✗ FAILED"}
              </span>
            </div>
            ${t.message ? `<div style="font-size: 0.8rem; color: var(--color-error);">${escapeHtml(t.message)}</div>` : ""}
            <div style="font-size: 0.75rem; color: var(--text-dim);">Duration: ${formatDurationMs(t.durationMs)}</div>
          </div>
        `,
                      )
                      .join("")
        }
      </div>
    </section>

    <!-- TAB 4: Catalog -->
    <section id="tab-catalog" style="display: none;">
      <div class="diagnostic-list">
        ${Object.values(RULE_CATALOG)
            .map(
                (rule) => `
          <div class="diag-card">
            <div class="diag-header" style="cursor: default;">
              <div class="diag-title-group">
                <div class="diag-badges">
                  <span class="rule-pill">${escapeHtml(rule.rule)}</span>
                  <span class="category-pill">${escapeHtml(rule.category)}</span>
                  ${rule.autoFixable ? `<span class="stat-pill pill-success">🔧 Auto-Fixable</span>` : ""}
                </div>
                <div class="diag-message">${escapeHtml(rule.title)}</div>
                <p style="font-size: 0.85rem; color: var(--text-muted);">${escapeHtml(rule.summary)}</p>
              </div>
            </div>
            <div class="diag-body" style="display: flex;">
              <div class="explanation-box">
                <div class="explanation-col">
                  <h4>Risk / Failure Mode</h4>
                  <p>${escapeHtml(rule.risk)}</p>
                </div>
                <div class="explanation-col">
                  <h4>Remediation Guide</h4>
                  <p>${escapeHtml(rule.solution)}</p>
                </div>
              </div>
            </div>
          </div>
        `,
            )
            .join("")}
      </div>
    </section>
  </main>

  <footer>
    EUIX Doctor Analysis generated on ${new Date().toLocaleString()} · <a href="https://github.com/litepacks/euix" style="color: var(--accent-light);">EUIX Engine Project</a>
  </footer>

  <script id="doctor-data" type="application/json">
    ${dataJson}
  </script>

  <script>
    let activeSeverity = 'all';

    function switchTab(tabId) {
      document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
      document.querySelectorAll('main > section').forEach(sec => sec.style.display = 'none');
      
      const targetSec = document.getElementById('tab-' + tabId);
      if (targetSec) targetSec.style.display = 'block';
      
      const activeBtn = Array.from(document.querySelectorAll('.tab-btn')).find(btn => btn.getAttribute('onclick')?.includes(tabId));
      if (activeBtn) activeBtn.classList.add('active');
    }

    function toggleDiagBody(index) {
      const body = document.getElementById('diag-body-' + index);
      if (body) {
        body.style.display = body.style.display === 'none' ? 'flex' : 'none';
      }
    }

    function expandAllDiagnostics() {
      document.querySelectorAll('.diag-body').forEach(b => b.style.display = 'flex');
    }

    function setSeverityFilter(sev) {
      activeSeverity = sev;
      document.querySelectorAll('#severity-chips .chip-btn').forEach(btn => {
        btn.classList.toggle('active', btn.getAttribute('data-filter') === sev);
      });
      filterDiagnostics();
    }

    function filterDiagnostics() {
      const query = (document.getElementById('search-diagnostics')?.value || '').toLowerCase().trim();
      const cards = document.querySelectorAll('#diag-container .diag-card');
      let visibleCount = 0;

      cards.forEach(card => {
        const severity = card.getAttribute('data-severity') || '';
        const rule = (card.getAttribute('data-rule') || '').toLowerCase();
        const category = (card.getAttribute('data-category') || '').toLowerCase();
        const file = (card.getAttribute('data-file') || '').toLowerCase();
        const msg = (card.getAttribute('data-msg') || '').toLowerCase();
        const isFixable = card.getAttribute('data-fixable') === 'true';

        let severityMatch = false;
        if (activeSeverity === 'all') severityMatch = true;
        else if (activeSeverity === 'fixable') severityMatch = isFixable;
        else severityMatch = severity === activeSeverity;

        let queryMatch = true;
        if (query) {
          queryMatch = rule.includes(query) || category.includes(query) || file.includes(query) || msg.includes(query);
        }

        const match = severityMatch && queryMatch;
        card.style.display = match ? 'block' : 'none';
        if (match) visibleCount++;
      });

      const badge = document.getElementById('badge-diag-count');
      if (badge) badge.textContent = visibleCount;
    }

    function copyReportJson() {
      const dataEl = document.getElementById('doctor-data');
      if (dataEl && dataEl.textContent) {
        navigator.clipboard.writeText(dataEl.textContent.trim()).then(() => {
          alert('Report JSON copied to clipboard!');
        });
      }
    }
  </script>
</body>
</html>
`;
}
