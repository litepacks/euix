/**
 * src/core/state/Constants.js
 * Instance and global constants registry for EUIX Engine.
 */

export function registerGlobalConstant(EngineClass, name, value) {
    if (!EngineClass._globalConstants) EngineClass._globalConstants = new Map();
    EngineClass._globalConstants.set(name, value);
}

export function registerConstant(engine, name, value) {
    if (!engine.constants) engine.constants = new Map();
    engine.constants.set(name, value);
}

export function getConstant(engine, name) {
    if (engine.constants?.has(name)) return engine.constants.get(name);
    const EngineClass = engine ? engine.constructor : null;
    if (EngineClass?._globalConstants?.has(name)) {
        return EngineClass._globalConstants.get(name);
    }
    return undefined;
}
