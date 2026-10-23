/**
 * apps/deepseek-studio/src/app.js
 * Main Controller for EUIX DeepSeek Live Studio.
 * Connects DeepSeek SSE token stream to EUIX streaming repair, reactive mounting, and Doctor verification.
 */

import { EUIXEngine, safeParse } from "euixjs";
import {
    parseStreamingEuix,
    repairPartialJson,
    verifyLlmOutput,
    applyFixes,
    formatLlmRepairPrompt,
    jsonToXml,
    renderToString,
    autoRepairSource,
    analyzeSource,
    buildTargetedRepairContext,
    printCanonicalXml,
} from "euixjs/prepare";
import { streamDeepSeekCompletion } from "./deepseek.js";
import { SAMPLE_PROMPTS } from "./prompts.js";

// State Management
const state = {
    apiKey: localStorage.getItem("euix_deepseek_api_key") || "",
    baseUrl: localStorage.getItem("euix_deepseek_base_url") || "https://api.deepseek.com",
    model: localStorage.getItem("euix_deepseek_model") || "deepseek-chat",
    temperature: parseFloat(localStorage.getItem("euix_deepseek_temperature") || "0.2"),
    
    isGenerating: false,
    activeTab: "json", // 'json' | 'xml' | 'doctor' | 'state'
    accumulatedText: "",
    currentSource: null,
    currentXml: "",
    diagnostics: [],
    healthScore: 100,
    abortController: null,
    mountedEngineInstance: null,
    stateEditorMode: "visual", // 'visual' | 'json'
    stateFilter: "",
};

// DOM Element References
const elements = {
    promptInput: document.getElementById("prompt-input"),
    btnGenerate: document.getElementById("btn-generate"),
    btnStop: document.getElementById("btn-stop-generation"),
    streamingIndicator: document.getElementById("streaming-indicator"),
    samplePillsContainer: document.getElementById("sample-pills-container"),
    previewStage: document.getElementById("preview-stage"),
    btnRefreshPreview: document.getElementById("btn-refresh-preview"),
    
    tabBtns: document.querySelectorAll(".tab-btn"),
    codeDisplayJson: document.getElementById("code-display-json"),
    codeDisplayXml: document.getElementById("code-display-xml"),
    doctorScoreText: document.getElementById("doctor-score-text"),
    doctorScoreContainer: document.getElementById("doctor-score-container"),
    doctorDiagnosticsList: document.getElementById("doctor-diagnostics-list"),
    btnAutoRepair: document.getElementById("btn-auto-repair"),
    btnCopyCode: document.getElementById("btn-copy-code"),
    
    // State Editor Elements
    tabBtnState: document.getElementById("tab-btn-state"),
    stateVarCountBadge: document.getElementById("state-var-count-badge"),
    tabContentState: document.getElementById("tab-content-state"),
    stateFilterInput: document.getElementById("state-filter-input"),
    btnStateModeVisual: document.getElementById("btn-state-mode-visual"),
    btnStateModeJson: document.getElementById("btn-state-mode-json"),
    btnToggleAddState: document.getElementById("btn-toggle-add-state"),
    stateAddFormPanel: document.getElementById("state-add-form-panel"),
    inputNewStateKey: document.getElementById("input-new-state-key"),
    selectNewStateType: document.getElementById("select-new-state-type"),
    inputNewStateVal: document.getElementById("input-new-state-val"),
    btnSubmitNewState: document.getElementById("btn-submit-new-state"),
    btnCancelNewState: document.getElementById("btn-cancel-new-state"),
    stateCardsContainer: document.getElementById("state-cards-container"),
    stateJsonContainer: document.getElementById("state-json-container"),
    stateRawJsonEditor: document.getElementById("state-raw-json-editor"),
    stateJsonStatusMsg: document.getElementById("state-json-status-msg"),
    btnApplyJsonState: document.getElementById("btn-apply-json-state"),

    settingsModal: document.getElementById("settings-modal"),
    btnOpenSettings: document.getElementById("btn-open-settings"),
    btnCloseSettings: document.getElementById("btn-close-settings"),
    btnSaveSettings: document.getElementById("btn-save-settings"),
    settingApiKey: document.getElementById("setting-api-key"),
    settingBaseUrl: document.getElementById("setting-base-url"),
    settingModel: document.getElementById("setting-model"),
    settingTemperature: document.getElementById("setting-temperature"),
    tempValueDisplay: document.getElementById("temp-value-display"),
    headerModelName: document.getElementById("header-model-name"),
    apiStatusDot: document.getElementById("api-status-dot"),
    toastContainer: document.getElementById("toast-container"),
};

