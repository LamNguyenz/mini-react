# Stage 3A Component Identity and State Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add persistent class-component identity, initial state, an explicit state-update queue, and synchronous `setState` updates while preserving the existing task application behavior.

**Architecture:** Stage 3 retains class-component records instead of expanding those components away. Each record owns one component instance, pending state updates, and one rendered child record; `setState` enqueues an update and asks the owning root to synchronously reconcile its last submitted description.

**Tech Stack:** Plain JavaScript, browser ES modules, HTML, browser DOM APIs, the dependency-free browser assertion harness, and one Python static server on port `4250`.

**Spec:** `docs/superpowers/specs/2026-09-02-stage-3a-component-state-design.md`

## Global Constraints

- Work on branch `codex/stage-3-component-state` in the existing checkout. Do not create a worktree.
- Do not use subagents without the learner's explicit permission.
- The learner writes runtime and application behavior by hand, one red-green task at a time. Explain the problem, responsibility, and acceptance criteria before code is written.
- Preserve Stages 0, 1, and 2 unchanged. Stage 3 lives only in `src/stage-3/`, `tests/stage-3/`, `stage-3.html`, and `notes/stage-3-component-state.md`.
- Preserve `createElement(type, props, ...children)`, `createRoot(container) -> { render(element), unmount() }`, and `mountTaskApp(container) -> { unmount() }`.
- Add `Component` as the only new public runtime API in Stage 3A.
- Keep stateless function components on the Stage 2 expansion path. Only classes extending `Component` receive persistent records and state.
- A class component must render exactly one non-empty root description. Arrays, fragments, portals, and `null` output remain explicitly deferred.
- Queue state updates but flush each external request synchronously. Do not add batching, timers, microtasks, priorities, or scheduling.
- Keep DOM comparison and mutation in the same recursive pass. Do not add Fiber, alternates, effect flags, or a separate commit phase.
- Do not add lifecycle callbacks in Stage 3A; they belong to Stage 3B.
- Use one server on port `4250`. Source edits do not require a restart; use a hard reload for a stale module graph.
- Run focused Stage 3 tests after each task and all earlier suites at the final checkpoint.
- Keep each reviewed task in its own commit.
- Leave `.codeflow/` and `src/stage-2/.codeflow/` untouched.

## File Map

- `src/stage-3/runtime.js` — element creation, host reconciliation, persistent component records, instances, state queues, and synchronous root updates.
- `src/stage-3/app.js` — the task application with state owned by a persistent `TaskApp` instance.
- `tests/stage-3/runtime.test.html` — browser report page for Stage 3 runtime mechanisms.
- `tests/stage-3/runtime.test.js` — component identity, state, props, keys, validation, and teardown tests.
- `tests/stage-3/task-app.test.html` — browser report page for the unchanged task-app contract.
- `tests/stage-3/task-app.test.js` — Stage 2 behavior and host-identity tests applied to Stage 3.
- `stage-3.html` — visible Stage 3 task application.
- `notes/stage-3-component-state.md` — problem, mechanism, evidence, learner explanations, and React source map.

---

### Task 1: Establish an Isolated Stage 3 Baseline

**Files:**
- Create: `src/stage-3/runtime.js`
- Create: `src/stage-3/app.js`
- Create: `tests/stage-3/runtime.test.html`
- Create: `tests/stage-3/runtime.test.js`
- Create: `tests/stage-3/task-app.test.html`
- Create: `tests/stage-3/task-app.test.js`
- Create: `stage-3.html`

**Interfaces:**
- Consumes: the completed Stage 2 runtime and task-app contract.
- Produces: an isolated Stage 3 baseline with the same public API and behavior.

- [ ] **Step 1: Confirm the one-server rule**

Run:

```bash
lsof -nP -iTCP:4250 -sTCP:LISTEN
```

Expected: exactly one Python process. If none exists, start one foreground terminal from `/Users/admin/Desktop/mini-react` with `python3 -m http.server 4250`. Do not start a second process when one is already listening.

- [ ] **Step 2: Copy the Stage 2 baseline without editing Stage 2**

Create these exact copies using `apply_patch` for repository writes:

```text
src/stage-2/runtime.js             -> src/stage-3/runtime.js
src/stage-2/app.js                 -> src/stage-3/app.js
tests/stage-2/runtime.test.js       -> tests/stage-3/runtime.test.js
tests/stage-2/runtime.test.html     -> tests/stage-3/runtime.test.html
tests/stage-2/task-app.test.js      -> tests/stage-3/task-app.test.js
tests/stage-2/task-app.test.html    -> tests/stage-3/task-app.test.html
stage-2.html                        -> stage-3.html
```

- [ ] **Step 3: Point all copied entry points at Stage 3**

Use these imports:

```js
// tests/stage-3/runtime.test.js
import { createElement, createRoot } from "../../src/stage-3/runtime.js";

// tests/stage-3/task-app.test.js
import { mountTaskApp } from "../../src/stage-3/app.js";
```

Change both test-page titles and headings from `Stage 2` to `Stage 3`. In `stage-3.html`, use:

```html
<title>Mini React — Stage 3</title>
<script type="module">
  import { mountTaskApp } from "./src/stage-3/app.js";
  mountTaskApp(document.querySelector("#app"));
</script>
```

- [ ] **Step 4: Verify the untouched baseline**

Open:

```text
http://localhost:4250/tests/stage-3/runtime.test.html
http://localhost:4250/tests/stage-3/task-app.test.html
```

Expected: runtime `24/24`; task app `8/8`; no unexpected console errors.

- [ ] **Step 5: Commit**

```bash
git add src/stage-3 tests/stage-3 stage-3.html
git commit -m "chore(stage-3): establish component-state baseline"
```

---

### Task 2: Reproduce the Missing Component State Owner

**Files:**
- Modify: `tests/stage-3/runtime.test.js`

**Interfaces:**
- Consumes: Stage 3's copied stateless function-component behavior.
- Produces: direct evidence that one function call's local data does not become the next call's state.

- [ ] **Step 1: Add the observation test before `run()`**

```js
test("function-local data is recreated on every component call", () => {
  const fixture = createFixture();
  const root = createRoot(fixture);
  let incrementPreviousCall;

  function TemporaryCounter() {
    let count = 0;
    incrementPreviousCall = () => {
      count += 1;
    };
    return createElement("button", null, String(count));
  }

  try {
    root.render(createElement(TemporaryCounter));
    incrementPreviousCall();
    root.render(createElement(TemporaryCounter));
    assertEqual(fixture.querySelector("button").textContent, "0");
  } finally {
    root.unmount();
    fixture.remove();
  }
});
```

- [ ] **Step 2: Run and explain the observation**

Expected: runtime `25/25`. The first closure changed its own `count` to `1`; the next component call created a different `count` initialized to `0`.

- [ ] **Step 3: Commit**

```bash
git add tests/stage-3/runtime.test.js
git commit -m "test(stage-3): reproduce missing component state"
```

---

### Task 3: Mount the First Persistent Class Component

**Files:**
- Modify: `tests/stage-3/runtime.test.js`
- Modify: `src/stage-3/runtime.js`

**Interfaces:**
- Consumes: Stage 2 host/text records and function expansion.
- Produces: exported `Component`; retained component record; `getDom(record)`; single-root class mounting.

- [ ] **Step 1: Make a missing export fail inside the harness**

Replace the Stage 3 runtime import with:

```js
import * as MiniReact from "../../src/stage-3/runtime.js";
const { createElement, createRoot } = MiniReact;
```

- [ ] **Step 2: Write the failing initial-state test**

```js
test("mounts a class component from persistent initial state", () => {
  const fixture = createFixture();
  const root = createRoot(fixture);
  let instance;

  class Counter extends MiniReact.Component {
    constructor(props) {
      super(props);
      instance = this;
      this.state = { count: props.initialCount };
    }
    render() {
      return createElement("button", { "data-counter": "" }, this.state.count);
    }
  }

  try {
    root.render(createElement(Counter, { initialCount: 2 }));
    assertEqual(instance.props.initialCount, 2);
    assertEqual(instance.state.count, 2);
    assertEqual(fixture.querySelector("button").textContent, "2");
  } finally {
    root.unmount();
    fixture.remove();
  }
});
```

- [ ] **Step 3: Run RED**

Expected: the new test reports that `MiniReact.Component` is undefined.

- [ ] **Step 4: Add the base class and classifier near the top of `runtime.js`**

```js
export class Component {
  constructor(props) {
    this.props = props;
    this.state = {};
    this.__status = "constructing";
    this.__enqueueStateUpdate = null;
  }

  setState() {
    throw new Error("Cannot update component state before mounting");
  }
}

function isClassComponentDescription(description) {
  return (
    description !== null &&
    typeof description === "object" &&
    typeof description.type === "function" &&
    description.type.prototype instanceof Component
  );
}
```

In `expandDescriptions`, return `[description]` for a class description before the existing function-component branch invokes the type.

- [ ] **Step 5: Add output and DOM helpers**

```js
function resolveSingleComponentOutput(output) {
  const descriptions = expandDescriptions(output);
  if (descriptions.length !== 1) {
    throw new TypeError(
      "A class component must return exactly one non-empty root",
    );
  }
  return descriptions[0];
}

function getDom(record) {
  return record.kind === "component" ? getDom(record.child) : record.dom;
}
```

Use `getDom(record)` instead of direct `.dom` access in generic placement, removal, replacement, and host-child append operations.

- [ ] **Step 6: Mount the component record before the host branch**

```js
if (isClassComponentDescription(description)) {
  const instance = new description.type(description.props);
  if (
    instance.state === null ||
    typeof instance.state !== "object" ||
    Array.isArray(instance.state)
  ) {
    throw new TypeError("Component state must be an object");
  }

  instance.__status = "rendering";
  const childDescription = resolveSingleComponentOutput(instance.render());
  const [child] = mountRecords(childDescription);
  instance.__status = "mounted";

  return [{
    kind: "component",
    type: description.type,
    key: description.key ?? null,
    props: description.props,
    instance,
    pendingUpdates: [],
    child,
  }];
}
```

- [ ] **Step 7: Run GREEN and commit**

