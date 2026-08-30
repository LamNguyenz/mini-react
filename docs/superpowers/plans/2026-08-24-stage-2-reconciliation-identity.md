# Stage 2 Reconciliation and Identity Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a synchronous host reconciler that preserves DOM identity, demonstrates positional identity failure, and then uses stable keys for list insertion, movement, and deletion.

**Architecture:** Stage 2 keeps disposable element descriptions but adds a retained record tree owned by each root. Every render synchronously resolves function components, compares ordered host/text records, and mutates the DOM during that same recursive pass; keyed sibling matching is added only after positional reuse demonstrates the wrong-identity problem.

**Tech Stack:** Plain JavaScript, browser ES modules, HTML, browser DOM APIs, the existing dependency-free browser assertion harness, and the existing Python static server workflow.

**Spec:** `docs/superpowers/specs/2026-08-24-stage-2-reconciliation-identity-design.md`

## Global Constraints

- The learner writes `src/stage-2/runtime.js` and `src/stage-2/app.js` by hand; the guide presents one failing behavior at a time, explains the problem and function responsibility, and reviews learner-authored code.
- Preserve Stage 0 and Stage 1 files and behavior unchanged. Stage 2 is separate under `src/stage-2/`, `tests/stage-2/`, `stage-2.html`, and `notes/stage-2-reconciliation.md`.
- Use branch `codex/stage-2-reconciliation` in the current workspace. Do not create a worktree. Do not use subagents without the learner's explicit permission.
- Preserve `createElement(type, props, ...children)`, `createRoot(container) -> { render(element), unmount() }`, and `mountTaskApp(container)` as the public API.
- Keep application state in the `mountTaskApp` closure. Function components are invoked again on every render and do not retain component records or state.
- Reconcile only host elements and text. Comparison and DOM mutation happen in one synchronous recursive pass.
- Introduce positional matching before keyed matching and record the positional wrong-identity behavior as evidence.
- Treat `key` as reserved reconciler metadata. It is not included in component props or applied to DOM nodes.
- Persistent component identity, class state, Fiber, separate render/commit phases, scheduling, lanes, Hooks, refs, effects, context, portals, Suspense, hydration, and error recovery are excluded.
- Serve browser modules over HTTP from `/Users/admin/Desktop/mini-react`. Use a fresh local port when the browser retains a stale ES-module graph.
- Run focused Stage 2 tests after every task. Run unchanged Stage 0 and Stage 1 suites before the final checkpoint.
- Keep each reviewed task in its own commit.

## File Map

- `src/stage-2/runtime.js` — Stage 2 element creation, normalization, retained records, positional and keyed child reconciliation, prop/event comparison, and root lifecycle.
- `src/stage-2/app.js` — the task application using closure state and Stage 2 rendering; adds stable task keys only after the unkeyed failure is observed.
- `stage-2.html` — visible Stage 2 application entry point using the unchanged Stage 0 stylesheet.
- `tests/stage-2/runtime.test.html` — browser report page for reconciliation mechanisms.
- `tests/stage-2/runtime.test.js` — black-box host/text identity, prop/event, positional, and keyed reconciliation tests.
- `tests/stage-2/task-app.test.html` — browser report page for task behavior and input identity.
- `tests/stage-2/task-app.test.js` — Stage 1 behavior parity with the Stage 2 identity expectation.
- `notes/stage-2-reconciliation.md` — standalone problem, mechanism, consequence, evidence, and pinned React source map.

---

### Task 1: Establish the Separate Stage 2 Runtime Baseline

**Files:**
- Create: `src/stage-2/runtime.js`
- Create: `tests/stage-2/runtime.test.html`
- Create: `tests/stage-2/runtime.test.js`

**Interfaces:**
- Consumes: the completed Stage 1 runtime and browser test contract.
- Produces: an isolated Stage 2 runtime baseline with the same initial `createElement` and `createRoot` behavior.

- [ ] **Step 1: Confirm the motivating Stage 1 behavior before copying**

Serve the repository on a fresh port:

```bash
python3 -m http.server 4210
```

Open:

```text
http://localhost:4210/tests/stage-1/runtime.test.html
```

Expected: `12/12 tests passed`. In the identity test, the second input is a different DOM object and focus is not transferred.

- [ ] **Step 2: Copy only the Stage 1 runtime baseline into Stage 2**

```bash
mkdir -p src/stage-2 tests/stage-2
cp src/stage-1/runtime.js src/stage-2/runtime.js
cp tests/stage-1/runtime.test.js tests/stage-2/runtime.test.js
cp tests/stage-1/runtime.test.html tests/stage-2/runtime.test.html
```

- [ ] **Step 3: Point the copied test module at Stage 2**

Change the runtime import in `tests/stage-2/runtime.test.js` to:

```js
import { createElement, createRoot } from "../../src/stage-2/runtime.js";
```

Change the `<title>` and `<h1>` in `tests/stage-2/runtime.test.html` to:

```html
<title>Stage 2 runtime tests</title>
<h1>Stage 2 runtime tests</h1>
```

- [ ] **Step 4: Run the isolated baseline**

Open:

