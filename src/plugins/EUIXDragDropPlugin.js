/**
 * EUIXDragDropPlugin.js
 * HTML5 & Pointer Drag and Drop Subsystem Plugin for EUIX Engine.
 * Provides touch, pointer, and HTML5 drag-and-drop mechanics with floating ghost previews.
 */

function resolveDraggableId(context, el) {
    if (context) {
        if (context.id !== undefined) return context.id;
        if (context.$item?.id !== undefined) return context.$item.id;
        if (context.item?.id !== undefined) return context.item.id;
        if (context.task?.id !== undefined) return context.task.id;
        if (context.card?.id !== undefined) return context.card.id;
        if (context._varName && context[context._varName]?.id !== undefined) return context[context._varName].id;
        for (const k of Object.keys(context)) {
            if (
                !k.startsWith("_") &&
                !k.startsWith("$") &&
                context[k] &&
                typeof context[k] === "object" &&
                context[k].id !== undefined
            ) {
                return context[k].id;
            }
        }
    }
    return el?.getAttribute ? el.getAttribute("data-id") || el.id || "" : "";
}

export const EUIXDragDropPlugin = {
    name: "dnd",
    install(engineClass) {
        const proto = engineClass.prototype;

        proto.enableDraggable = function (el, isDraggable, context = {}) {
            el.draggable = isDraggable;
            if (!isDraggable) return;

            el.style.userSelect = "none";
            el.style.webkitUserSelect = "none";
            el.style.webkitUserDrag = "element";

            el.addEventListener("dragstart", (e) => {
                this.handleDragEvent("dragstart", e, el, context);
            });

            el.addEventListener("pointerdown", (e) => {
                if (
                    e.target?.closest &&
                    (e.target.closest("button") || e.target.closest("input") || e.target.closest("select"))
                )
                    return;
                const taskId = resolveDraggableId(context, el);
                if (taskId) {
                    this.setState("dragged_id", String(taskId));

                    let ghost = null;
                    const startX = e.clientX;
                    const startY = e.clientY;

                    const onMove = (moveEvt) => {
                        if (
                            !ghost &&
                            (Math.abs(moveEvt.clientX - startX) > 3 || Math.abs(moveEvt.clientY - startY) > 3)
                        ) {
                            const old = document.getElementById("euix-drag-ghost");
                            if (old) old.remove();

                            const rect = el.getBoundingClientRect();
                            const cardWidth = rect.width || el.offsetWidth || 280;

                            ghost = el.cloneNode(true);
                            ghost.id = "euix-drag-ghost";
                            ghost.style.position = "fixed";
                            ghost.style.top = `${moveEvt.clientY - 20}px`;
                            ghost.style.left = `${moveEvt.clientX - 20}px`;
                            ghost.style.pointerEvents = "none";
                            ghost.style.zIndex = "999999";
                            ghost.style.opacity = "0.95";
                            ghost.style.boxShadow =
                                "0 20px 25px -5px rgba(0, 0, 0, 0.2), 0 8px 10px -6px rgba(0, 0, 0, 0.1)";
                            ghost.style.width = `${cardWidth}px`;
                            ghost.style.minWidth = `${cardWidth}px`;
                            ghost.style.maxWidth = `${cardWidth}px`;
                            ghost.style.boxSizing = "border-box";
                            ghost.style.transition = "none";
                            ghost.style.transform = "none";
                            document.body.appendChild(ghost);
                        } else if (ghost) {
                            ghost.style.left = `${moveEvt.clientX - 20}px`;
                            ghost.style.top = `${moveEvt.clientY - 20}px`;
                        }
                    };

                    const onUp = () => {
                        if (ghost) {
                            ghost.remove();
                            ghost = null;
                        }
                        window.removeEventListener("pointermove", onMove);
                        window.removeEventListener("pointerup", onUp);
                        window.removeEventListener("pointercancel", onUp);
                    };

                    window.addEventListener("pointermove", onMove, { passive: true });
                    window.addEventListener("pointerup", onUp, { once: true });
                    window.addEventListener("pointercancel", onUp, { once: true });
                }
            });
        };

        proto.handleDragEvent = function (eventType, e, el, context) {
            if (["dragover", "dragenter", "drop"].includes(eventType)) {
                e.preventDefault();
                if (e.dataTransfer) {
                    try {
                        e.dataTransfer.dropEffect = "move";
                    } catch (_) {}
                }
            }
            if (eventType === "dragstart") {
                const dragEl =
                    e.target && typeof e.target.closest === "function"
                        ? e.target.closest('[draggable="true"]') || el
                        : el;
                const dragVal = resolveDraggableId(context, dragEl);
                if (dragVal) {
                    this.setState("dragged_id", String(dragVal));
                }
                if (e.dataTransfer) {
                    try {
                        e.dataTransfer.setData("text/plain", String(dragVal || "task"));
                        e.dataTransfer.effectAllowed = "move";
                        if (dragEl && typeof e.dataTransfer.setDragImage === "function") {
                            e.dataTransfer.setDragImage(dragEl, 20, 20);
                        }
                    } catch (_) {}
                }
            }
            if (eventType === "drop" && e.dataTransfer) {
                try {
                    const droppedId = e.dataTransfer.getData("text/plain");
                    if (droppedId && droppedId !== "task") {
                        this.setState("dragged_id", droppedId);
                    }
                } catch (_) {}
            }
        };

        proto.setupDropListener = function (el, eventMap, context) {
            if (!eventMap.has("drop")) return;

            if (!eventMap.has("dragover")) {
                el.addEventListener("dragover", (e) => {
                    e.preventDefault();
                    if (e.dataTransfer) {
                        try {
                            e.dataTransfer.dropEffect = "move";
                        } catch (_) {}
                    }
                });
            }
            el.addEventListener("pointerup", (e) => {
                const draggedId = this.getState("dragged_id");
                if (draggedId) {
                    const dropHandlers = eventMap.get("drop") || [];
                    dropHandlers.forEach((node) => {
                        this.handleAction(node, context);
                    });
                    this.setState("dragged_id", "");
                }
            });
        };
    },
};

export default EUIXDragDropPlugin;