Expected: Stage 3 runtime `26/26`; Stage 2 runtime remains `24/24`.

```bash
git add src/stage-3/runtime.js tests/stage-3/runtime.test.js
git commit -m "feat(stage-3): mount persistent component records"
```

---

### Task 4: Reconcile the Same Instance with New Props

**Files:**
- Modify: `tests/stage-3/runtime.test.js`
- Modify: `src/stage-3/runtime.js`

**Interfaces:**
- Consumes: component records and `resolveSingleComponentOutput`.
- Produces: class type/key reuse, next `instance.props`, and reconciliation of the retained child.

- [ ] **Step 1: Write the failing test**

```js
test("reuses a class instance and gives it the next props", () => {
  const fixture = createFixture();
  const root = createRoot(fixture);
  const instances = [];

  class Greeting extends MiniReact.Component {
    constructor(props) {
      super(props);
      instances.push(this);
      this.state = { punctuation: "!" };
    }
    render() {
      return createElement("p", null, this.props.name, this.state.punctuation);
    }
  }

  try {
    root.render(createElement(Greeting, { name: "Ada" }));
    const paragraph = fixture.querySelector("p");
    root.render(createElement(Greeting, { name: "Grace" }));

    assertEqual(instances.length, 1);
    assertEqual(fixture.querySelector("p") === paragraph, true);
    assertEqual(paragraph.textContent, "Grace!");
    assertEqual(instances[0].props.name, "Grace");
  } finally {
    root.unmount();
    fixture.remove();
  }
});
```

- [ ] **Step 2: Run RED**

Expected: a second instance is constructed because `hasSameType` recognizes only text and host records.

- [ ] **Step 3: Extend `hasSameType`**

```js
if (oldRecord.kind === "component") {
  return (
    isClassComponentDescription(description) &&
    oldRecord.type === description.type
  );
}
```

- [ ] **Step 4: Reconcile a retained component before the host branch**

```js
if (oldRecord.kind === "component") {
  oldRecord.props = description.props;
  oldRecord.instance.props = description.props;
  oldRecord.instance.__status = "rendering";
  const nextChildDescription = resolveSingleComponentOutput(
    oldRecord.instance.render(),
  );
  oldRecord.child = reconcileRecord(
    parent,
    oldRecord.child,
    nextChildDescription,
  );
  oldRecord.instance.__status = "mounted";
  return oldRecord;
}
```

- [ ] **Step 5: Run GREEN and commit**

Expected: Stage 3 runtime `27/27`.

```bash
git add src/stage-3/runtime.js tests/stage-3/runtime.test.js
git commit -m "feat(stage-3): preserve component identity across props"
```

---

### Task 5: Queue and Flush Object State Updates Synchronously

**Files:**
- Modify: `tests/stage-3/runtime.test.js`
- Modify: `src/stage-3/runtime.js`

**Interfaces:**
- Consumes: retained component records.
- Produces: `Component.prototype.setState(update)`; root-owned synchronous update requests; object-update reduction.

- [ ] **Step 1: Write the failing object-update test**

```js
test("setState shallowly merges state and preserves host identity", () => {
  const fixture = createFixture();
  const root = createRoot(fixture);
  let instance;

  class Counter extends MiniReact.Component {
    constructor(props) {
      super(props);
      instance = this;
      this.state = { count: 0, label: "Count" };
    }
    render() {
      return createElement(
        "button",
        { onClick: () => this.setState({ count: 1 }) },
        `${this.state.label}: ${this.state.count}`,
      );
    }
  }

  try {
    root.render(createElement(Counter));
    const button = fixture.querySelector("button");
    button.click();

    assertEqual(fixture.querySelector("button") === button, true);
    assertEqual(button.textContent, "Count: 1");
    assertEqual(instance.state.count, 1);
    assertEqual(instance.state.label, "Count");
  } finally {
    root.unmount();
    fixture.remove();
  }
});
```

- [ ] **Step 2: Run RED**

Expected: clicking throws `Cannot update component state before mounting`.

- [ ] **Step 3: Give `createRoot` a reusable synchronous render operation**

Replace the root closure state and render path with:

```js
let isUnmounted = false;
let isRendering = false;
let currentElement = null;
let childRecords = [];

const rootContext = {
  get isRendering() {
    return isRendering;
  },
  requestRender() {
    performRender();
  },
};

function performRender() {
  if (isRendering) {
    throw new Error("Cannot update state while rendering");
  }
  isRendering = true;
  try {
    const nextDescriptions = expandDescriptions(currentElement);
    childRecords = reconcileChildren(
      container,
      childRecords,
      nextDescriptions,
      rootContext,
    );
  } finally {
    isRendering = false;
  }
}

function render(element) {
  if (isUnmounted) {
    throw new Error("Cannot render an unmounted root");
  }
  currentElement = element;
  performRender();
}
```

Keep `unmount()` idempotent and rename its flag consistently to `isUnmounted`.

- [ ] **Step 4: Thread one root context through the record tree**

Use these exact signatures and forward `rootContext` from every recursive caller:

```js
reconcileChildren(parent, oldRecords, nextDescriptions, rootContext)
reconcileRecord(parent, oldRecord, description, rootContext)
mountRecords(description, rootContext)
```

