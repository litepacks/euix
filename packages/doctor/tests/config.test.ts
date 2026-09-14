import { describe, expect, it } from "vitest";
import { applyDoctorConfig, collectFileSuppressions } from "../src/config/rules.js";
import type { Diagnostic } from "../src/ir/types.js";

describe("Doctor config and suppressions", () => {
    it("downgrades configured rules", () => {
        const diagnostics: Diagnostic[] = [
            {
                id: "EUIX1002:a:1:1",
                rule: "EUIX1002",
                severity: "warning",
                message: "unused",
                file: "/app/a.xml",
                line: 1,
                column: 1,
                confidence: "inferred",
            },
        ];

        const result = applyDoctorConfig(
            diagnostics,
            { rules: { EUIX1002: "off" } },
            new Map([["/app/a.xml", "<uid_spec/>"]]),
        );
        expect(result).toHaveLength(0);
    });

    it("suppresses diagnostics on marked lines", () => {
        const source = `<uid_spec>
<!-- euix-ignore-next-line EUIX1701 -->
<watch path="api.missing.status" />
</uid_spec>`;

        const suppressions = collectFileSuppressions(source);
        expect(suppressions.get(3)?.has("EUIX1701")).toBe(true);

        const diagnostics: Diagnostic[] = [
            {
                id: "EUIX1701:a:3:1",
                rule: "EUIX1701",
                severity: "error",
                message: "unknown API tag",
                file: "/app/a.xml",
                line: 3,
                column: 1,
                confidence: "confirmed",
            },
        ];

        const result = applyDoctorConfig(diagnostics, {}, new Map([["/app/a.xml", source]]));
        expect(result).toHaveLength(0);
    });
});
