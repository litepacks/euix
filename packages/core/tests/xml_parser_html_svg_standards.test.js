/**
 * packages/core/tests/xml_parser_html_svg_standards.test.js
 * Test suite for Item 5: XML Parser Non-standard & Case-Sensitive HTML/SVG Elements and Self-closing Tag AST Corrections
 */

import { describe, it, expect, beforeEach } from "vitest";
import { EUIXEngineCore } from "../src/core/EUIXEngineCore.js";
import { SVG_NAMESPACE } from "../src/core/utils/constants.js";
import { parseXmlToAst } from "../src/core/parser/AstParser.js";

describe("Item 5: XML Parser HTML/SVG Standards, Case-Sensitivity & Void Self-Closing Suite", () => {
    let container;

    beforeEach(() => {
        container = document.createElement("div");
        document.body.appendChild(container);
    });

    // -------------------------------------------------------------------------
    // 1. Case-Sensitive SVG Elements (clipPath, linearGradient, foreignObject, textPath)
    // -------------------------------------------------------------------------
    describe("1. Case-Sensitive SVG Elements", () => {
        it("should instantiate canonical camelCase SVG elements regardless of template casing", () => {
            const xml = `
                <uid_spec>
                    <svg width="200" height="200" viewBox="0 0 200 200">
                        <defs>
                            <lineargradient id="grad1">
                                <stop offset="0%" stop-color="red" />
                                <stop offset="100%" stop-color="blue" />
                            </lineargradient>
                            <radialgradient id="grad2">
                                <stop offset="0%" stop-color="white" />
                            </radialgradient>
                            <clippath id="clip1">
                                <rect width="50" height="50" />
                            </clippath>
                        </defs>
                        <foreignobject x="10" y="10" width="100" height="100">
                            <div>Embedded HTML</div>
                        </foreignobject>
                        <text>
                            <textpath href="#path1">Curved text</textpath>
                        </text>
                    </svg>
                </uid_spec>
            `;

            const engine = EUIXEngineCore.mount(xml, container);
            const svgEl = container.querySelector("svg");
            expect(svgEl).not.toBeNull();
            expect(svgEl.namespaceURI).toBe(SVG_NAMESPACE);

            // Verify linearGradient canonical casing
            const grad1 = container.querySelector("linearGradient, lineargradient");
            expect(grad1).not.toBeNull();
            expect(grad1.tagName).toBe("linearGradient");
            expect(grad1.namespaceURI).toBe(SVG_NAMESPACE);

            // Verify radialGradient canonical casing
            const grad2 = container.querySelector("radialGradient, radialgradient");
            expect(grad2).not.toBeNull();
            expect(grad2.tagName).toBe("radialGradient");
            expect(grad2.namespaceURI).toBe(SVG_NAMESPACE);

            // Verify clipPath canonical casing
            const clip1 = container.querySelector("clipPath, clippath");
            expect(clip1).not.toBeNull();
            expect(clip1.tagName).toBe("clipPath");
            expect(clip1.namespaceURI).toBe(SVG_NAMESPACE);

            // Verify foreignObject canonical casing
            const foreignObj = container.querySelector("foreignObject, foreignobject");
            expect(foreignObj).not.toBeNull();
            expect(foreignObj.tagName).toBe("foreignObject");
            expect(foreignObj.namespaceURI).toBe(SVG_NAMESPACE);

            // Verify textPath canonical casing
            const textPathEl = container.querySelector("textPath, textpath");
            expect(textPathEl).not.toBeNull();
            expect(textPathEl.tagName).toBe("textPath");
            expect(textPathEl.namespaceURI).toBe(SVG_NAMESPACE);
        });
    });

    // -------------------------------------------------------------------------
    // 2. Case-Sensitive SVG Canonical Attributes (viewBox, preserveAspectRatio, etc.)
    // -------------------------------------------------------------------------
    describe("2. Case-Sensitive SVG Canonical Attributes", () => {
        it("should apply canonical camelCase attribute names to SVG elements", () => {
            const xml = `
                <uid_spec>
                    <svg viewbox="0 0 100 100" preserveaspectratio="xMidYMid meet">
                        <defs>
                            <linearGradient id="g" gradientunits="userSpaceOnUse" gradienttransform="rotate(45)" />
                            <clipPath id="cp" clippathunits="objectBoundingBox" />
                        </defs>
                        <circle cx="50" cy="50" r="40" />
                    </svg>
                </uid_spec>
            `;

            const engine = EUIXEngineCore.mount(xml, container);
            const svgEl = container.querySelector("svg");
            expect(svgEl).not.toBeNull();

            // viewBox and preserveAspectRatio must be in canonical case for browser SVG rendering
            expect(svgEl.getAttribute("viewBox")).toBe("0 0 100 100");
            expect(svgEl.getAttribute("preserveAspectRatio")).toBe("xMidYMid meet");

            const grad = container.querySelector("linearGradient");
            expect(grad.getAttribute("gradientUnits")).toBe("userSpaceOnUse");
            expect(grad.getAttribute("gradientTransform")).toBe("rotate(45)");

            const clip = container.querySelector("clipPath");
            expect(clip.getAttribute("clipPathUnits")).toBe("objectBoundingBox");
        });
    });

    // -------------------------------------------------------------------------
    // 3. HTML Void Elements & Self-Closing Tag Handling
    // -------------------------------------------------------------------------
    describe("3. HTML Void Elements & Self-Closing Tags", () => {
        it("should auto-close unclosed void HTML tags without XML parse errors", () => {
            const xml = `
                <uid_spec>
                    <form>
                        <input type="text" name="username" value="guest">
                        <input type="password" name="pwd">
                        <hr>
                        <img src="avatar.png" alt="Avatar">
                        <br>
                    </form>
                </uid_spec>
            `;

            // Should parse without throwing XMLParseError
            const doc = parseXmlToAst(xml);
            expect(doc).not.toBeNull();
            expect(doc.querySelector("parsererror")).toBeNull();

            const engine = EUIXEngineCore.mount(xml, container);
            const inputs = container.querySelectorAll("input");
            expect(inputs.length).toBe(2);
            expect(inputs[0].type).toBe("text");
            expect(inputs[0].value).toBe("guest");
            expect(container.querySelector("hr")).not.toBeNull();
            expect(container.querySelector("img")).not.toBeNull();
            expect(container.querySelector("br")).not.toBeNull();
        });

        it("should clean up stray void closing tags (</input>, </img>, </br>)", () => {
            const xml = `
                <uid_spec>
                    <div>
                        <input type="text" value="hello"></input>
                        <img src="test.jpg"></img>
                        <br></br>
                    </div>
                </uid_spec>
            `;

            const engine = EUIXEngineCore.mount(xml, container);
            const input = container.querySelector("input");
            expect(input).not.toBeNull();
            expect(input.value).toBe("hello");
            expect(container.querySelector("img")).not.toBeNull();
        });
    });

    // -------------------------------------------------------------------------
    // 4. Attribute Values Containing '>' Characters
    // -------------------------------------------------------------------------
    describe("4. Attribute Values Containing '>' Characters", () => {
        it("should not prematurely close tags when attribute values contain '>' characters", () => {
            const xml = `
                <uid_spec>
                    <div>
                        <input type="text" placeholder="Threshold (> 100)" />
                        <button title="Next Step >">Next</button>
                    </div>
                </uid_spec>
            `;

            const engine = EUIXEngineCore.mount(xml, container);
            const input = container.querySelector("input");
            expect(input).not.toBeNull();
            expect(input.getAttribute("placeholder")).toBe("Threshold (> 100)");

            const button = container.querySelector("button");
            expect(button).not.toBeNull();
            expect(button.getAttribute("title")).toBe("Next Step >");
            expect(button.textContent.trim()).toBe("Next");
        });
    });

    // -------------------------------------------------------------------------
    // 5. Expanded HTML5 Elements (Preventing Fallback to <div>)
    // -------------------------------------------------------------------------
    describe("5. Expanded HTML5 Elements", () => {
        it("should render real HTML5 video, audio, canvas, and dialog elements instead of div fallback", () => {
            const xml = `
                <uid_spec>
                    <div>
                        <video src="movie.mp4" controls="true" width="320" height="240"></video>
                        <audio src="song.mp3"></audio>
                        <canvas id="myCanvas" width="200" height="200"></canvas>
                        <dialog id="myDialog">Dialog content</dialog>
                        <time datetime="2026-10-24">Today</time>
                        <progress value="70" max="100"></progress>
                        <table>
                            <thead>
                                <tr><th>Header</th></tr>
                            </thead>
                            <tbody>
                                <tr><td>Data</td></tr>
                            </tbody>
                            <tfoot>
                                <tr><td>Footer</td></tr>
                            </tfoot>
                        </table>
                    </div>
                </uid_spec>
            `;

            const engine = EUIXEngineCore.mount(xml, container);

            // Video element
            const video = container.querySelector("video");
            expect(video).not.toBeNull();
            expect(video.tagName.toLowerCase()).toBe("video");
            expect(video.getAttribute("src")).toBe("movie.mp4");

            // Audio element
            const audio = container.querySelector("audio");
            expect(audio).not.toBeNull();
            expect(audio.tagName.toLowerCase()).toBe("audio");

            // Canvas element
            const canvas = container.querySelector("canvas");
            expect(canvas).not.toBeNull();
            expect(canvas.tagName.toLowerCase()).toBe("canvas");

            // Dialog element
            const dialog = container.querySelector("dialog");
            expect(dialog).not.toBeNull();
            expect(dialog.tagName.toLowerCase()).toBe("dialog");

            // Time element
            const time = container.querySelector("time");
            expect(time).not.toBeNull();
            expect(time.tagName.toLowerCase()).toBe("time");
            expect(time.getAttribute("datetime")).toBe("2026-10-24");

            // Progress element
            const progress = container.querySelector("progress");
            expect(progress).not.toBeNull();
            expect(progress.tagName.toLowerCase()).toBe("progress");

            // Table structural elements (thead, tbody, tfoot)
            expect(container.querySelector("thead")).not.toBeNull();
            expect(container.querySelector("tbody")).not.toBeNull();
            expect(container.querySelector("tfoot")).not.toBeNull();
        });
    });

    // -------------------------------------------------------------------------
    // 6. SVG Tag Hierarchy & Namespace Inheritance
    // -------------------------------------------------------------------------
    describe("6. SVG Hierarchy & Namespace Inheritance", () => {
        it("should correctly propagate SVG namespace to all nested SVG children inside normal layout", () => {
            const xml = `
                <uid_spec>
                    <flex direction="column">
                        <h1>Chart</h1>
                        <svg width="100" height="100">
                            <g id="group1">
                                <circle cx="50" cy="50" r="20" fill="green" />
                                <text x="50" y="50">Center</text>
                            </g>
                        </svg>
                    </flex>
                </uid_spec>
            `;

            const engine = EUIXEngineCore.mount(xml, container);
            const svg = container.querySelector("svg");
            const g = container.querySelector("g");
            const circle = container.querySelector("circle");
            const text = container.querySelector("text");

            expect(svg.namespaceURI).toBe(SVG_NAMESPACE);
            expect(g.namespaceURI).toBe(SVG_NAMESPACE);
            expect(circle.namespaceURI).toBe(SVG_NAMESPACE);
            expect(text.namespaceURI).toBe(SVG_NAMESPACE);
        });
    });
});