- [ ] **Step 5: Connect the mounted instance to its record**

Create the component record before rendering its child, then attach:

```js
instance.__enqueueStateUpdate = (update) => {
  if (rootContext.isRendering) {
    throw new Error("Cannot update state while rendering");
  }
  record.pendingUpdates.push(update);
  rootContext.requestRender();
};
```

Mount the child with `mountRecords(childDescription, rootContext)`, assign `record.child`, and return `[record]`.

- [ ] **Step 6: Implement object `setState` and queue reduction**

Replace the temporary method with:

```js
setState(update) {
  if (this.__status === "constructing") {
    throw new Error("Cannot update state during component construction");
  }
  if (this.__status === "rendering") {
    throw new Error("Cannot update state while rendering");
  }
  if (this.__status === "unmounted" || this.__enqueueStateUpdate === null) {
    throw new Error("Cannot update an unmounted component");
  }
  if (update === null || typeof update !== "object" || Array.isArray(update)) {
    throw new TypeError("setState requires an object or updater function");
  }
  this.__enqueueStateUpdate(update);
}
```

Add:

```js
function processPendingState(record) {
  let nextState = record.instance.state;
  for (const update of record.pendingUpdates) {
    nextState = { ...nextState, ...update };
  }
  record.pendingUpdates = [];
  record.instance.state = nextState;
}
```

Call `processPendingState(oldRecord)` after assigning next props and before calling `instance.render()`.

- [ ] **Step 7: Run GREEN and commit**

Expected: Stage 3 runtime `28/28`.

```bash
git add src/stage-3/runtime.js tests/stage-3/runtime.test.js
git commit -m "feat(stage-3): flush object state updates synchronously"
```

---

### Task 6: Apply Functional Updates Against the Latest State

**Files:**
- Modify: `tests/stage-3/runtime.test.js`
- Modify: `src/stage-3/runtime.js`

**Interfaces:**
- Consumes: object-form pending updates and synchronous root requests.
- Produces: updater functions `(pendingState, props) -> partialState` and result validation.

- [ ] **Step 1: Write the failing functional-update test**

```js
test("functional updates receive the latest state and props", () => {
  const fixture = createFixture();
  const root = createRoot(fixture);

  class Counter extends MiniReact.Component {
    constructor(props) {
      super(props);
      this.state = { count: 0 };
    }
    render() {
      return createElement(
        "button",
        {
          onClick: () => {
            this.setState((state, props) => ({
              count: state.count + props.step,
            }));
            this.setState((state, props) => ({
              count: state.count + props.step,
            }));
          },
        },
        this.state.count,
      );
    }
  }

  try {
    root.render(createElement(Counter, { step: 2 }));
    fixture.querySelector("button").click();
    assertEqual(fixture.querySelector("button").textContent, "4");
  } finally {
    root.unmount();
    fixture.remove();
  }
});
```

- [ ] **Step 2: Run RED**

Expected: `setState` rejects the updater function.

- [ ] **Step 3: Accept functions and reduce them in order**

Allow `typeof update === "function"` in `setState`. Replace the reduction loop with:

```js
for (const update of record.pendingUpdates) {
  const partialState =
    typeof update === "function"
      ? update(nextState, record.instance.props)
      : update;

  if (
    partialState === null ||
    typeof partialState !== "object" ||
    Array.isArray(partialState)
  ) {
    throw new TypeError("A state updater must return an object");
  }
  nextState = { ...nextState, ...partialState };
}
```

- [ ] **Step 4: Add updater-result validation**

```js
test("rejects a functional updater that returns a non-object", () => {
  const fixture = createFixture();
  const root = createRoot(fixture);
  let instance;

  class Counter extends MiniReact.Component {
    constructor(props) {
      super(props);
      instance = this;
    }
    render() {
      return createElement("button", null, "Counter");
    }
  }

  try {
    root.render(createElement(Counter));
    assertThrows(
      () => instance.setState(() => null),
      TypeError,
      "A state updater must return an object",
    );
  } finally {
    root.unmount();
    fixture.remove();
  }
});
```

- [ ] **Step 5: Run GREEN and commit**

Expected: Stage 3 runtime `30/30`.

```bash
git add src/stage-3/runtime.js tests/stage-3/runtime.test.js
git commit -m "feat(stage-3): support functional state updates"
```

---

### Task 7: Preserve Independent State Through Keyed Movement

**Files:**
- Modify: `tests/stage-3/runtime.test.js`
- Modify: `src/stage-3/runtime.js` only if the tests expose an integration defect.

**Interfaces:**
- Consumes: keyed reconciliation, component records, and `getDom(record)`.
- Produces: proof that state follows component identity instead of host position.

- [ ] **Step 1: Test independent instances**