// Initialize Icons
function refreshIcons(container = null) {
    if (window.lucide && typeof window.lucide.createIcons === "function") {
        if (container) {
            try {
                window.lucide.createIcons({ root: container });
                return;
            } catch (_) {}
        }
        window.lucide.createIcons();
    }
}

// Show Toast Notification
function showToast(message, type = "info") {
    const toast = document.createElement("div");
    toast.className = "toast";
    toast.innerHTML = `
        <i data-lucide="${type === 'error' ? 'alert-triangle' : type === 'success' ? 'check-circle' : 'info'}" 
           style="width: 16px; height: 16px; color: ${type === 'error' ? 'var(--accent-rose)' : type === 'success' ? 'var(--accent-emerald)' : 'var(--primary-400)'};"></i>
        <span>${message}</span>
    `;
    elements.toastContainer.appendChild(toast);
    refreshIcons();

    setTimeout(() => {
        toast.style.opacity = "0";
        toast.style.transform = "translateY(8px)";
        toast.style.transition = "all 0.2s ease";
        setTimeout(() => toast.remove(), 200);
    }, 3200);
}

// Populate Sample Pills
function initSamplePills() {
    elements.samplePillsContainer.innerHTML = "";
    SAMPLE_PROMPTS.forEach((sample) => {
        const pill = document.createElement("button");
        pill.className = "sample-pill";
        pill.innerHTML = `
            <i data-lucide="${sample.icon}" style="width: 13px; height: 13px;"></i>
            <span>${sample.title}</span>
        `;
        pill.addEventListener("click", () => {
            elements.promptInput.value = sample.prompt;
            elements.promptInput.focus();
            showToast(`Loaded prompt template: ${sample.title}`, "info");
        });
        elements.samplePillsContainer.appendChild(pill);
    });
    refreshIcons();
}

// Update Settings UI
function syncSettingsUi() {
    elements.settingApiKey.value = state.apiKey;
    elements.settingBaseUrl.value = state.baseUrl;
    elements.settingModel.value = state.model;
    elements.settingTemperature.value = state.temperature;
    elements.tempValueDisplay.textContent = state.temperature.toFixed(2);
    elements.headerModelName.textContent = state.model;

    if (state.apiKey) {
        elements.apiStatusDot.style.background = "var(--accent-emerald)";
        elements.apiStatusDot.style.boxShadow = "0 0 10px var(--accent-emerald)";
    } else {
        elements.apiStatusDot.style.background = "var(--accent-amber)";
        elements.apiStatusDot.style.boxShadow = "0 0 10px var(--accent-amber)";
    }
}

// Mount or Update EUIX Preview in Real Time
function updatePreview(sourceObj, isComplete = false) {
    if (!sourceObj || !sourceObj.view) return;

    try {
        // Convert to XML representation for mounting
        const xml = jsonToXml(sourceObj);
        state.currentXml = xml;
        if (isComplete || state.activeTab === "xml") {
            elements.codeDisplayXml.textContent = xml;
        }

        // Clean previous mount
        elements.previewStage.innerHTML = "";
        const mountContainer = document.createElement("div");
        mountContainer.className = "euix-dynamic-mount-root";
        mountContainer.style.width = "100%";
        elements.previewStage.appendChild(mountContainer);

        // Mount directly using full EUIX Engine (with reactive & composer plugins)
        const engine = EUIXEngine.mount(xml, mountContainer);
        state.mountedEngineInstance = engine;

        // Attach live two-way observer & update State Editor
        attachStateObserver(engine);
        if (isComplete || state.activeTab === "state") {
            renderStateEditor();
        }

        refreshIcons(elements.previewStage);
    } catch (err) {
        // Fallback to static SSR string render if interactive mount encounters in-flight token syntax
        try {
            const html = renderToString(sourceObj);
            if (html) {
                elements.previewStage.innerHTML = html;
                refreshIcons(elements.previewStage);
            }
        } catch (_) {}
    }
}