```text
http://localhost:4210/tests/stage-2/runtime.test.html
```

Expected: `12/12 tests passed`. This confirms Stage 2 begins with the exact full-replacement limitation rather than an unexplained new renderer.

- [ ] **Step 5: Commit the isolated baseline**

```bash
git add src/stage-2/runtime.js tests/stage-2/runtime.test.html tests/stage-2/runtime.test.js
git commit -m "chore(stage-2): establish renderer baseline"
```

---

### Task 2: Retain Records and Reuse Same-Type Host and Text Nodes

**Files:**
- Modify: `tests/stage-2/runtime.test.js`
- Modify: `src/stage-2/runtime.js`

**Interfaces:**
- Consumes: Stage 2 `createElement` and `createRoot` from Task 1.
- Produces: normalized host/text specs; retained `{ kind, type/key/value, props, dom, children }` records; same-type host reuse; text-node reuse and updates.

- [ ] **Step 1: Replace the Stage 1 replacement test with the Stage 2 identity requirement**

Replace `"a second render replaces the previous DOM identity"` with:

```js
test("a second render preserves same-type host identity and browser state", () => {
  const fixture = createFixture();
  const root = createRoot(fixture);
  try {
    root.render(createElement("input", { id: "draft" }));
    const firstInput = fixture.querySelector("input");
    firstInput.value = "Uncommitted draft";
    firstInput.focus();

    root.render(createElement("input", { id: "draft" }));
    const nextInput = fixture.querySelector("input");

    assertEqual(firstInput === nextInput, true);
    assertEqual(firstInput.isConnected, true);
    assertEqual(nextInput.value, "Uncommitted draft");
    assertEqual(document.activeElement === nextInput, true);
  } finally {
    root.unmount();
    fixture.remove();
  }
});

test("updates text while preserving the host and text node objects", () => {
  const fixture = createFixture();
  const root = createRoot(fixture);
  try {
    root.render(createElement("p", null, "Before"));
    const paragraph = fixture.querySelector("p");
    const textNode = paragraph.firstChild;

    root.render(createElement("p", null, "After"));

    assertEqual(fixture.querySelector("p") === paragraph, true);
    assertEqual(paragraph.firstChild === textNode, true);
    assertEqual(textNode.nodeValue, "After");
  } finally {
    root.unmount();
    fixture.remove();
  }
});
```

- [ ] **Step 2: Run RED and explain the missing memory**

Reload the Stage 2 runtime page.

Expected: the new identity test fails because `container.replaceChildren(node)` disconnects the old input. Explain that an element description contains desired UI data but does not remember the DOM object created for the previous render.

- [ ] **Step 3: Introduce normalized specs and retained records**

Keep `createElement` unchanged for now. Add a normalization boundary shaped as follows:

```js
function resolveDescriptions(description) {
  if (description == null || typeof description === "boolean") return [];

  if (Array.isArray(description)) {
    return description.flatMap(resolveDescriptions);
  }

  if (typeof description === "string" || typeof description === "number") {
    return [{ kind: "text", key: null, value: String(description) }];
  }

  if (typeof description === "object" && typeof description.type === "function") {
    return resolveDescriptions(description.type(description.props));
  }

  if (typeof description === "object" && typeof description.type === "string") {
    return [{
      kind: "host",
      key: null,
      type: description.type,
      props: description.props,
    }];
  }

  throw new TypeError("Unsupported child description");
}
```

Add mount behavior that returns records rather than only DOM nodes:

```js
function mountRecord(spec) {
  if (spec.kind === "text") {
    return {
      kind: "text",
      key: spec.key,
      value: spec.value,
      dom: document.createTextNode(spec.value),
    };
  }

  const dom = document.createElement(spec.type);
  for (const [name, value] of Object.entries(spec.props)) {
    applyProp(dom, name, value);
  }

  const children = reconcileChildren(
    dom,
    [],
    resolveDescriptions(spec.props.children),
  );

  return {
    kind: "host",
    type: spec.type,
    key: spec.key,
    props: spec.props,
    dom,
    children,
  };
}
```

- [ ] **Step 4: Reconcile common positions without prop updates yet**

Add these record comparison functions:

```js
function hasSameType(record, spec) {
  return (
    record.kind === spec.kind &&
    (record.kind === "text" || record.type === spec.type)
  );
}

function reconcileRecord(parent, oldRecord, spec) {
  if (!hasSameType(oldRecord, spec)) {
    const nextRecord = mountRecord(spec);
    parent.replaceChild(nextRecord.dom, oldRecord.dom);
    return nextRecord;
  }

  if (spec.kind === "text") {
    if (oldRecord.value !== spec.value) {
      oldRecord.dom.nodeValue = spec.value;
    }
    oldRecord.value = spec.value;
    return oldRecord;
  }

  oldRecord.children = reconcileChildren(
    oldRecord.dom,
    oldRecord.children,
    resolveDescriptions(spec.props.children),
  );
  oldRecord.props = spec.props;
  return oldRecord;
}

function reconcileChildren(parent, oldRecords, nextSpecs) {
  const nextRecords = [];

  for (let index = 0; index < nextSpecs.length; index += 1) {
    const oldRecord = oldRecords[index];
    const spec = nextSpecs[index];

    if (oldRecord === undefined) {
      const nextRecord = mountRecord(spec);
      parent.append(nextRecord.dom);
      nextRecords.push(nextRecord);
      continue;
    }

    nextRecords.push(reconcileRecord(parent, oldRecord, spec));
  }

  return nextRecords;
}
```