```js
test("separate component instances own independent state", () => {
  const fixture = createFixture();
  const root = createRoot(fixture);

  class Counter extends MiniReact.Component {
    constructor(props) {
      super(props);
      this.state = { count: 0 };
    }
    render() {
      return createElement(
        "button",
        {
          "data-id": this.props.id,
          onClick: () =>
            this.setState((state) => ({ count: state.count + 1 })),
        },
        `${this.props.id}:${this.state.count}`,
      );
    }
  }

  try {
    root.render(createElement(
      "div",
      null,
      createElement(Counter, { key: "a", id: "a" }),
      createElement(Counter, { key: "b", id: "b" }),
    ));
    fixture.querySelector('[data-id="a"]').click();
    assertEqual(fixture.querySelector('[data-id="a"]').textContent, "a:1");
    assertEqual(fixture.querySelector('[data-id="b"]').textContent, "b:0");
  } finally {
    root.unmount();
    fixture.remove();
  }
});
```

- [ ] **Step 2: Test keyed movement**

```js
test("keyed movement preserves component state and host identity", () => {
  const fixture = createFixture();
  const root = createRoot(fixture);

  class Counter extends MiniReact.Component {
    constructor(props) {
      super(props);
      this.state = { count: 0 };
    }
    render() {
      return createElement(
        "button",
        {
          "data-id": this.props.id,
          onClick: () =>
            this.setState((state) => ({ count: state.count + 1 })),
        },
        `${this.props.id}:${this.state.count}`,
      );
    }
  }

  const view = (ids) => createElement(
    "div",
    null,
    ids.map((id) => createElement(Counter, { key: id, id })),
  );

  try {
    root.render(view(["a", "b"]));
    const buttonA = fixture.querySelector('[data-id="a"]');
    const buttonB = fixture.querySelector('[data-id="b"]');
    buttonA.click();
    root.render(view(["b", "a"]));
    const buttons = [...fixture.querySelectorAll("button")];

    assertEqual(buttons[0] === buttonB, true);
    assertEqual(buttons[1] === buttonA, true);
    assertEqual(buttons[1].textContent, "a:1");
  } finally {
    root.unmount();
    fixture.remove();
  }
});
```

- [ ] **Step 3: Test movement through a nested component record**

```js
test("nested component records expose their host node for movement", () => {
  const fixture = createFixture();
  const root = createRoot(fixture);

  class Leaf extends MiniReact.Component {
    render() {
      return createElement("span", { "data-id": this.props.id }, this.props.id);
    }
  }

  class Wrapper extends MiniReact.Component {
    render() {
      return createElement(Leaf, { id: this.props.id });
    }
  }

  const view = (ids) => createElement(
    "div",
    null,
    ids.map((id) => createElement(Wrapper, { key: id, id })),
  );

  try {
    root.render(view(["a", "b"]));
    const spanA = fixture.querySelector('[data-id="a"]');
    const spanB = fixture.querySelector('[data-id="b"]');
    root.render(view(["b", "a"]));
    const spans = [...fixture.querySelectorAll("span")];

    assertEqual(spans[0] === spanB, true);
    assertEqual(spans[1] === spanA, true);
  } finally {
    root.unmount();
    fixture.remove();
  }
});
```

- [ ] **Step 4: Run and explain the result**

Expected: all three tests pass. If not, repair only the exposed component-key or `getDom` integration. The key selects the component record; recursive `getDom` finds the host descendant that `insertBefore` moves.

- [ ] **Step 5: Commit**

```bash
git add tests/stage-3/runtime.test.js src/stage-3/runtime.js
git commit -m "test(stage-3): verify keyed component state identity"
```

---

### Task 8: Reset Replaced State and Detach Removed Instances

**Files:**
- Modify: `tests/stage-3/runtime.test.js`
- Modify: `src/stage-3/runtime.js`

**Interfaces:**
- Consumes: persistent component records and keyed replacement.
- Produces: `detachRecord(record)`; fresh state for changed identity; rejected updates from removed instances.

- [ ] **Step 1: Write the failing replacement test**

```js
test("a changed key creates fresh state and detaches the old instance", () => {
  const fixture = createFixture();
  const root = createRoot(fixture);
  const instances = [];

  class Counter extends MiniReact.Component {
    constructor(props) {
      super(props);
      instances.push(this);
      this.state = { count: 0 };
    }
    render() {
      return createElement(
        "button",
        { onClick: () => this.setState({ count: 1 }) },
        this.state.count,
      );
    }
  }

  try {
    root.render(createElement(Counter, { key: "first" }));
    fixture.querySelector("button").click();
    const oldInstance = instances[0];
    root.render(createElement(Counter, { key: "second" }));

    assertEqual(instances.length, 2);
    assertEqual(fixture.querySelector("button").textContent, "0");
    assertThrows(
      () => oldInstance.setState({ count: 2 }),
      Error,
      "Cannot update an unmounted component",
    );
  } finally {
    root.unmount();
    fixture.remove();
  }
});
```

- [ ] **Step 2: Run RED**

Expected: fresh state is visible, but the removed instance still has an active updater.

- [ ] **Step 3: Add recursive teardown**

```js
function detachRecord(record) {
  if (record.kind === "component") {
    record.instance.__status = "unmounted";
    record.instance.__enqueueStateUpdate = null;
    detachRecord(record.child);
    return;
  }
  if (record.kind === "host") {
    for (const child of record.children) {
      detachRecord(child);
    }
  }
}
```

Call `detachRecord(oldRecord)` on replacement and deletion. In `root.unmount()`, detach every root child before clearing the container and record array.

