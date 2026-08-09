import fc from 'fast-check';

/**
 * Reusable fast-check Arbitraries for Structurally Valid EUIX Applications
 */

// Valid identifiers for state, actions, components
export const identifierArb = fc.stringMatching(/^[a-zA-Z][a-zA-Z0-9_]{1,12}$/);

// Primitive state values
export const statePrimitiveArb = fc.oneof(
  fc.string({ minLength: 1, maxLength: 20 }),
  fc.integer({ min: -1000, max: 1000 }),
  fc.boolean()
);

// State node generator
export const stateNodeArb = fc.tuple(identifierArb, statePrimitiveArb).map(([id, val]) => {
  const type = typeof val === 'number' ? 'type="number"' : typeof val === 'boolean' ? 'type="boolean"' : '';
  return `<state id="${id}" ${type}>${val}</state>`;
});

// Data model generator
export const dataModelArb = fc.array(stateNodeArb, { minLength: 1, maxLength: 5 }).map(nodes => {
  return `<data_model>\n  ${nodes.join('\n  ')}\n</data_model>`;
});

// Actions generator
export const basicActionArb = identifierArb.chain(targetId => {
  return fc.constantFrom(
    `<on_click action="SET_STATE"><path>data.${targetId}</path><value>updated_${targetId}</value></on_click>`,
    `<on_click action="TOGGLE_STATE"><path>data.${targetId}</path></on_click>`,
    `<on_click action="RUN_SCRIPT">console.log("script_${targetId}");</on_click>`
  );
});

// Resilience action generator
export const resilienceActionArb = identifierArb.chain(targetId => {
  return fc.constantFrom(
    `<on_click action="TRY"><timeout ms="100"><delay ms="20" /><step action="SET_STATE"><path>data.${targetId}</path><value>success</value></step></timeout><catch var="err"><step action="SET_STATE"><path>data.${targetId}</path><value>failed</value></step></catch></on_click>`,
    `<on_click action="TRY"><retry attempts="2" delay="10"><step action="SET_STATE"><path>data.${targetId}</path><value>retried</value></step></retry></on_click>`
  );
});

// Structural layout element generator
export const euixAppArb = fc.tuple(dataModelArb, fc.array(identifierArb, { minLength: 1, maxLength: 4 })).map(([dataModel, ids]) => {
  const bindings = ids.map(id => `
    <flex direction="row" gap="8">
      <span>Value for ${id}: {data.${id}}</span>
      <input bind="${id}" placeholder="Enter ${id}" />
      <button class="btn">
        <on_click action="SET_STATE">
          <path>data.${id}</path>
          <value>reset_${id}</value>
        </on_click>
        Reset ${id}
      </button>
    </flex>
  `).join('\n');

  return `
<uid_spec>
  ${dataModel}
  <container class="p-4">
    <h1>EUIX Dynamic Property App</h1>
    ${bindings}
  </container>
</uid_spec>
  `.trim();
});
