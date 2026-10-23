/**
 * src/core/renderer/ConditionalRenderer.js
 * Conditional logic (<if>, <else_if>, <else>) and dynamic child DOM node appending for EUIX Engine.
 */

import { isFn, getTagName, isElem } from "../utils/constants.js";

export function appendChildren(engine, fragment, nodes, context, { skipTags = [] } = {}) {
    if (!nodes) return fragment;
    const len = nodes.length;
    const hasSkip = skipTags && skipTags.length > 0;
    for (let i = 0; i < len; i++) {
        const child = nodes[i];
        if (hasSkip && isElem(child) && skipTags.includes(getTagName(child))) {
            continue;
        }
        const el = engine.createHTMLElement(child, context);
        if (el) fragment.appendChild(el);
    }
    return fragment;
}

const _SKIP_CONDITIONAL_TAGS = Object.freeze({ skipTags: ["else", "else_if"] });

function _parseConditionalBranches(xmlNode) {
    const branches = [];
    let current = {
        type: "if",
        condition: xmlNode.getAttribute("condition") || xmlNode.getAttribute("if") || "",
        nodes: [],
        sealed: false,
    };

    const children = xmlNode.childNodes;
    const len = children ? children.length : 0;
    for (let i = 0; i < len; i++) {
        const child = children[i];
        if (isElem(child)) {
            const tag = getTagName(child);
            if (tag === "else_if") {
                branches.push(current);
                current = {
                    type: "else_if",
                    condition: child.getAttribute("condition") || "",
                    nodes: Array.from(child.childNodes),
                    sealed: true,
                };
                continue;
            }
            if (tag === "else") {
                branches.push(current);
                current = {
                    type: "else",
                    condition: null,
                    nodes: Array.from(child.childNodes),
                    sealed: true,
                };
                continue;
            }
        }
        if (!current.sealed) {
            current.nodes.push(child);
        }
    }
    branches.push(current);
    return branches;
}

function _getConditionalActiveIndex(engine, branches, context) {
    const len = branches.length;
    for (let i = 0; i < len; i++) {
        const b = branches[i];
        if (b.type === "else" || engine.evalCondition(b.condition, context)) {
            return i;
        }
    }
    return -1;
}

function _renderConditionalBranch(engine, containerNode, branchNodes, context) {
    containerNode.innerHTML = "";
    if (branchNodes && branchNodes.length > 0) {
        const fragment = document.createDocumentFragment();
        engine.appendChildren(fragment, branchNodes, context, _SKIP_CONDITIONAL_TAGS);
        containerNode.appendChild(fragment);
    }
}

function _switchConditionalBranch(engine, containerNode, branches, newIndex, context) {
    const oldNodes = containerNode.children;
    const oldLen = oldNodes ? oldNodes.length : 0;
    const targetNodes = newIndex !== -1 ? branches[newIndex].nodes : null;

    if (oldLen > 0 && isFn(engine._runLeaveTransitionThenRemove)) {
        let pendingCount = oldLen;
        const onDone = () => {
            pendingCount--;
            if (pendingCount <= 0) {
                _renderConditionalBranch(engine, containerNode, targetNodes, context);
            }
        };
        const oldArr = Array.from(oldNodes);
        for (let i = 0; i < oldLen; i++) {
            engine._runLeaveTransitionThenRemove(oldArr[i], onDone);
        }
    } else {
        _renderConditionalBranch(engine, containerNode, targetNodes, context);
    }
}

export function renderConditional(engine, xmlNode, context = {}) {
    const containerNode = document.createElement("div");
    containerNode.className = "euix-if-branch";
    containerNode.style.display = "contents";

    const branches = _parseConditionalBranches(xmlNode);
    let activeIndex = _getConditionalActiveIndex(engine, branches, context);

    if (activeIndex !== -1) {
        engine.appendChildren(containerNode, branches[activeIndex].nodes, context, _SKIP_CONDITIONAL_TAGS);
    }

    const keys = new Set();
    const branchLen = branches.length;
    for (let i = 0; i < branchLen; i++) {
        const cond = branches[i].condition;
        if (cond) {
            const stateKeys = engine.extractStateKeys(cond);
            const kLen = stateKeys.length;
            for (let j = 0; j < kLen; j++) {
                keys.add(stateKeys[j]);
            }
        }
    }

    const updateFn = () => {
        const newIndex = _getConditionalActiveIndex(engine, branches, context);
        if (newIndex !== activeIndex) {
            activeIndex = newIndex;
            _switchConditionalBranch(engine, containerNode, branches, newIndex, context);
        }
    };

    for (const k of keys) {
        engine.registerBinding(k, containerNode, "conditional", updateFn);
    }

    return containerNode;
}
