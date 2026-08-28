import { describe, it, expect } from "vitest";
import { EUIXEngine } from "../src/EUIXEngine.js";

describe("User XML Template with Raw && and Named Loop Variables", () => {
    it("should parse raw && in attributes and execute RUN_SCRIPT with raw && and named variable task", async () => {
        const container = document.createElement("div");
        document.body.appendChild(container);

        const xml = `
<uid_spec>
  <data_model>
    <state id="newTask"></state>
    <state id="tasks" type="array">[{"id":"t1","title":"gece yürüyüşü","done":false},{"id":"t2","title":"sokak lambaları","done":true},{"id":"t3","title":"kahve içmek","done":false}]</state>
    <state id="filter">all</state>
  </data_model>

  <flex direction="column" gap="16" class="p-6 max-w-xl mx-auto">
    <flex direction="row" justify="between" align="center">
      <h1>Task Manager</h1>
    </flex>

    <flex direction="row" gap="8">
      <input bind="newTask" placeholder="Add a new task..." flex="1" class="input" />
      <button class="btn btn-primary" id="btn-add">
        <on_click action="RUN_SCRIPT">
          if ($data.newTask && $data.newTask.trim()) {
            $data.tasks.push({
              id: "t_" + Date.now(),
              title: $data.newTask.trim(),
              done: false
            });
            $data.newTask = "";
          }
        </on_click>
        Add
      </button>
    </flex>

    <flex direction="row" gap="8">
      <button class="btn btn-sm" id="btn-filter-all">
        <on_click action="RUN_SCRIPT">
          $data.filter = "all";
        </on_click>
        Tümü
      </button>
      <button class="btn btn-sm" id="btn-filter-active">
        <on_click action="RUN_SCRIPT">
          $data.filter = "active";
        </on_click>
        Aktif
      </button>
      <button class="btn btn-sm" id="btn-filter-done">
        <on_click action="RUN_SCRIPT">
          $data.filter = "done";
        </on_click>
        Tamamlanan
      </button>
    </flex>

    <for_each items="{data.tasks}" var="task" key="id">
      <if condition="{data.filter} == 'all' || ({data.filter} == 'active' && !{task.done}) || ({data.filter} == 'done' && {task.done})">
        <flex direction="row" justify="between" align="center" class="item-row">
          <flex direction="row" gap="8" align="center">
            <button class="btn btn-icon btn-toggle">
              <on_click action="RUN_SCRIPT">
                task.done = !task.done;
              </on_click>
              {task.done ? "✅" : "⬜"}
            </button>
            <span class="task-title" style="text-decoration: {task.done ? 'line-through' : 'none'};">{task.title}</span>
          </flex>
          <button class="btn btn-danger btn-del">
            <on_click action="RUN_SCRIPT">
              var idx = $data.tasks.findIndex(function(t){ return t.id === task.id; });
              if (idx >= 0) { $data.tasks.splice(idx, 1); }
            </on_click>
            🗑
          </button>
        </flex>
      </if>
    </for_each>
  </flex>
</uid_spec>
        `;

        const engine = EUIXEngine.mount(xml, container);
        expect(engine.getState("tasks").length).toBe(3);

        // 1. Check all 3 rows rendered initially
        let rows = container.querySelectorAll(".item-row");
        expect(rows.length).toBe(3);

        // 2. Toggle first task using task.done = !task.done
        const toggleBtns = container.querySelectorAll(".btn-toggle");
        toggleBtns[0].click();
        expect(engine.getState("tasks")[0].done).toBe(true);

        // 3. Filter active only (should show only t3 now)
        const btnActive = container.querySelector("#btn-filter-active");
        btnActive.click();
        rows = container.querySelectorAll(".item-row");
        expect(rows.length).toBe(1);
        expect(rows[0].querySelector(".task-title").textContent).toBe("kahve içmek");

        // 4. Filter done only (should show t1 and t2)
        const btnDone = container.querySelector("#btn-filter-done");
        btnDone.click();
        rows = container.querySelectorAll(".item-row");
        expect(rows.length).toBe(2);

        // 5. Delete t1 using raw task.id
        const delBtns = container.querySelectorAll(".btn-del");
        delBtns[0].click();
        expect(engine.getState("tasks").length).toBe(2);

        // 6. Filter all
        const btnAll = container.querySelector("#btn-filter-all");
        btnAll.click();
        rows = container.querySelectorAll(".item-row");
        expect(rows.length).toBe(2);
    });
});