// Execute Stream Generation
async function handleGenerate(customPrompt = null) {
    const promptText = (customPrompt || elements.promptInput.value).trim();
    if (!promptText) {
        showToast("Please enter a prompt to generate UI.", "error");
        elements.promptInput.focus();
        return;
    }

    if (!state.apiKey) {
        elements.settingsModal.classList.add("open");
        showToast("Please enter your DeepSeek API Key to proceed.", "error");
        elements.settingApiKey.focus();
        return;
    }

    // Cancel any previous stream controllers and pending debounce timers
    if (typeof state.cancelStreamTimers === "function") {
        state.cancelStreamTimers();
    }
    if (state.abortController) {
        state.abortController.abort();
    }
    state.abortController = new AbortController();

    // Set UI to generating state
    state.isGenerating = true;
    state.accumulatedText = "";
    elements.btnGenerate.style.display = "none";
    elements.btnStop.style.display = "flex";
    elements.streamingIndicator.style.display = "inline-flex";
    elements.codeDisplayJson.textContent = "// Streaming response from DeepSeek...";

    // Stream throttling & debounce controls to keep browser butter-smooth
    let streamRenderTimer = null;
    let streamRafId = null;
    let pendingStreamText = "";
    let lastRenderTimestamp = 0;
    const STREAM_RENDER_INTERVAL_MS = 250; // Throttle preview to at most 4 renders/sec during active streaming

    function cancelStreamTimers() {
        if (streamRenderTimer) {
            clearTimeout(streamRenderTimer);
            streamRenderTimer = null;
        }
        if (streamRafId) {
            cancelAnimationFrame(streamRafId);
            streamRafId = null;
        }
    }
    state.cancelStreamTimers = cancelStreamTimers;

    // Batched RAF code display update (avoids layout thrashing on every SSE token)
    function scheduleCodeDisplay(text) {
        pendingStreamText = text;
        if (!streamRafId) {
            streamRafId = requestAnimationFrame(() => {
                streamRafId = null;
                elements.codeDisplayJson.textContent = pendingStreamText;
                const jsonPre = elements.codeDisplayJson.closest(".code-pre");
                if (jsonPre) {
                    jsonPre.scrollTop = jsonPre.scrollHeight;
                }
            });
        }
    }

    // Throttled & debounced in-flight streaming preview mount
    function schedulePreviewRender(accumulated) {
        const now = performance.now();

        if (streamRenderTimer) {
            clearTimeout(streamRenderTimer);
            streamRenderTimer = null;
        }

        const renderAction = () => {
            streamRenderTimer = null;
            lastRenderTimestamp = performance.now();
            try {
                const sanitizedChunk = accumulated.replace(
                    /\{(?:data\.)?([a-zA-Z0-9_$]+)\.filter\([^}]*\)\.length\}/gi,
                    "{data.$1.length}"
                );
                const { source } = parseStreamingEuix(sanitizedChunk);
                if (source && source.view) {
                    state.currentSource = source;
                    updatePreview(source, false);
                }
            } catch (_) {
                // Incomplete streaming JSON can momentarily fail to parse, safely ignore
            }
        };

        const elapsed = now - lastRenderTimestamp;
        if (elapsed >= STREAM_RENDER_INTERVAL_MS) {
            renderAction();
        } else {
            streamRenderTimer = setTimeout(renderAction, STREAM_RENDER_INTERVAL_MS - elapsed);
        }
    }

    await streamDeepSeekCompletion({
        apiKey: state.apiKey,
        baseUrl: state.baseUrl,
        model: state.model,
        userPrompt: promptText,
        temperature: state.temperature,
        signal: state.abortController.signal,

        // Live stream chunk callback
        onChunk: (delta, accumulated) => {
            state.accumulatedText = accumulated;

            // 1. Batch text display updates smoothly via requestAnimationFrame
            scheduleCodeDisplay(accumulated);

            // 2. Throttle and debounce preview mounting so the main thread never freezes
            schedulePreviewRender(accumulated);
        },

        // Stream completed callback
        onComplete: async (fullText) => {
            cancelStreamTimers();
            state.isGenerating = false;
            elements.btnGenerate.style.display = "flex";
            elements.btnStop.style.display = "none";
            elements.streamingIndicator.style.display = "none";

            // Authoritative full text display
            elements.codeDisplayJson.textContent = fullText;
            const jsonPre = elements.codeDisplayJson.closest(".code-pre");
            if (jsonPre) {
                jsonPre.scrollTop = jsonPre.scrollHeight;
            }

            // Sanitize unsupported inline array filter expressions before Doctor verification
            const sanitizedText = fullText.replace(/\{(?:data\.)?([a-zA-Z0-9_$]+)\.filter\([^}]*\)\.length\}/gi, "{data.$1.length}");

            // Run final verification with Doctor & Fixer
            const verifyRes = await verifyLlmOutput(sanitizedText, { autoFix: true });
            let finalCode = sanitizedText;

            if (verifyRes.modified && verifyRes.fixedSource) {
                finalCode = verifyRes.fixedSource;
                showToast(`Doctor auto-corrected ${verifyRes.fixesApplied.length} issue(s)!`, "info");
            }

            const parsedSource = parseStreamingEuix(finalCode).source;
            if (parsedSource) {
                state.currentSource = parsedSource;
                elements.codeDisplayJson.textContent = JSON.stringify(parsedSource, null, 2);
                updatePreview(parsedSource, true);
            }

            // Update Doctor Diagnostics Panel
            state.promptFeedback = verifyRes.promptFeedback;
            updateDoctorPanel(verifyRes);
            if (verifyRes.isValid) {
                showToast("UI generated and Doctor verified 100%!", "success");
            } else {
                showToast(`Doctor flagged ${verifyRes.errors.length} issue(s). Check the Doctor tab.`, "warning");
            }
            refreshIcons();
        },

        // Error callback
        onError: (err) => {
            cancelStreamTimers();
            state.isGenerating = false;
            elements.btnGenerate.style.display = "flex";
            elements.btnStop.style.display = "none";
            elements.streamingIndicator.style.display = "none";

            showToast(err.message, "error");
            console.error("DeepSeek Stream Error:", err);
        },
    });
}

