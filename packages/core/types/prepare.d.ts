/**
 * types/prepare.d.ts
 * TypeScript declarations for EUIX Prepare and Intermediate Representation (IR) Subsystem.
 */

import { EUIXEngineCore } from "./core";

export interface Diagnostic {
    code: string;
    type: string;
    file: string;
    path: string;
    message: string;
    severity?: "error" | "warning" | "info";
    suggestion?: string | null;
}

export interface RuntimeIRState {
    id: number;
    name: string;
    initial: any;
    type: string;
}

export interface RuntimeIRComputed {
    id: number;
    name: string;
    deps: string[];
    get: string;
}

export interface RuntimeIRAction {
    id: number;
    name: string;
    call: string;
    args?: any[];
    assign?: string | null;
    set?: Record<string, any> | null;
    mutate?: Record<string, any> | null;
}

export interface RuntimeIRComponent {
    id: number;
    name: string;
    src?: string | null;
    inline: boolean;
}

export interface RuntimeIRRoute {
    path: string;
    params: string[];
    name?: string | null;
    meta?: Record<string, any>;
}

export interface RuntimeIR {
    irVersion: number;
    route: RuntimeIRRoute | null;
    states: RuntimeIRState[];
    computed: RuntimeIRComputed[];
    actions: RuntimeIRAction[];
    components: RuntimeIRComponent[];
    watchers: Array<{ path: string; actionId: number | null; actionName: string | null }>;
    lifecycle: {
        mount: Array<{ actionId: number | null; actionName: string }>;
        unmount: Array<{ actionId: number | null; actionName: string }>;
    };
    view: any;
}

export class PreparedApp {
    ir: RuntimeIR;
    source: any;
    diagnostics: Diagnostic[];
    options: Record<string, any>;

    constructor(ir: RuntimeIR, source: any, diagnostics: Diagnostic[], options?: Record<string, any>);
    mount(containerSelector?: string | HTMLElement, mountOptions?: Record<string, any>): EUIXEngineCore;
    toJSON(): RuntimeIR;
    toXml(): string;
    renderToString(initialData?: Record<string, any>, renderOptions?: Record<string, any>): string;
    createSnapshot(options?: SnapshotOptions): Promise<SnapshotPayload>;
    verifySnapshot(snapshotDataOrPath: string | SnapshotPayload, options?: SnapshotOptions): Promise<SnapshotVerifyResult>;
}

export function renderToString(
    appOrIrOrSource: PreparedApp | RuntimeIR | Record<string, any> | string,
    initialData?: Record<string, any>,
    options?: Record<string, any>
): string;

export interface PrepareOptions {
    currentFile?: string;
    bypassCache?: boolean;
    strict?: boolean;
    resolveImport?: (specifier: string, currentFile: string) => Promise<any> | any;
    engineClass?: any;
    [key: string]: any;
}

export function prepare(source: string | Record<string, any>, options?: PrepareOptions): Promise<PreparedApp>;

export function mount(
    appOrSource: PreparedApp | RuntimeIR | string | Record<string, any>,
    containerSelector?: string | HTMLElement,
    options?: Record<string, any>
): EUIXEngineCore;

export function inspect(
    source: string | Record<string, any>,
    options?: PrepareOptions
): Promise<{
    file: string;
    route: RuntimeIRRoute | null;
    imports: Record<string, string>;
    states: string[];
    computed: string[];
    props: string[];
    actions: string[];
    components: string[];
    diagnostics: Diagnostic[];
}>;

export function validateSource(
    source: string | Record<string, any>,
    options?: PrepareOptions
): Promise<Diagnostic[]>;

export function clearPrepareCache(): void;

export interface LlmContextComponent {
    name: string;
    file: string;
    props: Record<string, any>;
}

export interface LlmContextRoute {
    path: string;
    params: string[];
    file: string;
}

export interface LlmContextData {
    components: LlmContextComponent[];
    routes: LlmContextRoute[];
    services: string[];
    actions: string[];
    states: Array<{ name: string; type: string }>;
}

export interface LlmContextResult {
    text: string;
    data: LlmContextData;
}

export interface LlmContextOptions {
    baseDir?: string;
    format?: "markdown" | "json";
}

export function generateLlmContext(
    targetPathOrFiles: string | string[],
    options?: LlmContextOptions
): Promise<LlmContextResult>;

export interface ConvertOptions {
    targetFormat?: "xml" | "json" | "auto";
    format?: "xml" | "json" | "auto";
    fileName?: string;
}

export function convert(source: string | Record<string, any>, options?: ConvertOptions): string;
export function jsonToXml(sourceJson: string | Record<string, any>, options?: Record<string, any>): string;
export function xmlToJson(xmlString: string, fileName?: string): Record<string, any>;

export interface FixItem {
    code: string;
    type: string;
    path: string;
    original: any;
    fixed: any;
    message: string;
}

export interface FixResult<T = string | Record<string, any>> {
    fixedSource: T;
    fixesApplied: FixItem[];
    remainingDiagnostics: Diagnostic[];
    modified: boolean;
}

export interface FixOptions {
    currentFile?: string;
    maxPasses?: number;
}

export function applyFixes<T = string | Record<string, any>>(
    source: T,
    diagnostics?: Diagnostic[] | null,
    options?: FixOptions
): Promise<FixResult<T>>;

export function fixSource<T = string | Record<string, any>>(
    source: T,
    options?: FixOptions
): Promise<FixResult<T>>;

export function generateSourceSchema(): Record<string, any>;

export interface SnapshotPayload {
    version: number;
    target: string;
    hash: string;
    createdAt: string;
    ir: RuntimeIR;
}

export interface SnapshotDiff {
    path: string;
    expected: any;
    actual: any;
    message: string;
}

export interface SnapshotVerifyResult {
    match: boolean;
    diffs: SnapshotDiff[];
    expectedHash: string | null;
    actualHash: string | null;
    target: string | null;
    exists?: boolean;
    snapshotPath?: string;
}

export interface SnapshotOptions {
    target?: string;
    currentFile?: string;
    fixedDate?: string;
    output?: string;
    [key: string]: any;
}

export function createSnapshot(
    sourceOrApp: PreparedApp | RuntimeIR | string | Record<string, any>,
    options?: SnapshotOptions
): Promise<SnapshotPayload>;

export function verifySnapshot(
    sourceOrApp: PreparedApp | RuntimeIR | string | Record<string, any>,
    snapshotDataOrPath: string | SnapshotPayload,
    options?: SnapshotOptions
): Promise<SnapshotVerifyResult>;

export function updateSnapshotFile(
    sourceFilePath: string,
    options?: SnapshotOptions
): Promise<{ snapshotPath: string; created: boolean; updated: boolean; snapshot: SnapshotPayload }>;

export function verifySnapshotFile(
    sourceFilePath: string,
    options?: SnapshotOptions
): Promise<SnapshotVerifyResult>;

export function resolveSnapshotPath(sourceFilePath: string, customOutput?: string): string;
export function diffStructural(expected: any, actual: any, propPath?: string, diffs?: SnapshotDiff[]): SnapshotDiff[];