This intentionally does not remove old extra children yet. That missing behavior becomes Task 4's failing test.

- [ ] **Step 5: Make `createRoot` own its retained child records**

Replace root-level full replacement with:

```js
export function createRoot(container) {
  let isUnmounted = false;
  let childRecords = [];

  if (!(container instanceof HTMLElement)) {
    throw new TypeError("createRoot requires an HTMLElement container");
  }

  function render(element) {
    if (isUnmounted) throw new Error("Cannot render an unmounted root");
    childRecords = reconcileChildren(
      container,
      childRecords,
      resolveDescriptions(element),
    );
  }

  function unmount() {
    if (isUnmounted) return;
    isUnmounted = true;
    childRecords = [];
    container.replaceChildren();
  }

  return { render, unmount };
}
```

Remove the old `renderDescription` function after all of its first-mount responsibilities have moved into `resolveDescriptions` and `mountRecord`.

- [ ] **Step 6: Run GREEN and commit**

Expected: `13/13 tests passed` on the Stage 2 runtime page.

```bash
git add src/stage-2/runtime.js tests/stage-2/runtime.test.js
git commit -m "feat(stage-2): preserve host and text identity"
```

---

### Task 3: Diff Supported Props and Event Handlers

**Files:**
- Modify: `tests/stage-2/runtime.test.js`
- Modify: `src/stage-2/runtime.js`

**Interfaces:**
- Consumes: reused host records with retained `props` from Task 2.
- Produces: `updateProps(node, oldProps, nextProps)` with symmetric add/change/remove behavior and stale-listener cleanup.

- [ ] **Step 1: Add failing prop and event update tests**

Append:

```js
test("updates and removes supported props on a reused host node", () => {
  const fixture = createFixture();
  const root = createRoot(fixture);
  try {
    root.render(
      createElement("input", {
        id: "before",
        checked: true,
        hidden: true,
        "data-state": "before",
        "aria-label": "Before",
      }),
    );
    const input = fixture.querySelector("input");

    root.render(createElement("input", { id: "after", checked: false }));

    assertEqual(fixture.querySelector("input") === input, true);
    assertEqual(input.id, "after");
    assertEqual(input.checked, false);
    assertEqual(input.hidden, false);
    assertEqual(input.hasAttribute("data-state"), false);
    assertEqual(input.hasAttribute("aria-label"), false);
  } finally {
    root.unmount();
    fixture.remove();
  }
});

test("replaces and removes event handlers without duplicate listeners", () => {
  const fixture = createFixture();
  const root = createRoot(fixture);
  let firstClicks = 0;
  let nextClicks = 0;
  const firstHandler = () => { firstClicks += 1; };
  const nextHandler = () => { nextClicks += 1; };

  try {
    root.render(createElement("button", { onClick: firstHandler }, "Run"));
    const button = fixture.querySelector("button");
    button.click();

    root.render(createElement("button", { onClick: nextHandler }, "Run"));
    button.click();

    root.render(createElement("button", null, "Run"));
    button.click();

    assertEqual(firstClicks, 1);
    assertEqual(nextClicks, 1);
  } finally {
    root.unmount();
    fixture.remove();
  }
});

test("rejects a non-function event prop", () => {
  const fixture = createFixture();
  const root = createRoot(fixture);
  try {
    assertThrows(
      () => root.render(createElement("button", { onClick: "invalid" })),
      TypeError,
      "Event prop onClick requires a function",
    );
  } finally {
    root.unmount();
    fixture.remove();
  }
});
```

- [ ] **Step 2: Run RED**

Expected: the host object is reused, but changed props retain their old values, removed props remain, and the old click listener still runs.

- [ ] **Step 3: Separate initial assignment, removal, and update**

Keep these shared tables at module scope:

```js
const DIRECT_PROPERTIES = new Set([
  "value",
  "checked",
  "hidden",
  "type",
  "id",
  "className",
  "htmlFor",
]);

const EVENT_NAMES = {
  onClick: "click",
  onSubmit: "submit",
  onChange: "change",
};
```

Use focused prop helpers:

```js
function setProp(node, name, value) {
  if (name === "children") return;

  if (DIRECT_PROPERTIES.has(name)) {
    node[name] = value;
    return;
  }

  if (name.startsWith("data-") || name.startsWith("aria-")) {
    node.setAttribute(name, String(value));
    return;
  }

  if (name in EVENT_NAMES) {
    if (typeof value !== "function") {
      throw new TypeError(`Event prop ${name} requires a function`);
    }
    node.addEventListener(EVENT_NAMES[name], value);
    return;
  }

  throw new TypeError(`Unsupported prop: ${name}`);
}

function removeProp(node, name, value) {
  if (name === "children") return;

  if (DIRECT_PROPERTIES.has(name)) {
    node[name] = typeof node[name] === "boolean" ? false : "";
    return;
  }

  if (name.startsWith("data-") || name.startsWith("aria-")) {
    node.removeAttribute(name);
    return;
  }

  if (name in EVENT_NAMES) {
    node.removeEventListener(EVENT_NAMES[name], value);
    return;
  }

  throw new TypeError(`Unsupported prop: ${name}`);
}

function updateProps(node, oldProps, nextProps) {
  for (const [name, oldValue] of Object.entries(oldProps)) {
    if (name === "children") continue;
    if (!(name in nextProps)) removeProp(node, name, oldValue);
  }

  for (const [name, nextValue] of Object.entries(nextProps)) {
    if (name === "children") continue;
    const oldValue = oldProps[name];
    if (oldValue === nextValue) continue;
    if (name in oldProps && name in EVENT_NAMES) {
      removeProp(node, name, oldValue);
    }
    setProp(node, name, nextValue);
  }
}
```

Replace the old `applyProp` function with these three helpers and remove its function-local property and event tables. Use `setProp` during `mountRecord`. In the same-type host branch of `reconcileRecord`, call:

```js
updateProps(oldRecord.dom, oldRecord.props, spec.props);
```

Do this before assigning `oldRecord.props = spec.props`.

- [ ] **Step 4: Run GREEN and commit**

Expected: `16/16 tests passed`.

```bash
git add src/stage-2/runtime.js tests/stage-2/runtime.test.js
git commit -m "feat(stage-2): diff host props and events"
```

---

### Task 4: Complete Positional Insertion, Replacement, and Deletion

**Files:**
- Modify: `tests/stage-2/runtime.test.js`
- Modify: `src/stage-2/runtime.js`

**Interfaces:**
- Consumes: ordered old records and next specs from Task 2.
- Produces: complete position-based mounting, replacement, trailing deletion, and correct DOM order.

- [ ] **Step 1: Add a failing positional child test**

Append:

```js
test("inserts, replaces, and deletes positional children", () => {
  const fixture = createFixture();
  const root = createRoot(fixture);
  try {
    root.render(
      createElement(
        "section",
        null,
        createElement("p", { "data-id": "a" }, "A"),
        createElement("p", { "data-id": "b" }, "B"),
      ),
    );
    const section = fixture.querySelector("section");
    const firstParagraph = section.children[0];
    const removedParagraph = section.children[1];

    root.render(
      createElement(
        "section",
        null,
        createElement("p", { "data-id": "a" }, "A updated"),
        createElement("span", { "data-id": "c" }, "C"),
        createElement("p", { "data-id": "d" }, "D"),
      ),
    );

    assertEqual(section.children[0] === firstParagraph, true);
    assertEqual(section.children[0].textContent, "A updated");
    assertEqual(section.children[1].tagName, "SPAN");
    assertEqual(section.children[2].textContent, "D");
    assertEqual(removedParagraph.isConnected, false);

    const lastParagraph = section.children[2];
    root.render(
      createElement(
        "section",
        null,
        createElement("p", { "data-id": "a" }, "A updated"),
      ),
    );

    assertEqual(section.children.length, 1);
    assertEqual(lastParagraph.isConnected, false);
  } finally {
    root.unmount();
    fixture.remove();
  }
});
```

- [ ] **Step 2: Run RED**

Expected: replacement and append may work, but old records beyond the next child count remain connected because Task 2 intentionally did not remove them.

- [ ] **Step 3: Complete positional cleanup and anchor insertion**

Replace `reconcileChildren` with this positional version:

```js
function reconcileChildren(parent, oldRecords, nextSpecs) {
  const nextRecords = [];

  for (let index = 0; index < nextSpecs.length; index += 1) {
    const oldRecord = oldRecords[index];
    const spec = nextSpecs[index];

    if (oldRecord === undefined) {
      const nextRecord = mountRecord(spec);
      const anchor = parent.childNodes[index] ?? null;
      parent.insertBefore(nextRecord.dom, anchor);
      nextRecords.push(nextRecord);
      continue;
    }

    nextRecords.push(reconcileRecord(parent, oldRecord, spec));
  }

  for (let index = nextSpecs.length; index < oldRecords.length; index += 1) {
    oldRecords[index].dom.remove();
  }

  return nextRecords;
}
```

- [ ] **Step 4: Run GREEN and commit**

Expected: `17/17 tests passed`.

```bash
git add src/stage-2/runtime.js tests/stage-2/runtime.test.js
git commit -m "feat(stage-2): reconcile positional children"
```

---

### Task 5: Rebuild the Task App and Preserve Input Identity

**Files:**
- Create: `src/stage-2/app.js`
- Create: `stage-2.html`
- Create: `tests/stage-2/task-app.test.html`
- Create: `tests/stage-2/task-app.test.js`
- Modify: `src/stage-2/app.js`
- Modify: `tests/stage-2/task-app.test.js`

**Interfaces:**
- Consumes: Stage 2 runtime positional reconciliation and the Stage 1 task behavior contract.
- Produces: `mountTaskApp(container)` using Stage 2; preserved input object, draft, and focus during unrelated rerenders.