- [ ] **Step 4: Add the root-unmount test**

```js
test("root unmount detaches retained component instances", () => {
  const fixture = createFixture();
  const root = createRoot(fixture);
  let instance;

  class Counter extends MiniReact.Component {
    constructor(props) {
      super(props);
      instance = this;
    }
    render() {
      return createElement("button", null, "Counter");
    }
  }

  try {
    root.render(createElement(Counter));
    root.unmount();
    assertThrows(
      () => instance.setState({ count: 1 }),
      Error,
      "Cannot update an unmounted component",
    );
  } finally {
    fixture.remove();
  }
});
```

- [ ] **Step 5: Verify that changing component type also resets identity**

```js
test("a changed component type creates a fresh instance", () => {
  const fixture = createFixture();
  const root = createRoot(fixture);
  let firstInstance;
  let secondInstance;

  class FirstCounter extends MiniReact.Component {
    constructor(props) {
      super(props);
      firstInstance = this;
      this.state = { label: "first" };
    }
    render() {
      return createElement("button", null, this.state.label);
    }
  }

  class SecondCounter extends MiniReact.Component {
    constructor(props) {
      super(props);
      secondInstance = this;
      this.state = { label: "second" };
    }
    render() {
      return createElement("button", null, this.state.label);
    }
  }

  try {
    root.render(createElement(FirstCounter, { key: "counter" }));
    root.render(createElement(SecondCounter, { key: "counter" }));

    assertEqual(firstInstance === secondInstance, false);
    assertEqual(fixture.querySelector("button").textContent, "second");
    assertThrows(
      () => firstInstance.setState({ label: "stale" }),
      Error,
      "Cannot update an unmounted component",
    );
  } finally {
    root.unmount();
    fixture.remove();
  }
});
```

- [ ] **Step 6: Run GREEN and commit**

```bash
git add src/stage-3/runtime.js tests/stage-3/runtime.test.js
git commit -m "feat(stage-3): detach replaced component instances"
```

---

### Task 9: Enforce the Stage 3A Component Contract

**Files:**
- Modify: `tests/stage-3/runtime.test.js`
- Modify: `src/stage-3/runtime.js`

**Interfaces:**
- Consumes: `Component`, the state queue, and the single-output resolver.
- Produces: focused errors for invalid initial state, invalid update input or result, invalid output shape, and render-phase updates.

- [ ] **Step 1: Test invalid initial state**

```js
test("rejects non-object initial component state", () => {
  const fixture = createFixture();
  const root = createRoot(fixture);

  class InvalidState extends MiniReact.Component {
    constructor(props) {
      super(props);
      this.state = [];
    }
    render() {
      return createElement("p", null, "Invalid");
    }
  }

  try {
    assertThrows(
      () => root.render(createElement(InvalidState)),
      TypeError,
      "Component state must be an object",
    );
  } finally {
    root.unmount();
    fixture.remove();
  }
});
```

- [ ] **Step 2: Test invalid update input**

```js
test("rejects a non-object, non-function setState argument", () => {
  const fixture = createFixture();
  const root = createRoot(fixture);
  let instance;

  class Counter extends MiniReact.Component {
    constructor(props) {
      super(props);
      instance = this;
    }
    render() {
      return createElement("button", null, "Counter");
    }
  }

  try {
    root.render(createElement(Counter));
    assertThrows(
      () => instance.setState(null),
      TypeError,
      "setState requires an object or updater function",
    );
  } finally {
    root.unmount();
    fixture.remove();
  }
});
```

- [ ] **Step 3: Test the temporary single-root restriction**

```js
test("rejects empty or multiple class-component roots", () => {
  const fixture = createFixture();
  const root = createRoot(fixture);

  class Empty extends MiniReact.Component {
    render() {
      return null;
    }
  }

  class Multiple extends MiniReact.Component {
    render() {
      return [createElement("span"), createElement("span")];
    }
  }

  try {
    assertThrows(
      () => root.render(createElement(Empty)),
      TypeError,
      "A class component must return exactly one non-empty root",
    );
    assertThrows(
      () => root.render(createElement(Multiple)),
      TypeError,
      "A class component must return exactly one non-empty root",
    );
  } finally {
    root.unmount();
    fixture.remove();
  }
});
```

- [ ] **Step 4: Test a render-phase update**

```js
test("rejects setState during render", () => {
  const fixture = createFixture();
  const root = createRoot(fixture);

  class InvalidRender extends MiniReact.Component {
    render() {
      this.setState({ count: 1 });
      return createElement("p", null, "Invalid");
    }
  }

  try {
    assertThrows(
      () => root.render(createElement(InvalidRender)),
      Error,
      "Cannot update state while rendering",
    );
  } finally {
    root.unmount();
    fixture.remove();
  }
});
```

- [ ] **Step 5: Test construction-time updates and callback arguments**