// Update Doctor Tab & Health Score
function updateDoctorPanel(verifyRes) {
    const errorCount = (verifyRes.diagnostics || []).filter((d) => d.severity === "error").length;
    const warningCount = (verifyRes.diagnostics || []).filter((d) => d.severity === "warning").length;

    let score = 100;
    if (errorCount > 0) score = Math.max(0, 100 - errorCount * 25);
    else if (warningCount > 0) score = Math.max(70, 100 - warningCount * 10);

    state.healthScore = score;
    state.diagnostics = verifyRes.diagnostics || [];

    elements.doctorScoreText.textContent = `${score} / 100`;

    elements.doctorScoreContainer.className = "doctor-score-card";
    if (score < 60) {
        elements.doctorScoreContainer.classList.add("error");
        elements.doctorScoreText.style.color = "var(--accent-rose)";
    } else if (score < 100) {
        elements.doctorScoreContainer.classList.add("warning");
        elements.doctorScoreText.style.color = "var(--accent-amber)";
    } else {
        elements.doctorScoreText.style.color = "var(--accent-emerald)";
    }

    if (errorCount > 0) {
        elements.btnAutoRepair.style.display = "flex";
    } else {
        elements.btnAutoRepair.style.display = "none";
    }

    if (state.diagnostics.length === 0) {
        elements.doctorDiagnosticsList.innerHTML = `
            <div style="color: var(--accent-emerald); font-size: 0.85rem; padding: 12px 0; display: flex; align-items: center; gap: 8px;">
                <i data-lucide="check-circle" style="width: 16px; height: 16px;"></i>
                <span>Zero semantic errors. Specification adheres 100% to EUIX architecture.</span>
            </div>
        `;
    } else {
        elements.doctorDiagnosticsList.innerHTML = state.diagnostics
            .map(
                (d) => `
            <div class="diagnostic-item ${d.severity}">
                <div style="display: flex; justify-content: space-between; font-weight: 700; margin-bottom: 4px;">
                    <span style="color: ${d.severity === 'error' ? 'var(--accent-rose)' : 'var(--accent-amber)'};">[${d.code}] ${d.type}</span>
                    <span style="color: var(--text-dim); font-size: 0.75rem;">${d.path || 'root'}</span>
                </div>
                <div style="color: var(--text-main);">${d.message}</div>
                ${d.suggestion ? `<div style="color: var(--primary-400); margin-top: 4px; font-size: 0.78rem;">💡 Suggestion: ${d.suggestion}</div>` : ''}
            </div>
        `,
            )
            .join("");
    }
    refreshIcons();
}