- [ ] **Step 1: Copy the completed task app and its black-box tests**

```bash
cp src/stage-1/app.js src/stage-2/app.js
cp tests/stage-1/task-app.test.js tests/stage-2/task-app.test.js
cp tests/stage-1/task-app.test.html tests/stage-2/task-app.test.html
```

Change the app runtime import to:

```js
import { createElement, createRoot } from "./runtime.js";
```

Change the task test import to:

```js
import { mountTaskApp } from "../../src/stage-2/app.js";
```

Change the task test HTML title and heading to Stage 2.

- [ ] **Step 2: Create the visible Stage 2 page**

Create `stage-2.html`:

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Mini React — Stage 2</title>
    <link rel="stylesheet" href="./src/stage-0/styles.css" />
  </head>
  <body>
    <main id="app"></main>
    <script type="module">
      import { mountTaskApp } from "./src/stage-2/app.js";

      mountTaskApp(document.querySelector("#app"));
    </script>
  </body>
</html>
```

- [ ] **Step 3: Change the copied identity test to the Stage 2 requirement**

Replace the copied identity test with:

```js
test("a declarative rerender preserves DOM identity, draft, and focus", () => {
  const { fixture, cleanup } = mountFixture();
  try {
    const firstInput = fixture.querySelector("[data-task-input]");
    firstInput.value = "Uncommitted draft";
    firstInput.focus();

    fixture.querySelector('[data-filter="active"]').click();
    const nextInput = fixture.querySelector("[data-task-input]");

    assertEqual(firstInput === nextInput, true);
    assertEqual(firstInput.isConnected, true);
    assertEqual(nextInput.value, "Uncommitted draft");
    assertEqual(document.activeElement === nextInput, true);
  } finally {
    cleanup();
  }
});
```

- [ ] **Step 4: Run RED and identify the uncontrolled-input consequence**

Open:

```text
http://localhost:4210/tests/stage-2/task-app.test.html
```

Expected: the identity requirement passes, but successful task submission leaves the submitted title in the reused uncontrolled input. Stage 1 cleared it accidentally by replacing the node; Stage 2 must clear it deliberately.

- [ ] **Step 5: Clear the uncontrolled input only after successful submission**

In `handleSubmit`, after pushing the valid task and before `renderApp()`, clear the browser-owned draft explicitly:

```js
tasks.push(task);
input.value = "";
errorMessage = "";
renderApp();
```

This is not derived task UI synchronization. It is the explicit reset of an uncontrolled browser-owned value after consuming it.

- [ ] **Step 6: Run GREEN and verify the visible app**

Expected:

- Stage 2 task app: `8/8 tests passed`.
- Stage 2 runtime: `17/17 tests passed`.
- `http://localhost:4210/stage-2.html` adds, toggles, and filters tasks.
- Typing an unsubmitted draft and clicking a filter preserves the input object, draft, and focus.

- [ ] **Step 7: Commit the reconciled application**

```bash
git add src/stage-2/app.js stage-2.html tests/stage-2/task-app.test.html tests/stage-2/task-app.test.js
git commit -m "feat(stage-2): preserve task app host identity"
```

---

### Task 6: Reproduce the Positional List Identity Bug

**Files:**
- Modify: `tests/stage-2/runtime.test.js`

**Interfaces:**
- Consumes: position-based host reuse from Task 4.
- Produces: executable evidence that visible content can be correct while a DOM object's logical task identity is wrong.

- [ ] **Step 1: Add an observation test without changing the runtime**

Append:

```js
test("positional matching reuses the wrong logical row after a front insertion", () => {
  const fixture = createFixture();
  const root = createRoot(fixture);

  function TaskRow({ id, title }) {
    return createElement("li", { "data-task-id": id }, title);
  }

  function TaskList({ tasks }) {
    return createElement(
      "ul",
      null,
      tasks.map((task) => createElement(TaskRow, task)),
    );
  }

  try {
    root.render(
      createElement(TaskList, {
        tasks: [
          { id: "a", title: "Task A" },
          { id: "b", title: "Task B" },
        ],
      }),
    );

    const formerTaskARow = fixture.querySelector('[data-task-id="a"]');
    formerTaskARow.browserOwnedDraft = "belongs to task A";

    root.render(
      createElement(TaskList, {
        tasks: [
          { id: "x", title: "Task X" },
          { id: "a", title: "Task A" },
          { id: "b", title: "Task B" },
        ],
      }),
    );

    const firstRow = fixture.querySelector("li");
    assertEqual(firstRow === formerTaskARow, true);
    assertEqual(firstRow.dataset.taskId, "x");
    assertEqual(firstRow.browserOwnedDraft, "belongs to task A");
  } finally {
    root.unmount();
    fixture.remove();
  }
});
```

- [ ] **Step 2: Run the observation and explain it before keys**

Expected: `18/18 tests passed`. The test passes because it records the current bug: the DOM object that belonged to task A now displays task X merely because both rows occupied index zero.

The learner must explain why correct text does not prove correct identity before proceeding.

- [ ] **Step 3: Commit the reproduced limitation**

```bash
git add tests/stage-2/runtime.test.js
git commit -m "test(stage-2): reproduce positional identity bug"
```