```js
test("rejects setState during component construction", () => {
  const fixture = createFixture();
  const root = createRoot(fixture);

  class InvalidConstruction extends MiniReact.Component {
    constructor(props) {
      super(props);
      this.setState({ count: 1 });
    }
    render() {
      return createElement("p", null, "Invalid");
    }
  }

  try {
    assertThrows(
      () => root.render(createElement(InvalidConstruction)),
      Error,
      "Cannot update state during component construction",
    );
  } finally {
    root.unmount();
    fixture.remove();
  }
});

test("rejects the unsupported setState callback argument", () => {
  const fixture = createFixture();
  const root = createRoot(fixture);
  let instance;

  class Counter extends MiniReact.Component {
    constructor(props) {
      super(props);
      instance = this;
    }
    render() {
      return createElement("p", null, "Counter");
    }
  }

  try {
    root.render(createElement(Counter));
    assertThrows(
      () => instance.setState({}, () => {}),
      TypeError,
      "setState callbacks are not supported",
    );
  } finally {
    root.unmount();
    fixture.remove();
  }
});
```

- [ ] **Step 6: Run RED and complete the guards**

Expected: any missing guard fails with the exact contract message. Keep `__status` as `"constructing"`, `"rendering"`, `"mounted"`, or `"unmounted"`. Wrap each `instance.render()` call so the instance returns to `"mounted"` in a `finally` block unless it was detached.

The render wrapper must have this shape on mount and update:

```js
instance.__status = "rendering";
try {
  childDescription = resolveSingleComponentOutput(instance.render());
} finally {
  if (instance.__status !== "unmounted") {
    instance.__status = "mounted";
  }
}
```

Change the method signature to `setState(update, callback)` and reject a defined
callback before enqueueing:

```js
if (callback !== undefined) {
  throw new TypeError("setState callbacks are not supported");
}
```

- [ ] **Step 7: Run GREEN and commit**

Expected: every Stage 3 runtime test passes, with no uncaught console errors.

```bash
git add src/stage-3/runtime.js tests/stage-3/runtime.test.js
git commit -m "test(stage-3): enforce component state boundaries"
```

---

### Task 10: Move Task Application State onto `TaskApp`

**Files:**
- Modify: `src/stage-3/app.js`
- Test: `tests/stage-3/task-app.test.js`

**Interfaces:**
- Consumes: `Component`, synchronous functional `setState`, and the existing stateless `TaskRow`.
- Produces: a persistent `TaskApp` instance owning tasks, filter, next ID, and validation error; unchanged `mountTaskApp(container) -> { unmount() }`.

- [ ] **Step 1: Confirm the copied closure-state app**

Open `http://localhost:4250/tests/stage-3/task-app.test.html`.

Expected: `8/8`, but `mountTaskApp` still owns four mutable closure variables. State works, yet it cannot be attached automatically to reusable component identity.

- [ ] **Step 2: Import `Component` and make mounting declarative**

```js
import { Component, createElement, createRoot } from "./runtime.js";

export function mountTaskApp(container) {
  if (!(container instanceof HTMLElement)) {
    throw new TypeError("mountTaskApp requires an HTMLElement container");
  }

  const root = createRoot(container);
  root.render(createElement(TaskApp));
  return {
    unmount() {
      root.unmount();
    },
  };
}
```

- [ ] **Step 3: Replace the `TaskApp` function with a persistent class**

Use this state and update behavior:

```js
class TaskApp extends Component {
  constructor(props) {
    super(props);
    this.state = {
      tasks: [],
      activeFilter: "all",
      nextTaskId: 1,
      errorMessage: "",
    };
  }

  selectFilter = (filter) => {
    const isValid = FILTER_OPTIONS.some((option) => option.value === filter);
    if (!isValid) {
      throw new Error(`Unknown filter: ${filter}`);
    }
    this.setState({ activeFilter: filter });
  };

  toggleTask = (taskId, completed) => {
    this.setState((state) => ({
      tasks: state.tasks.map((task) =>
        task.id === taskId ? { ...task, completed } : task,
      ),
    }));
  };

  handleSubmit = (event) => {
    event.preventDefault();
    const input = event.currentTarget.querySelector("[data-task-input]");
    const title = input.value.trim();

    if (!title) {
      this.setState({ errorMessage: "Enter a task." });
      return;
    }

    input.value = "";
    this.setState((state) => ({
      tasks: [
        ...state.tasks,
        {
          id: state.nextTaskId,
          title,
          completed: false,
        },
      ],
      nextTaskId: state.nextTaskId + 1,
      errorMessage: "",
    }));
  };

  render() {
    const { tasks, activeFilter, errorMessage } = this.state;
    const { handleSubmit, toggleTask, selectFilter } = this;
```

Move the existing `TaskApp` element-description construction directly below those two declarations. It already reads exactly the six local names declared above. Keep its final return, then close the method and class:

```js
    return createElement("div", null, form, error, filters, summary, list);
  }
}
```

Keep `TaskRow` as the existing stateless function. Completion remains parent state because it also determines the parent summary and filters.

- [ ] **Step 4: Run the task-app suite**

Expected: `8/8`. Verify submission, validation, completion, filtering, uncontrolled input identity, independent roots, and unmount behavior.

- [ ] **Step 5: Verify the visible app**

Open `http://localhost:4250/stage-3.html`. Add two tasks, toggle one, switch all filters, submit a blank title, and confirm the summary and error remain synchronized.

- [ ] **Step 6: Commit**

