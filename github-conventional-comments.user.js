// ==UserScript==
// @name         GitHub Conventional Comments
// @namespace    http://tampermonkey.net/
// @version      1.1.2
// @description  Add conventional comments buttons to GitHub PR reviews and issues
// @author       owenps
// @match        https://github.com/pull/*
// @grant        GM_getValue
// @grant        GM_setValue
// @updateURL    https://raw.githubusercontent.com/owenps/tampermonkey/main/github-conventional-comments.user.js
// @downloadURL  https://raw.githubusercontent.com/owenps/tampermonkey/main/github-conventional-comments.user.js
// ==/UserScript==

(function () {
  "use strict";

  const STORAGE_KEY = "cc-macros";

  const LABELS = [
    {
      name: "praise",
      emoji: "🎉",
      color: "#28a745",
      description: "Highlights something positive",
    },
    {
      name: "nitpick",
      emoji: "🔍",
      color: "#6f42c1",
      description: "Trivial, preference-based request",
    },
    {
      name: "suggestion",
      emoji: "💡",
      color: "#0366d6",
      description: "Proposes an improvement",
    },
    {
      name: "issue",
      emoji: "⚠️",
      color: "#d73a49",
      description: "Identifies a specific problem",
    },
    {
      name: "todo",
      emoji: "📝",
      color: "#e36209",
      description: "Small, necessary change",
    },
    {
      name: "question",
      emoji: "❓",
      color: "#005cc5",
      description: "Needs clarification",
    },
    {
      name: "thought",
      emoji: "💭",
      color: "#6a737d",
      description: "Non-blocking idea",
    },
    {
      name: "chore",
      emoji: "🧹",
      color: "#795548",
      description: "Simple task before acceptance",
    },
    {
      name: "note",
      emoji: "📌",
      color: "#17a2b8",
      description: "Non-blocking highlight",
    },
    {
      name: "typo",
      emoji: "✏️",
      color: "#959da5",
      description: "Typo or minor text fix",
    },
  ];

  const DECORATIONS = [
    { name: "non-blocking", description: "Should not prevent acceptance" },
    { name: "blocking", description: "Must be resolved before acceptance" },
    {
      name: "if-minor",
      description: "Author discretion if changes are trivial",
    },
  ];

  const STYLES = `
        .cc-toolbar {
            display: flex;
            flex-wrap: wrap;
            gap: 4px;
            padding: 8px;
            background: var(--bgColor-muted, #f6f8fa);
            border: 1px solid var(--borderColor-default, #d0d7de);
            border-radius: 6px;
            margin-bottom: 8px;
        }
        .cc-toolbar-section {
            display: flex;
            flex-wrap: wrap;
            gap: 4px;
            align-items: center;
        }
        .cc-toolbar-divider {
            width: 1px;
            height: 24px;
            background: var(--borderColor-default, #d0d7de);
            margin: 0 8px;
        }
        .cc-btn {
            display: inline-flex;
            align-items: center;
            gap: 4px;
            padding: 4px 8px;
            font-size: 12px;
            font-weight: 500;
            border: 1px solid var(--borderColor-default, #d0d7de);
            border-radius: 6px;
            background: var(--bgColor-default, #ffffff);
            color: var(--fgColor-default, #24292f);
            cursor: pointer;
            transition: all 0.15s ease;
        }
        .cc-btn:hover {
            background: var(--bgColor-muted, #f6f8fa);
            border-color: var(--borderColor-emphasis, #8c959f);
        }
        .cc-btn.cc-active {
            background: var(--bgColor-accent-muted, #ddf4ff);
            border-color: var(--borderColor-accent-emphasis, #0969da);
            color: var(--fgColor-accent, #0969da);
        }
        .cc-btn-label {
            font-size: 11px;
            opacity: 0.7;
            margin-right: 4px;
        }
        .cc-decoration-btn {
            font-size: 11px;
            padding: 2px 6px;
        }
        .cc-macro-btn {
            background: var(--bgColor-attention-muted, #fff8c5);
            border-color: var(--borderColor-attention-muted, #d4a72c);
        }
        .cc-macro-btn:hover {
            background: var(--bgColor-attention-emphasis, #f0e68c);
        }
        .cc-macro-actions {
            display: none;
            gap: 2px;
            margin-left: 4px;
        }
        .cc-macro-btn:hover .cc-macro-actions {
            display: inline-flex;
        }
        .cc-macro-action {
            padding: 0 4px;
            font-size: 10px;
            background: transparent;
            border: none;
            cursor: pointer;
            opacity: 0.6;
            border-radius: 3px;
        }
        .cc-macro-action:hover {
            opacity: 1;
            background: rgba(0,0,0,0.1);
        }
        .cc-add-macro-btn {
            border-style: dashed;
            opacity: 0.7;
        }
        .cc-add-macro-btn:hover {
            opacity: 1;
        }
        .cc-modal-overlay {
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(0, 0, 0, 0.5);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 9999;
        }
        .cc-modal {
            background: var(--bgColor-default, #ffffff);
            border: 1px solid var(--borderColor-default, #d0d7de);
            border-radius: 12px;
            padding: 24px;
            min-width: 400px;
            max-width: 500px;
            box-shadow: 0 8px 24px rgba(0, 0, 0, 0.2);
        }
        .cc-modal h3 {
            margin: 0 0 16px 0;
            font-size: 16px;
            font-weight: 600;
        }
        .cc-modal-field {
            margin-bottom: 16px;
        }
        .cc-modal-field label {
            display: block;
            font-size: 12px;
            font-weight: 500;
            margin-bottom: 4px;
            color: var(--fgColor-muted, #656d76);
        }
        .cc-modal-field input,
        .cc-modal-field textarea,
        .cc-modal-field select {
            width: 100%;
            padding: 8px 12px;
            font-size: 14px;
            border: 1px solid var(--borderColor-default, #d0d7de);
            border-radius: 6px;
            background: var(--bgColor-default, #ffffff);
            color: var(--fgColor-default, #24292f);
            box-sizing: border-box;
        }
        .cc-modal-field textarea {
            min-height: 80px;
            resize: vertical;
            font-family: inherit;
        }
        .cc-modal-field select {
            cursor: pointer;
        }
        .cc-modal-buttons {
            display: flex;
            gap: 8px;
            justify-content: flex-end;
            margin-top: 20px;
        }
        .cc-modal-btn {
            padding: 8px 16px;
            font-size: 14px;
            font-weight: 500;
            border-radius: 6px;
            cursor: pointer;
            border: 1px solid var(--borderColor-default, #d0d7de);
            background: var(--bgColor-default, #ffffff);
            color: var(--fgColor-default, #24292f);
        }
        .cc-modal-btn:hover {
            background: var(--bgColor-muted, #f6f8fa);
        }
        .cc-modal-btn-primary {
            background: var(--bgColor-accent-emphasis, #0969da);
            border-color: var(--bgColor-accent-emphasis, #0969da);
            color: white;
        }
        .cc-modal-btn-primary:hover {
            background: var(--bgColor-accent-emphasis, #0860ca);
        }
        .cc-modal-btn-danger {
            background: var(--bgColor-danger-emphasis, #cf222e);
            border-color: var(--bgColor-danger-emphasis, #cf222e);
            color: white;
        }
        .cc-modal-btn-danger:hover {
            background: #b91c1c;
        }
        .cc-checkbox-group {
            display: flex;
            flex-wrap: wrap;
            gap: 8px;
        }
        .cc-checkbox-item {
            display: flex;
            align-items: center;
            gap: 4px;
            font-size: 12px;
        }
        .cc-checkbox-item input {
            width: auto;
        }
        .cc-modal-preview {
            padding: 12px;
            background: var(--bgColor-muted, #f6f8fa);
            border: 1px solid var(--borderColor-default, #d0d7de);
            border-radius: 6px;
            font-size: 13px;
            margin-top: 8px;
            word-break: break-word;
        }
    `;

  // Storage helpers with fallback to localStorage
  function getMacros() {
    try {
      if (typeof GM_getValue !== "undefined") {
        return GM_getValue(STORAGE_KEY, []);
      }
    } catch (e) {}
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
    } catch (e) {
      return [];
    }
  }

  function saveMacros(macros) {
    try {
      if (typeof GM_setValue !== "undefined") {
        GM_setValue(STORAGE_KEY, macros);
      }
    } catch (e) {}
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(macros));
    } catch (e) {}
  }

  function injectStyles() {
    if (document.getElementById("cc-styles")) return;
    const style = document.createElement("style");
    style.id = "cc-styles";
    style.textContent = STYLES;
    document.head.appendChild(style);
  }

  function buildCommentText(label, decorations, body) {
    let prefix = `**${label}`;
    if (decorations && decorations.length > 0) {
      prefix += ` (${decorations.join(", ")})`;
    }
    prefix += "**: ";
    return prefix + (body || "");
  }

  function showMacroModal(textarea, existingMacro = null, onSave = null) {
    const isEdit = !!existingMacro;

    const overlay = document.createElement("div");
    overlay.className = "cc-modal-overlay";

    const modal = document.createElement("div");
    modal.className = "cc-modal";

    const currentLabel = existingMacro?.label || "suggestion";
    const currentDecorations = existingMacro?.decorations || [];
    const currentBody = existingMacro?.body || "";
    const currentName = existingMacro?.name || "";

    modal.innerHTML = `
            <h3>${isEdit ? "Edit" : "Create"} Macro</h3>
            <div class="cc-modal-field">
                <label>Macro Name</label>
                <input type="text" id="cc-macro-name" placeholder="e.g., needs-tests, good-job" value="${currentName}">
            </div>
            <div class="cc-modal-field">
                <label>Label</label>
                <select id="cc-macro-label">
                    ${LABELS.map((l) => `<option value="${l.name}" ${l.name === currentLabel ? "selected" : ""}>${l.emoji} ${l.name}</option>`).join("")}
                </select>
            </div>
            <div class="cc-modal-field">
                <label>Decorations</label>
                <div class="cc-checkbox-group">
                    ${DECORATIONS.map(
                      (d) => `
                        <label class="cc-checkbox-item">
                            <input type="checkbox" value="${d.name}" ${currentDecorations.includes(d.name) ? "checked" : ""}>
                            ${d.name}
                        </label>
                    `,
                    ).join("")}
                </div>
            </div>
            <div class="cc-modal-field">
                <label>Comment Body (optional)</label>
                <textarea id="cc-macro-body" placeholder="Enter the comment text...">${currentBody}</textarea>
            </div>
            <div class="cc-modal-field">
                <label>Preview</label>
                <div class="cc-modal-preview" id="cc-macro-preview"></div>
            </div>
            <div class="cc-modal-buttons">
                ${isEdit ? '<button type="button" class="cc-modal-btn cc-modal-btn-danger" id="cc-macro-delete">Delete</button>' : ""}
                <button type="button" class="cc-modal-btn" id="cc-macro-cancel">Cancel</button>
                <button type="button" class="cc-modal-btn cc-modal-btn-primary" id="cc-macro-save">${isEdit ? "Save" : "Create"}</button>
            </div>
        `;

    overlay.appendChild(modal);
    document.body.appendChild(overlay);

    const nameInput = modal.querySelector("#cc-macro-name");
    const labelSelect = modal.querySelector("#cc-macro-label");
    const bodyTextarea = modal.querySelector("#cc-macro-body");
    const preview = modal.querySelector("#cc-macro-preview");
    const checkboxes = modal.querySelectorAll(".cc-checkbox-group input");

    function updatePreview() {
      const label = labelSelect.value;
      const decorations = Array.from(checkboxes)
        .filter((cb) => cb.checked)
        .map((cb) => cb.value);
      const body = bodyTextarea.value;
      preview.textContent = buildCommentText(
        label,
        decorations,
        body || "[your comment here]",
      );
    }

    updatePreview();
    labelSelect.addEventListener("change", updatePreview);
    bodyTextarea.addEventListener("input", updatePreview);
    checkboxes.forEach((cb) => cb.addEventListener("change", updatePreview));

    modal.querySelector("#cc-macro-cancel").addEventListener("click", () => {
      overlay.remove();
    });

    overlay.addEventListener("click", (e) => {
      if (e.target === overlay) overlay.remove();
    });

    if (isEdit) {
      modal.querySelector("#cc-macro-delete").addEventListener("click", () => {
        if (confirm("Delete this macro?")) {
          const macros = getMacros().filter((m) => m.id !== existingMacro.id);
          saveMacros(macros);
          overlay.remove();
          if (onSave) onSave();
        }
      });
    }

    modal.querySelector("#cc-macro-save").addEventListener("click", () => {
      const name = nameInput.value.trim();
      if (!name) {
        nameInput.focus();
        nameInput.style.borderColor = "red";
        return;
      }

      const macro = {
        id: existingMacro?.id || Date.now().toString(),
        name,
        label: labelSelect.value,
        decorations: Array.from(checkboxes)
          .filter((cb) => cb.checked)
          .map((cb) => cb.value),
        body: bodyTextarea.value,
      };

      const macros = getMacros();
      const existingIndex = macros.findIndex((m) => m.id === macro.id);
      if (existingIndex >= 0) {
        macros[existingIndex] = macro;
      } else {
        macros.push(macro);
      }
      saveMacros(macros);

      overlay.remove();
      if (onSave) onSave();
    });

    nameInput.focus();
  }

  function applyMacro(textarea, macro) {
    const text = buildCommentText(macro.label, macro.decorations, macro.body);
    textarea.value = text;
    triggerInput(textarea);

    // Place cursor at end or after prefix if no body
    const cursorPos = macro.body ? text.length : text.indexOf("**: ") + 4;
    textarea.setSelectionRange(cursorPos, cursorPos);
    textarea.focus();
  }

  function createToolbar(textarea) {
    const toolbar = document.createElement("div");
    toolbar.className = "cc-toolbar";
    toolbar.dataset.ccToolbar = "true";

    // Label section
    const labelSection = document.createElement("div");
    labelSection.className = "cc-toolbar-section";

    LABELS.forEach((label) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "cc-btn";
      btn.dataset.label = label.name;
      btn.title = label.description;
      btn.innerHTML = `<span>${label.emoji}</span><span>${label.name}</span>`;
      btn.addEventListener("click", (e) => {
        e.preventDefault();
        toggleLabel(toolbar, textarea, label.name);
      });
      labelSection.appendChild(btn);
    });

    toolbar.appendChild(labelSection);

    // Divider
    const divider1 = document.createElement("div");
    divider1.className = "cc-toolbar-divider";
    toolbar.appendChild(divider1);

    // Decoration section
    const decorationSection = document.createElement("div");
    decorationSection.className = "cc-toolbar-section";

    const decorLabel = document.createElement("span");
    decorLabel.className = "cc-btn-label";
    decorLabel.textContent = "Decorations:";
    decorationSection.appendChild(decorLabel);

    DECORATIONS.forEach((decoration) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "cc-btn cc-decoration-btn";
      btn.dataset.decoration = decoration.name;
      btn.title = decoration.description;
      btn.textContent = decoration.name;
      btn.addEventListener("click", (e) => {
        e.preventDefault();
        toggleDecoration(toolbar, textarea, decoration.name);
      });
      decorationSection.appendChild(btn);
    });

    toolbar.appendChild(decorationSection);

    // Divider
    const divider2 = document.createElement("div");
    divider2.className = "cc-toolbar-divider";
    toolbar.appendChild(divider2);

    // Macros section
    const macrosSection = document.createElement("div");
    macrosSection.className = "cc-toolbar-section";
    macrosSection.dataset.macrosSection = "true";

    const macrosLabel = document.createElement("span");
    macrosLabel.className = "cc-btn-label";
    macrosLabel.textContent = "Macros:";
    macrosSection.appendChild(macrosLabel);

    toolbar.appendChild(macrosSection);

    // Store state
    toolbar.ccState = {
      selectedLabel: null,
      selectedDecorations: [],
    };

    // Render macros
    renderMacros(toolbar, textarea);

    return toolbar;
  }

  function renderMacros(toolbar, textarea) {
    const macrosSection = toolbar.querySelector("[data-macros-section]");
    if (!macrosSection) return;

    // Remove existing macro buttons (keep the label)
    const existingMacros = macrosSection.querySelectorAll(
      ".cc-macro-btn, .cc-add-macro-btn",
    );
    existingMacros.forEach((btn) => btn.remove());

    const macros = getMacros();

    macros.forEach((macro) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "cc-btn cc-macro-btn";
      btn.title = buildCommentText(
        macro.label,
        macro.decorations,
        macro.body || "...",
      );

      const labelInfo = LABELS.find((l) => l.name === macro.label);
      btn.innerHTML = `
                <span>${labelInfo?.emoji || "📎"}</span>
                <span>${macro.name}</span>
                <span class="cc-macro-actions">
                    <span class="cc-macro-action" data-action="edit" title="Edit macro">✏️</span>
                </span>
            `;

      btn.addEventListener("click", (e) => {
        e.preventDefault();
        if (e.target.closest('[data-action="edit"]')) {
          showMacroModal(textarea, macro, () =>
            renderMacros(toolbar, textarea),
          );
        } else {
          applyMacro(textarea, macro);
        }
      });

      macrosSection.appendChild(btn);
    });

    // Add "+" button
    const addBtn = document.createElement("button");
    addBtn.type = "button";
    addBtn.className = "cc-btn cc-add-macro-btn";
    addBtn.title = "Create new macro";
    addBtn.innerHTML = "<span>+</span>";
    addBtn.addEventListener("click", (e) => {
      e.preventDefault();
      showMacroModal(textarea, null, () => renderMacros(toolbar, textarea));
    });
    macrosSection.appendChild(addBtn);
  }

  function toggleLabel(toolbar, textarea, labelName) {
    const state = toolbar.ccState;
    const buttons = toolbar.querySelectorAll("[data-label]");

    if (state.selectedLabel === labelName) {
      state.selectedLabel = null;
      buttons.forEach((btn) => btn.classList.remove("cc-active"));
    } else {
      state.selectedLabel = labelName;
      buttons.forEach((btn) => {
        btn.classList.toggle("cc-active", btn.dataset.label === labelName);
      });
    }

    updateTextarea(toolbar, textarea);
  }

  function toggleDecoration(toolbar, textarea, decorationName) {
    const state = toolbar.ccState;
    const btn = toolbar.querySelector(`[data-decoration="${decorationName}"]`);

    const index = state.selectedDecorations.indexOf(decorationName);
    if (index > -1) {
      state.selectedDecorations.splice(index, 1);
      btn.classList.remove("cc-active");
    } else {
      state.selectedDecorations.push(decorationName);
      btn.classList.add("cc-active");
    }

    updateTextarea(toolbar, textarea);
  }

  function stripConventionalPrefix(text) {
    // Remove conventional comment prefix(es) from the start of text
    // Format: **label**: or **label (decorations)**:
    // Examples:
    //   **praise**:
    //   **suggestion (non-blocking)**:
    const prefixRegex = /^\*\*[\w-]+(?:\s*\([^)]+\))?\*\*:\s*/;
    let result = text;
    let iterations = 0;
    const maxIterations = 10; // Safety limit

    while (iterations < maxIterations) {
      const match = result.match(prefixRegex);
      if (!match) break;
      result = result.slice(match[0].length);
      iterations++;
    }
    return result;
  }

  function updateTextarea(toolbar, textarea) {
    const state = toolbar.ccState;

    // Always strip existing prefixes first
    const content = stripConventionalPrefix(textarea.value);

    if (!state.selectedLabel) {
      // No label selected, just keep the content without prefix
      if (textarea.value !== content) {
        textarea.value = content;
        triggerInput(textarea);
      }
      return;
    }

    // Build the new prefix
    const text = buildCommentText(
      state.selectedLabel,
      state.selectedDecorations,
      content,
    );

    textarea.value = text;
    triggerInput(textarea);

    // Place cursor after prefix
    const prefixEnd = text.indexOf("**: ") + 4;
    textarea.setSelectionRange(prefixEnd, prefixEnd);
    textarea.focus();
  }

  function triggerInput(textarea) {
    textarea.dispatchEvent(new Event("input", { bubbles: true }));
    textarea.dispatchEvent(new Event("change", { bubbles: true }));
  }

  function findCommentTextareas() {
    // GitHub uses various textarea selectors for comments
    const selectors = [
      'textarea[name="comment[body]"]',
      'textarea[name="pull_request_review_comment[body]"]',
      'textarea[name="pull_request_review[body]"]',
      'textarea[name="issue_comment[body]"]',
      "textarea.js-comment-field",
      'textarea[id^="new_comment_field"]',
      'textarea[aria-label="Add a comment"]',
      'textarea[placeholder*="comment"]',
      'textarea[placeholder*="Comment"]',
      'textarea[data-testid="markdown-editor-textarea"]',
    ];

    return document.querySelectorAll(selectors.join(", "));
  }

  function setupToolbar(textarea) {
    if (textarea.dataset.ccSetup) return;
    textarea.dataset.ccSetup = "true";

    // Find the parent container to insert toolbar
    const container =
      textarea.closest(".js-comment-container") ||
      textarea.closest(".comment-form-head")?.parentElement ||
      textarea.closest(".inline-comment-form") ||
      textarea.closest(".review-comment") ||
      textarea.closest('[data-testid="markdown-editor"]') ||
      textarea.parentElement;

    if (!container) return;

    const toolbar = createToolbar(textarea);

    // Insert toolbar before textarea or its wrapper
    const insertBefore =
      textarea.closest(".js-write-bucket") ||
      textarea.closest(".write-content") ||
      textarea.closest('[data-testid="markdown-editor"]') ||
      textarea;

    insertBefore.parentElement.insertBefore(toolbar, insertBefore);
  }

  function init() {
    injectStyles();

    // Setup existing textareas
    findCommentTextareas().forEach(setupToolbar);

    // Watch for new textareas (GitHub uses dynamic loading)
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        mutation.addedNodes.forEach((node) => {
          if (node.nodeType === Node.ELEMENT_NODE) {
            // Check if the added node is a textarea
            if (node.matches && node.matches("textarea")) {
              setupToolbar(node);
            }
            // Check for textareas within the added node
            const textareas = node.querySelectorAll
              ? node.querySelectorAll("textarea")
              : [];
            textareas.forEach(setupToolbar);
          }
        });
      });
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
    });

    // Also check periodically for dynamically rendered textareas
    setInterval(() => {
      findCommentTextareas().forEach(setupToolbar);
    }, 2000);
  }

  // Wait for page to be ready
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }

  // Re-init on GitHub's Turbo navigation
  document.addEventListener("turbo:load", init);
  document.addEventListener("pjax:end", init);
})();