---

### Task 7: Reserve Keys and Match Keyed Function-Component Output

**Files:**
- Modify: `tests/stage-2/runtime.test.js`
- Modify: `src/stage-2/runtime.js`
- Modify: `src/stage-2/app.js`

**Interfaces:**
- Consumes: normalized host/text specs and positional records.
- Produces: `createElement` descriptions with top-level `key`; key propagation through one-root function components; keyed sibling lookup and movement; stable task IDs in the app.

- [ ] **Step 1: Add failing key metadata and front-insertion tests**

Append:

```js
test("createElement reserves key outside props and the DOM", () => {
  const element = createElement("li", { key: "task-1", "data-id": "1" });
  assertEqual(element.key, "task-1");
  assertEqual("key" in element.props, false);

  const fixture = createFixture();
  const root = createRoot(fixture);
  try {
    root.render(element);
    assertEqual(fixture.querySelector("li").hasAttribute("key"), false);
  } finally {
    root.unmount();
    fixture.remove();
  }
});

test("stable keys preserve function-component row identity at front insertion", () => {
  const fixture = createFixture();
  const root = createRoot(fixture);

  function Row({ id }) {
    return createElement("li", { "data-id": id }, id);
  }

  const list = (ids) =>
    createElement(
      "ul",
      null,
      ids.map((id) => createElement(Row, { key: id, id })),
    );

  try {
    root.render(list(["a", "b"]));
    const rowA = fixture.querySelector('[data-id="a"]');
    const rowB = fixture.querySelector('[data-id="b"]');

    root.render(list(["x", "a", "b"]));
    const rows = [...fixture.querySelectorAll("li")];

    assertEqual(rows[0].dataset.id, "x");
    assertEqual(rows[1] === rowA, true);
    assertEqual(rows[2] === rowB, true);
  } finally {
    root.unmount();
    fixture.remove();
  }
});
```

- [ ] **Step 2: Run RED**

Expected: `createElement` has no top-level key, and positional matching reuses row A for X.

- [ ] **Step 3: Extract `key` in `createElement`**

Change the factory's prop copy and return shape to:

```js
const { key = null, ...copiedProps } = props ?? {};

return {
  type,
  key,
  props: {
    ...copiedProps,
    children: normalizeChildren(children),
  },
};
```

Update the existing `createElement` output test to assert `element.key === null` for an unkeyed description.

- [ ] **Step 4: Carry a function component call-site key to its single host output**

Expand the component first, then apply the component call site's key to its
single host output:

```js
if (
  typeof description === "object" &&
  typeof description.type === "function"
) {
  const output = description.type(description.props);
  const outputDescriptions = expandDescriptions(output);

  if (description.key != null && outputDescriptions.length !== 1) {
    throw new TypeError(
      "A keyed function component must return exactly one host root",
    );
  }

  if (
    outputDescriptions.length === 1 &&
    typeof outputDescriptions[0]?.type === "string"
  ) {
    const [outputDescription] = outputDescriptions;
    return [{ ...outputDescription, key: description.key }];
  }

  return outputDescriptions;
}
```

The explicit overwrite with `description.key`, including `null`, preserves key
scope: a key inside a component's returned host element does not become that
component's key among its parent's siblings.

- [ ] **Step 5: Match keys before reconciling and place records by anchor**

Replace positional `reconcileChildren` with:

```js
function reconcileChildren(parent, oldRecords, nextDescriptions) {
  const oldKeyed = new Map();
  const oldUnkeyedByIndex = new Map();

  for (const [index, record] of oldRecords.entries()) {
    if (record.key == null) {
      oldUnkeyedByIndex.set(index, record);
    } else {
      oldKeyed.set(record.key, record);
    }
  }

  const usedRecords = new Set();
  const nextRecords = [];

  for (let index = 0; index < nextDescriptions.length; index++) {
    const nextDescription = nextDescriptions[index];
    const oldRecord = nextDescription.key == null
      ? oldUnkeyedByIndex.get(index) ?? null
      : oldKeyed.get(nextDescription.key) ?? null;

    let nextRecord;
    if (oldRecord === null) {
      [nextRecord] = mountRecords(nextDescription);
    } else {
      usedRecords.add(oldRecord);
      nextRecord = reconcileRecord(parent, oldRecord, nextDescription);
    }

    const anchor = parent.childNodes[index] ?? null;
    if (nextRecord.dom !== anchor) {
      parent.insertBefore(nextRecord.dom, anchor);
    }
    nextRecords.push(nextRecord);
  }

  for (const oldRecord of oldRecords) {
    if (!usedRecords.has(oldRecord) && oldRecord.dom.parentNode === parent) {
      oldRecord.dom.remove();
    }
  }

  return nextRecords;
}
```

This still performs all comparison and DOM mutation synchronously. The map is only a sibling identity lookup, not Fiber or a separate planning phase.
Unkeyed children use their absolute sibling index as implicit identity; they are
not matched by their order among only the unkeyed children.

- [ ] **Step 6: Give task rows stable logical keys**

Change the task-row description in `src/stage-2/app.js` to:

```js
const taskRows = tasks.map((task) =>
  createElement(TaskRow, {
    key: task.id,
    task,
    toggleTask,
    activeFilter,
  }),
);
```

- [ ] **Step 7: Run GREEN and commit**

Expected:

- Stage 2 runtime: `22/22 tests passed`.
- Stage 2 task app: `8/8 tests passed`.
- The earlier unkeyed observation still passes because its rows intentionally omit keys.

```bash
git add src/stage-2/runtime.js src/stage-2/app.js tests/stage-2/runtime.test.js
git commit -m "feat(stage-2): reconcile children by stable key"
```

---

### Task 8: Prove Keyed Movement, Deletion, Replacement, and Root Boundaries

**Files:**
- Modify: `tests/stage-2/runtime.test.js`

**Interfaces:**
- Consumes: keyed sibling matching from Task 7.
- Produces: verified keyed movement/deletion/type replacement and a focused
  boundary for keyed function components that return multiple host roots.

React reports duplicate sibling keys with a development-only warning and keeps
reconciling; it does not throw. Stage 2 has no development/production diagnostic
layer, so duplicate-key warnings are deferred and duplicate-key behavior remains
unsupported.

- [ ] **Step 1: Add keyed movement, deletion, and type replacement coverage**

Append:

```js
test("key plus type determines identity during list reconciliation", () => {
  const fixture = createFixture();
  const root = createRoot(fixture);
  const row = (type, key, label) =>
    createElement(type, { key, "data-key": key }, label);

  try {
    root.render(
      createElement(
        "div",
        null,
        row("p", "a", "A"),
        row("p", "b", "B"),
        row("p", "c", "C"),
      ),
    );
    const itemA = fixture.querySelector('[data-key="a"]');
    const itemB = fixture.querySelector('[data-key="b"]');
    const itemC = fixture.querySelector('[data-key="c"]');

    root.render(
      createElement(
        "div",
        null,
        row("p", "c", "C"),
        row("span", "a", "A changed type"),
      ),
    );

    const children = [...fixture.querySelector("div").children];
    assertEqual(children[0] === itemC, true);
    assertEqual(children[1].tagName, "SPAN");
    assertEqual(children[1] === itemA, false);
    assertEqual(itemA.isConnected, false);
    assertEqual(itemB.isConnected, false);
  } finally {
    root.unmount();
    fixture.remove();
  }
});
```

- [ ] **Step 2: Add the keyed multi-root boundary test**

Append:

```js
test("rejects a keyed function component with multiple host roots", () => {
  const fixture = createFixture();
  const root = createRoot(fixture);

  function Pair() {
    return [
      createElement("span", null, "First"),
      createElement("span", null, "Second"),
    ];
  }

  try {
    assertThrows(
      () => root.render(createElement(Pair, { key: "pair" })),
      TypeError,
      "A keyed function component must return exactly one host root",
    );
    assertEqual(fixture.children.length, 0);
  } finally {
    root.unmount();
    fixture.remove();
  }
});
```

- [ ] **Step 3: Run GREEN and commit**

Expected: `24/24 tests passed`.

```bash
git add tests/stage-2/runtime.test.js \
  docs/superpowers/plans/2026-08-24-stage-2-reconciliation-identity.md \
  docs/superpowers/specs/2026-08-24-stage-2-reconciliation-identity-design.md
git commit -m "test(stage-2): cover keyed reconciliation boundaries"
```

---

### Task 9: Complete the Standalone Learning Note and React Source Map

**Files:**
- Create: `notes/stage-2-reconciliation.md`

**Interfaces:**
- Consumes: observed Stage 1 replacement failure, Stage 2 positional failure, keyed success evidence, and pinned React checkout `/Users/admin/Desktop/open-sources/react` at `52912a1453`.
- Produces: a standalone problem → mechanism → consequence explanation and learner explanation gate.

- [ ] **Step 1: Create the note from mechanisms actually built**

Create `notes/stage-2-reconciliation.md` with these sections and initial facts:

```markdown
# Reconciliation and Host Identity

## Problem

Replacing the complete DOM tree can display correct content while disconnecting
browser objects that own draft input values, focus, selection, and other local
state.

## Retained Record

An element description says what UI is wanted now. A retained record additionally
remembers the host or text DOM object, prior supported props, and rendered child
records so the next description can be compared with existing output.

## Positional Reuse

When an unkeyed child keeps the same type and position, the reconciler reuses its
DOM node, updates changed props and text, and recursively compares its children.
This preserves identity for stable structures but treats position as identity.

## Reproduced Positional Failure

Inserting a same-type row at the front makes the former first row display a new
task. Its browser-owned state follows the DOM object and therefore follows the
old position instead of the logical task.

## Stable Keys

A key identifies one logical child among its siblings. The same key and resolved
host type reuse a record; a new key mounts; an absent key deletes; and a matched
key at another position moves the existing DOM node.

## Host Operations

| Purpose | Stage 2 mechanism | Browser operation |
| --- | --- | --- |
| Reuse host | same type and identity | retain existing node |
| Update text | text record comparison | `textNode.nodeValue = value` |
| Update property | prop comparison | `node[name] = value` |
| Remove attribute | prop comparison | `node.removeAttribute(name)` |
| Replace listener | event comparison | `removeEventListener` then `addEventListener` |
| Insert or move | ordered child reconciliation | `parent.insertBefore(node, anchor)` |
| Replace type | record comparison | `parent.replaceChild(next, old)` |
| Delete child | unmatched old record | `node.remove()` |

## What This Record Tree Is Not

The records support synchronous host comparison only. They are not Fiber nodes:
they have no work-in-progress alternate, scheduling priority, update queue,
effect flags, or ability to pause and abandon calculation.

## React Source Map

| What we built | React boundary | What we understand | New mechanism deferred |
| --- | --- | --- | --- |
| Ordered sibling comparison | `ReactChildFiber` | Type, key, and position influence reuse | Fiber creation and alternate reuse |
| Keyed lookup | keyed child reconciliation | Stable sibling keys preserve logical identity | Production iterable and warning behavior |
| Placement and movement | placement decisions | Reused nodes may move instead of remount | Effect flags and separate commit traversal |
| Deletion | child deletion decisions | Unmatched old identity must be removed | Deletion effects and lifecycle cleanup |
| Text/prop updates | host update preparation | Existing host output can change in place | Host config payloads and commit timing |

## Mechanisms Intentionally Deferred

- Persistent function-component identity and component-owned state
- Class state and lifecycle methods
- Fiber work units and current/work-in-progress trees
- Separate render and commit phases
- Scheduling, priorities, and lanes
- Hooks, refs, effects, context, Suspense, and hydration

## Learner Explanation

1. Why can full replacement show correct content while losing browser-owned state?
2. What does a retained record remember that an element description does not?
3. Why does same type and position preserve identity for a stable tree?
4. How does a front insertion prove that position is not logical list identity?
5. Why must a key be stable and unique only among siblings?
6. What is the difference between insertion, movement, replacement, and deletion?
7. Why must changed event handlers remove the previous listener?
8. Why is this record tree not Fiber?
9. Which problem remains before component state can belong to function-component identity?
```

- [ ] **Step 2: Inspect only the pinned source boundary after the mechanism exists**

Read the exact pinned file without changing the React checkout's current branch:

```bash
git cat-file -t 52912a1453
git show 52912a1453:packages/react-reconciler/src/ReactChildFiber.js \
  | rg -n "reconcileChildFibers|reconcileChildrenArray|updateSlot|placeChild|deleteChild"
```

Run those commands from `/Users/admin/Desktop/open-sources/react`. Expected object type: `commit`, followed by matching function locations. Record only mappings supported by the exact source. Explain unfamiliar production mechanisms at a high level and mark their implementation deferred.

- [ ] **Step 3: Learner completes the explanation gate in their own words**

The guide asks one question at a time from `## Learner Explanation`, reviews the answer against observed Stage 2 behavior, and asks for correction when the explanation depends on an unexplained React function name.

- [ ] **Step 4: Commit the completed note**

After all nine answers are written beneath their questions:

```bash
git add notes/stage-2-reconciliation.md
git commit -m "docs(stage-2): record reconciliation findings"
```

---

### Task 10: Verify the Complete Workshop Checkpoint

**Files:**
- Verify only: all Stage 0, Stage 1, and Stage 2 files

**Interfaces:**
- Consumes: all Stage 2 tasks and unchanged earlier stages.
- Produces: a verified, clean Stage 2 checkpoint ready for branch integration.

- [ ] **Step 1: Start one fresh server for final browser verification**

```bash
python3 -m http.server 4211
```

- [ ] **Step 2: Verify all browser suites on the exact fresh origin**

Open each URL and inspect both the visible summary and console:

```text
http://localhost:4211/tests/stage-0/task-app.test.html
http://localhost:4211/tests/stage-1/runtime.test.html
http://localhost:4211/tests/stage-1/task-app.test.html
http://localhost:4211/tests/stage-2/runtime.test.html
http://localhost:4211/tests/stage-2/task-app.test.html
```

Expected:

- Stage 0 task app: `7/7 tests passed`.
- Stage 1 runtime: `12/12 tests passed`.
- Stage 1 task app: `8/8 tests passed`.
- Stage 2 runtime: `24/24 tests passed`.
- Stage 2 task app: `8/8 tests passed`.
- No unexpected console errors on any page.

- [ ] **Step 3: Recheck the existing JSX inspection contract**

```bash
npm run inspect:stage1-jsx
```

Expected: esbuild prints nested configured-factory calls and exits successfully.

- [ ] **Step 4: Inspect repository scope and checkpoint history**

```bash
git status --short --branch
git diff main...HEAD --stat
git log --oneline --decorate main..HEAD
```

Expected: the working tree is clean; changes are limited to the approved Stage 2 spec, plan, runtime, app, pages, tests, and note; Stage 0 and Stage 1 source files are unchanged.

- [ ] **Step 5: Create the Stage 2 tag only after learner approval**

```bash
git tag -a stage-2-reconciliation -m "Stage 2 reconciliation and identity complete"
```

Do not merge, push, or delete the feature branch until the learner chooses the branch-finishing action.