// Handle Auto Repair using Deterministic Analyzer & DeepSeek
async function handleAutoRepair() {
    if (state.diagnostics.length === 0 || !state.currentSource) return;

    // 1. Attempt instant deterministic repair first (SAFE & PROBABLE fixes)
    try {
        const analysis = await analyzeSource(state.currentSource);
        if (analysis.errors.length > 0) {
            const repairRes = autoRepairSource(state.currentSource, analysis.errors, analysis.symbolTable, { allowProbable: true });
            if (repairRes.appliedPatches.length > 0) {
                state.currentSource = repairRes.repairedSource;
                const verifyRes = await verifyLlmOutput(state.currentSource, { autoFix: false });
                elements.codeDisplayJson.textContent = JSON.stringify(state.currentSource, null, 2);
                updatePreview(state.currentSource, true);
                updateDoctorPanel(verifyRes);
                showToast(`Applied ${repairRes.appliedPatches.length} deterministic semantic repair(s)!`, "success");
                if (verifyRes.isValid) return;
            }
        }
    } catch (_) {}

    // 2. If unresolved errors remain, build targeted repair instruction
    const repairPrompt = state.promptFeedback || formatLlmRepairPrompt(state.diagnostics);
    const fullRepairInstruction = `${repairPrompt}\n\nHere is the current code to fix:\n${JSON.stringify(state.currentSource, null, 2)}`;
    showToast("Sending targeted diagnostics to DeepSeek for semantic repair...", "info");
    await handleGenerate(fullRepairInstruction);
}

// ==========================================================================
// Live State Editor Controller
// ==========================================================================