```bash
git add src/stage-3/app.js
git commit -m "feat(stage-3): move task state onto component instance"
```

---

### Task 11: Record the Mechanism and Pass the Checkpoint

**Files:**
- Create: `notes/stage-3-component-state.md`

**Interfaces:**
- Consumes: completed Stage 3A behavior and the React checkout pinned at `52912a1453`.
- Produces: a standalone explanation, source map, complete regression evidence, and a reviewed Stage 3A checkpoint.

- [ ] **Step 1: Create the note structure**

```markdown
# Stage 3 Component Identity and State

## The Problem

A function component call can calculate a description, but its local variables
belong only to that call. Calling the function again creates new local variables.
Application closure state survives, but the runtime cannot automatically create,
retain, move, or reset one independent state owner per component identity.

## Description, Record, and Instance

An element description is disposable input describing what should render. A
component record is the runtime's retained identity, selected by type, key, and
sibling position. Its class instance exposes props, state, and setState to
component code. Its child record retains the host, text, or nested component
output that reconciliation compares on the next render.

## State Update Flow

An event calls setState with an object or updater function. The component record
queues that update and requests work from its owning root. This stage immediately
reruns the root, reduces queued updates into the instance state, calls render,
reconciles the previous child with the next description, and mutates the DOM.
setState describes a state transition; it does not directly edit a DOM node.

## Identity Rules

The same component type and key at the matched sibling identity reuse one record
and instance, so their state survives. A different type or key creates a new
instance with initial state. Moving a keyed component repositions the host node
reached through its child while keeping both the instance and child records.

## Why This Is Still Not Fiber

The retained component record gives state a persistent owner, but reconciliation
progress still exists on JavaScript's recursive call stack. Comparison and DOM
mutation still happen in one pass. There is no current/work-in-progress
alternate, work graph, priority, effect flag, interruption, or commit traversal.

## Differences from Production React

This stage flushes each external state request synchronously, while production
React may batch requests. A class component must return one non-empty root here,
while modern React accepts broader node output. This stage also omits lifecycle
callbacks, Hooks, refs, effects, context, scheduling, and error recovery.

## React Source Map

ReactBaseClasses.js defines the public Component and setState request boundary.
ReactFiberClassComponent.js constructs class instances and prepares their props,
state, and rendered children. ReactFiberClassUpdateQueue.js stores and processes
state updates. The workshop combines only the synchronous subset needed here; it
does not reproduce Fiber behavior.

## Learner Explanation
```

After the source check, replace the general source-map sentences with exact
observations from commit `52912a1453`. Add only the learner answers actually
reviewed in Step 3 under the final heading.

- [ ] **Step 2: Inspect only the pinned source boundaries**

Run these as separate commands from `/Users/admin/Desktop/open-sources/react`:

```bash
git cat-file -t 52912a1453
git show 52912a1453:packages/react/src/ReactBaseClasses.js | rg -n "Component|setState|enqueueSetState"
git show 52912a1453:packages/react-reconciler/src/ReactFiberClassComponent.js | rg -n "constructClassInstance|mountClassInstance|updateClassInstance|finishClassComponent"
git show 52912a1453:packages/react-reconciler/src/ReactFiberClassUpdateQueue.js | rg -n "initializeUpdateQueue|enqueueUpdate|processUpdateQueue|getStateFromUpdate"
```

Expected: `commit`, then matching source locations. Explain unfamiliar production responsibilities before adding their names to the note.

- [ ] **Step 3: Pass the explanation gate one question at a time**

1. Why can a local variable inside a function component not retain state across calls?
2. What differs among an element description, component record, component instance, and DOM node?
3. Why does `setState` submit update data instead of changing DOM directly?
4. Why does a functional updater receive pending state and current props?
5. Why does the same type/key preserve state while a changed type/key resets it?
6. Why can a keyed component move while keeping instance state and host DOM identity?
7. Why is this recursive retained-record tree still not Fiber?
8. Which Stage 3A behaviors intentionally differ from production React?

Record only answers the learner has actually explained and understands.

- [ ] **Step 4: Run the full regression checkpoint**

Open and record the visible passing summary from:

```text
http://localhost:4250/tests/stage-0/task-app.test.html
http://localhost:4250/tests/stage-1/runtime.test.html
http://localhost:4250/tests/stage-1/task-app.test.html
http://localhost:4250/tests/stage-2/runtime.test.html
http://localhost:4250/tests/stage-2/task-app.test.html
http://localhost:4250/tests/stage-3/runtime.test.html
http://localhost:4250/tests/stage-3/task-app.test.html
```

Then run:

```bash
npm run inspect:stage1-jsx
git diff --check
git status --short
```

Expected: every browser page is green, JSX inspection exits `0`, `git diff --check` prints nothing, and status contains only intentional Stage 3 changes plus the pre-existing untracked `.codeflow/` paths.

- [ ] **Step 5: Commit the completed note**

```bash
git add notes/stage-3-component-state.md
git commit -m "docs(stage-3): record component state findings"
```

- [ ] **Step 6: Stop for final learner review**

Do not merge, tag, push, or begin Stage 3B until the learner reviews Stage 3A behavior, source mapping, and explanations.
