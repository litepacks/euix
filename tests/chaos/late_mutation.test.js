import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { EUIXEngineCore } from '../../src/core/EUIXEngineCore.js';
import { EUIXResiliencePlugin } from '../../src/plugins/EUIXResiliencePlugin.js';
import { EUIXApiPlugin } from '../../src/plugins/EUIXApiPlugin.js';
import { createChaosFetchAdapter } from './chaos_engine.js';
import { assertNoLateStateMutation } from '../helpers/invariants.js';

EUIXEngineCore.use(EUIXResiliencePlugin).use(EUIXApiPlugin);

describe('EUIX Engine - Late Result State Pollution Protection Suite', () => {
  let container;

  beforeEach(() => {
    container = document.createElement('div');
    container.id = 'app';
    document.body.appendChild(container);
  });

  afterEach(() => {
    if (container && container.parentNode) {
      container.parentNode.removeChild(container);
    }
  });

  it('INVARIANT: Late resolving API request after timeout exit MUST NOT mutate application state', async () => {
    const chaos = createChaosFetchAdapter(424242);
    
    // Custom fetch mock that ignores cancellation signal to simulate late resolution
    let lateResolveFn;
    const ignoreAbortFetch = (url) => new Promise((resolve) => {
      lateResolveFn = () => resolve({
        ok: true,
        status: 200,
        json: async () => [{ id: 1, title: 'LATE_POLLUTED_DATA' }]
      });
    });

    const xml = `
      <uid_spec>
        <data_model>
          <state id="posts" type="array"></state>
          <state id="status">initial</state>
        </data_model>
        <container>
          <button id="btn">
            <on_click action="TRY">
              <timeout ms="20">
                <step action="XHR">
                  <url>https://api.example.com/posts</url>
                  <target>data.posts</target>
                </step>
              </timeout>
              <catch var="err">
                <step action="SET_STATE">
                  <path>data.status</path>
                  <value>caught_timeout</value>
                </step>
              </catch>
            </on_click>
            Fetch
          </button>
        </container>
      </uid_spec>
    `;

    const engine = EUIXEngineCore.mount(xml, container);
    engine.configureApi({
      onRequest: (config) => config
    });

    // Override fetch to ignore abort signal and delay resolution
    const originalFetch = globalThis.fetch;
    globalThis.fetch = ignoreAbortFetch;

    const button = container.querySelector('#btn');
    button.click();

    // 1. Wait for timeout to fire and catch block to execute
    await new Promise(r => setTimeout(r, 50));

    expect(engine.getState('status')).toBe('caught_timeout');
    expect(engine.getState('posts').length).toBe(0);

    const snapshotAtExit = JSON.stringify(engine.state);

    // 2. Force late API resolution AFTER timeout scope exit
    if (lateResolveFn) lateResolveFn();
    await new Promise(r => setTimeout(r, 50));

    // 3. Assert late result DID NOT pollute state
    expect(engine.getState('posts').length).toBe(0);
    assertNoLateStateMutation(engine, snapshotAtExit);

    globalThis.fetch = originalFetch;
    engine.unmount();
  });
});