function escapeHtml(str) {
    if (typeof str !== "string") return String(str);
    return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function escapeAttr(str) {
    if (typeof str !== "string") return String(str);
    return str.replace(/"/g, "&quot;");
}

function getCurrentState() {
    return state.mountedEngineInstance?._rawState || state.currentSource?.state || {};
}

let syncTimeout = null;
function scheduleStateEditorSync() {
    if (syncTimeout) clearTimeout(syncTimeout);
    syncTimeout = setTimeout(() => {
        renderStateEditor();
    }, 60);
}

function attachStateObserver(engine) {
    if (!engine || engine._hasStateEditorObserver) return;
    engine._hasStateEditorObserver = true;

    const originalSync = engine.syncBindings.bind(engine);
    engine.syncBindings = (key, value, sourceEl) => {
        originalSync(key, value, sourceEl);
        scheduleStateEditorSync();
    };
}

function updateStateValue(key, value, reRender = true) {
    if (state.mountedEngineInstance) {
        state.mountedEngineInstance.setState(key, value);
    }
    if (state.currentSource) {
        if (!state.currentSource.state) state.currentSource.state = {};
        state.currentSource.state[key] = value;
        elements.codeDisplayJson.textContent = JSON.stringify(state.currentSource, null, 2);
        try {
            state.currentXml = jsonToXml(state.currentSource);
            elements.codeDisplayXml.textContent = state.currentXml;
        } catch (_) {}
    }
    if (reRender) {
        renderStateEditor();
    }
}

function renderStateEditor() {
    const rawState = getCurrentState();
    const keys = Object.keys(rawState);

    // Update count badge on tab
    if (elements.stateVarCountBadge) {
        elements.stateVarCountBadge.textContent = keys.length;
        elements.stateVarCountBadge.style.display = keys.length > 0 ? "inline-flex" : "none";
    }

    // In Raw JSON mode, sync textarea value (unless user is actively typing in it)
    if (state.stateEditorMode === "json") {
        if (document.activeElement !== elements.stateRawJsonEditor) {
            elements.stateRawJsonEditor.value = JSON.stringify(rawState, null, 2);
        }
        return;
    }

    // Skip heavy DOM cards rendering if user is not on the state tab
    if (state.activeTab !== "state") {
        return;
    }

    if (!elements.stateCardsContainer) return;

    if (keys.length === 0) {
        elements.stateCardsContainer.innerHTML = `
            <div class="state-empty-hint">
                <i data-lucide="database" style="width: 24px; height: 24px; color: var(--text-dim); margin-bottom: 6px;"></i>
                <div>No reactive states declared in current UI model.</div>
                <div style="font-size: 0.75rem; color: var(--text-dim); margin-top: 4px;">Click "+ Add State" above or generate a UI to declare reactive state.</div>
            </div>
        `;
        refreshIcons();
        return;
    }

    const filter = (state.stateFilter || "").toLowerCase().trim();
    const filteredKeys = keys.filter((k) => !filter || k.toLowerCase().includes(filter));

    if (filteredKeys.length === 0) {
        elements.stateCardsContainer.innerHTML = `
            <div class="state-empty-hint">
                <div>No state variables match "${filter}".</div>
            </div>
        `;
        return;
    }

    let cardsHtml = "";
    for (const key of filteredKeys) {
        const val = rawState[key];
        let valType = typeof val;
        if (Array.isArray(val)) valType = "array";
        else if (val === null) valType = "null";

        let controlHtml = "";

        if (valType === "boolean") {
            const isChecked = Boolean(val);
            controlHtml = `
                <button type="button" class="state-bool-switch ${isChecked ? 'active' : ''}" data-state-key="${key}">
                    <span class="state-bool-indicator"></span>
                    <span>${isChecked ? 'TRUE' : 'FALSE'}</span>
                </button>
            `;
        } else if (valType === "number") {
            controlHtml = `
                <div class="state-num-group">
                    <button type="button" class="state-num-step-btn" data-step="-1" data-state-key="${key}" title="Decrement by 1">−</button>
                    <input type="number" class="state-num-input" data-state-key="${key}" value="${val}" />
                    <button type="button" class="state-num-step-btn" data-step="1" data-state-key="${key}" title="Increment by 1">+</button>
                </div>
            `;
        } else if (valType === "string") {
            controlHtml = `
                <input type="text" class="state-str-input" data-state-key="${key}" value="${escapeAttr(val)}" placeholder="Value..." />
            `;
        } else if (valType === "array" || valType === "object") {
            const prettyVal = JSON.stringify(val, null, 2);
            const countLabel = valType === "array" ? `${val.length} items` : `${Object.keys(val || {}).length} keys`;
            controlHtml = `
                <div class="state-complex-wrapper">
                    <div class="state-complex-summary">
                        <span>${valType.toUpperCase()} (${countLabel})</span>
                        <button type="button" class="btn-primary btn-save-complex" data-state-key="${key}" style="padding: 2px 8px; font-size: 0.72rem;">Save</button>
                    </div>
                    <textarea class="state-complex-textarea" data-state-key="${key}" spellcheck="false">${escapeHtml(prettyVal)}</textarea>
                </div>
            `;
        }

        cardsHtml += `
            <div class="state-card" data-key="${key}">
                <div class="state-card-header">
                    <div class="state-card-key">
                        <span>${key}</span>
                        <span class="state-type-badge type-${valType}">${valType}</span>
                    </div>
                    <button type="button" class="btn-icon btn-delete-state" data-state-key="${key}" title="Delete Variable" style="width: 24px; height: 24px; color: var(--text-dim);">
                        <i data-lucide="trash-2" style="width: 13px; height: 13px;"></i>
                    </button>
                </div>
                <div class="state-card-body">
                    ${controlHtml}
                </div>
            </div>
        `;
    }

    elements.stateCardsContainer.innerHTML = cardsHtml;
    refreshIcons();
}

function initStateEditorListeners() {
    // Search filter
    if (elements.stateFilterInput) {
        elements.stateFilterInput.addEventListener("input", (e) => {
            state.stateFilter = e.target.value;
            renderStateEditor();
        });
    }

    // Toggle Modes (Visual Cards vs Raw JSON)
    if (elements.btnStateModeVisual && elements.btnStateModeJson) {
        elements.btnStateModeVisual.addEventListener("click", () => {
            state.stateEditorMode = "visual";
            elements.btnStateModeVisual.classList.add("active");
            elements.btnStateModeJson.classList.remove("active");
            elements.stateCardsContainer.style.display = "flex";
            elements.stateJsonContainer.style.display = "none";
            renderStateEditor();
        });

        elements.btnStateModeJson.addEventListener("click", () => {
            state.stateEditorMode = "json";
            elements.btnStateModeJson.classList.add("active");
            elements.btnStateModeVisual.classList.remove("active");
            elements.stateCardsContainer.style.display = "none";
            elements.stateJsonContainer.style.display = "flex";
            renderStateEditor();
        });
    }

    // Toggle Add Form
    if (elements.btnToggleAddState && elements.stateAddFormPanel) {
        elements.btnToggleAddState.addEventListener("click", () => {
            const isHidden = elements.stateAddFormPanel.style.display === "none";
            elements.stateAddFormPanel.style.display = isHidden ? "block" : "none";
            if (isHidden) {
                elements.inputNewStateKey.focus();
            }
        });

        elements.btnCancelNewState.addEventListener("click", () => {
            elements.stateAddFormPanel.style.display = "none";
        });

        elements.btnSubmitNewState.addEventListener("click", () => {
            const rawKey = (elements.inputNewStateKey.value || "").trim().replace(/^data\./, "");
            if (!rawKey) {
                showToast("Please enter a state variable name", "error");
                elements.inputNewStateKey.focus();
                return;
            }
            const type = elements.selectNewStateType.value;
            const rawVal = elements.inputNewStateVal.value.trim();
            let parsedVal = rawVal;
            if (type === "number") parsedVal = Number(rawVal) || 0;
            else if (type === "boolean") parsedVal = rawVal.toLowerCase() === "true" || rawVal === "1";
            else if (type === "array") {
                parsedVal = safeParse(rawVal, []);
            } else if (type === "object") {
                parsedVal = safeParse(rawVal, {});
            }

            updateStateValue(rawKey, parsedVal);
            elements.inputNewStateKey.value = "";
            elements.inputNewStateVal.value = "";
            elements.stateAddFormPanel.style.display = "none";
            showToast(`Added state '${rawKey}'`, "success");
        });
    }

    // Apply Raw JSON State
    if (elements.btnApplyJsonState && elements.stateRawJsonEditor) {
        elements.btnApplyJsonState.addEventListener("click", () => {
            try {
                const parsed = JSON.parse(elements.stateRawJsonEditor.value);
                if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
                    throw new Error("State root must be a JSON object");
                }
                if (state.mountedEngineInstance) {
                    state.mountedEngineInstance.setState(parsed);
                }
                if (state.currentSource) {
                    state.currentSource.state = parsed;
                    elements.codeDisplayJson.textContent = JSON.stringify(state.currentSource, null, 2);
                    try {
                        state.currentXml = jsonToXml(state.currentSource);
                        elements.codeDisplayXml.textContent = state.currentXml;
                    } catch (_) {}
                }
                showToast("State model updated successfully!", "success");
                renderStateEditor();
            } catch (err) {
                showToast(`JSON Error: ${err.message}`, "error");
            }
        });
    }

    // Interactive Delegation for Visual Cards
    if (elements.stateCardsContainer) {
        elements.stateCardsContainer.addEventListener("click", (e) => {
            // Boolean Switch
            const boolBtn = e.target.closest(".state-bool-switch");
            if (boolBtn) {
                const key = boolBtn.dataset.stateKey;
                const rawState = getCurrentState();
                const cur = Boolean(rawState[key]);
                updateStateValue(key, !cur);
                return;
            }

            // Stepper buttons (+/-)
            const stepBtn = e.target.closest(".state-num-step-btn");
            if (stepBtn) {
                const key = stepBtn.dataset.stateKey;
                const step = parseInt(stepBtn.dataset.step, 10);
                const rawState = getCurrentState();
                const cur = Number(rawState[key]) || 0;
                updateStateValue(key, cur + step);
                return;
            }

            // Save complex JSON
            const saveBtn = e.target.closest(".btn-save-complex");
            if (saveBtn) {
                const key = saveBtn.dataset.stateKey;
                const ta = saveBtn.closest(".state-complex-wrapper").querySelector("textarea");
                try {
                    const parsed = JSON.parse(ta.value);
                    updateStateValue(key, parsed);
                    showToast(`Updated '${key}'`, "success");
                } catch (err) {
                    showToast(`JSON Syntax Error: ${err.message}`, "error");
                }
                return;
            }

            // Delete state
            const delBtn = e.target.closest(".btn-delete-state");
            if (delBtn) {
                const key = delBtn.dataset.stateKey;
                if (confirm(`Remove state variable '${key}'?`)) {
                    if (state.mountedEngineInstance?._rawState) delete state.mountedEngineInstance._rawState[key];
                    if (state.currentSource?.state) delete state.currentSource.state[key];
                    renderStateEditor();
                    showToast(`Removed '${key}'`, "info");
                }
                return;
            }
        });

        // Numeric and String input changes
        elements.stateCardsContainer.addEventListener("change", (e) => {
            if (e.target.classList.contains("state-num-input")) {
                const key = e.target.dataset.stateKey;
                updateStateValue(key, Number(e.target.value) || 0);
            } else if (e.target.classList.contains("state-str-input")) {
                const key = e.target.dataset.stateKey;
                updateStateValue(key, e.target.value);
            }
        });

        elements.stateCardsContainer.addEventListener("input", (e) => {
            if (e.target.classList.contains("state-str-input")) {
                const key = e.target.dataset.stateKey;
                clearTimeout(e.target._debounce);
                e.target._debounce = setTimeout(() => {
                    updateStateValue(key, e.target.value, false);
                }, 100);
            }
        });
    }
}

// Event Listeners Setup
function initEventListeners() {
    initStateEditorListeners();

    // Generate Button
    elements.btnGenerate.addEventListener("click", () => handleGenerate());

    // Stop Button
    elements.btnStop.addEventListener("click", () => {
        if (state.abortController) {
            state.abortController.abort();
            if (typeof state.cancelStreamTimers === "function") {
                state.cancelStreamTimers();
            }
            state.isGenerating = false;
            elements.btnGenerate.style.display = "flex";
            elements.btnStop.style.display = "none";
            elements.streamingIndicator.style.display = "none";
            showToast("Generation stopped by user.", "info");
        }
    });

    // Keyboard Shortcut (⌘ + Enter or Ctrl + Enter)
    elements.promptInput.addEventListener("keydown", (e) => {
        if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
            e.preventDefault();
            handleGenerate();
        }
    });

    // Refresh Preview
    elements.btnRefreshPreview.addEventListener("click", () => {
        if (state.currentSource) {
            updatePreview(state.currentSource, true);
            showToast("Preview re-mounted with clean state.", "info");
        }
    });

    // Tab Buttons
    elements.tabBtns.forEach((btn) => {
        btn.addEventListener("click", () => {
            const tabName = btn.dataset.tab;
            state.activeTab = tabName;

            elements.tabBtns.forEach((b) => b.classList.remove("active"));
            btn.classList.add("active");

            document.querySelectorAll(".tab-pane").forEach((pane) => (pane.style.display = "none"));
            const targetPane = document.getElementById(`tab-content-${tabName}`);
            if (targetPane) targetPane.style.display = "block";
            if (tabName === "state") {
                renderStateEditor();
            }
            refreshIcons();
        });
    });

    // Copy Code
    elements.btnCopyCode.addEventListener("click", () => {
        let textToCopy = "";
        if (state.activeTab === "xml") {
            textToCopy = state.currentXml || elements.codeDisplayXml.textContent;
        } else if (state.activeTab === "state") {
            textToCopy = JSON.stringify(getCurrentState(), null, 2);
        } else {
            textToCopy = elements.codeDisplayJson.textContent;
        }

        if (!textToCopy || textToCopy.startsWith("//")) {
            showToast("No code to copy yet.", "error");
            return;
        }

        navigator.clipboard.writeText(textToCopy);
        showToast("Code copied to clipboard!", "success");
    });

    // Auto-Repair Button
    elements.btnAutoRepair.addEventListener("click", handleAutoRepair);

    // Settings Modal
    elements.btnOpenSettings.addEventListener("click", () => {
        syncSettingsUi();
        elements.settingsModal.classList.add("open");
    });

    elements.btnCloseSettings.addEventListener("click", () => {
        elements.settingsModal.classList.remove("open");
    });

    elements.settingTemperature.addEventListener("input", (e) => {
        elements.tempValueDisplay.textContent = parseFloat(e.target.value).toFixed(2);
    });

    elements.btnSaveSettings.addEventListener("click", () => {
        state.apiKey = elements.settingApiKey.value.trim();
        state.baseUrl = elements.settingBaseUrl.value.trim() || "https://api.deepseek.com";
        state.model = elements.settingModel.value;
        state.temperature = parseFloat(elements.settingTemperature.value);

        localStorage.setItem("euix_deepseek_api_key", state.apiKey);
        localStorage.setItem("euix_deepseek_base_url", state.baseUrl);
        localStorage.setItem("euix_deepseek_model", state.model);
        localStorage.setItem("euix_deepseek_temperature", String(state.temperature));

        syncSettingsUi();
        elements.settingsModal.classList.remove("open");
        showToast("Settings saved successfully!", "success");
    });
}

// App Initialization
function init() {
    initSamplePills();
    syncSettingsUi();
    initEventListeners();
    refreshIcons();

    // If no API key configured, guide user politely
    if (!state.apiKey) {
        setTimeout(() => {
            showToast("Welcome! Click Settings (top right) to enter your DeepSeek API key.", "info");
        }, 600);
    }
}

if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
} else {
    init();
}
