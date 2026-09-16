# Stage 3B Class Lifecycles Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add React-like class mount, update, and unmount lifecycle moments to the synchronous Stage 3 runtime, with JSX-authored browser tests and no Fiber or general commit phase.

**Architecture:** Keep reconciliation and DOM mutation in the existing synchronous recursive pass. Collect `componentDidMount` and `componentDidUpdate` calls in a root-owned post-mutation queue, flush that queue child before parent, and defer lifecycle-triggered state work until the flush ends. Invoke `componentWillUnmount` parent before child immediately before removal and updater detachment.

**Tech Stack:** Browser ES modules, JavaScript classes, DOM APIs, esbuild JSX transform, the repository's browser test harness, Python static server on port `4250`.

**Spec:** `docs/superpowers/specs/2026-09-16-stage-3b-class-lifecycles-design.md`

## Global Constraints

- Work on the in-place branch `codex/stage-3b-lifecycles`; do not create a worktree.
- Preserve Stages 0, 1, 2, and 3A and keep their browser pages runnable.
- Keep the TaskApp UI, selectors, and behavior unchanged.
- Add only `componentDidMount`, `componentDidUpdate`, and `componentWillUnmount`.
- Do not add deprecated lifecycles, Strict Mode double invocation, `shouldComponentUpdate`, snapshots, refs, context, Hooks, effects, error boundaries, Fiber, scheduling, priorities, lanes, or a general commit phase.
- Keep normal external `setState()` work synchronous. Only state requests made during a lifecycle flush wait for one follow-up render.
- Author new lifecycle tests in JSX, compile them with the existing esbuild dependency, and never commit the generated browser module.
- Reuse the existing server on port `4250`. Before starting one, check whether that port already has a listener; never leave multiple workshop servers running.
- Work learner-first: explain the observable failure, add one bounded red test, let the learner write the runtime change, review it, then advance.
- Preserve the pre-existing untracked `.codeflow/` and `src/stage-2/.codeflow/` directories.

---

## Plan Outline

1. Add the JSX build and browser test entry point.
2. Make mount callbacks run after connected DOM in child-before-parent order.
3. Add update callbacks with previous props/state and post-mutation timing.
4. Defer lifecycle `setState()` calls until the callback flush finishes.
5. Add parent-before-child cleanup before every removal path.
6. Verify lifecycle errors do not trap root work guards.
7. Complete the React source map, explanation gate, and full regression check.

---

## File Structure

### Files created

- `tests/stage-3/lifecycle.test.jsx` — readable JSX source for the Stage 3B lifecycle contracts.
- `tests/stage-3/lifecycle.test.html` — browser page that reports the generated lifecycle test results.
- `notes/stage-3-lifecycles.md` — learner-owned explanation and React source map recorded only after the behavior is implemented.

### Files modified

- `src/stage-3/runtime.js` — root lifecycle queue, lifecycle scheduling, previous-value capture, and unmount cleanup.
- `package.json` — `build:stage3-lifecycle-tests` command.
- `.gitignore` — exact generated lifecycle test module path.

### Generated but never committed

- `tests/stage-3/lifecycle.test.generated.js` — bundled browser module with inline source map.

---

### Task 1: Establish JSX-authored lifecycle test entry point

**Files:**
- Create: `tests/stage-3/lifecycle.test.jsx`
- Create: `tests/stage-3/lifecycle.test.html`
- Modify: `package.json`
- Modify: `.gitignore`

**Interfaces:**
- Consumes: `createElement`, `Component`, and `createRoot` from `src/stage-3/runtime.js`; `test`, `assert`, `assertEqual`, `assertThrows`, and `run` from `tests/browser/harness.js`.
- Produces: `npm run build:stage3-lifecycle-tests` and the browser page `/tests/stage-3/lifecycle.test.html` used by every later task.

- [ ] **Step 1: Add the generated artifact to `.gitignore`**

Append exactly:

```gitignore
tests/stage-3/lifecycle.test.generated.js
```

- [ ] **Step 2: Add the esbuild command to `package.json`**

Keep the existing script and add:

```json
{
  "scripts": {
    "inspect:stage1-jsx": "esbuild examples/stage-1/jsx-example.jsx --jsx=transform --jsx-factory=createElement --format=esm --log-level=warning",
    "build:stage3-lifecycle-tests": "esbuild tests/stage-3/lifecycle.test.jsx --bundle --format=esm --jsx=transform --jsx-factory=createElement --sourcemap=inline --outfile=tests/stage-3/lifecycle.test.generated.js"
  }
}
```

- [ ] **Step 3: Create the JSX test source**

Create `tests/stage-3/lifecycle.test.jsx`:

```jsx
import {
  assert,
  assertEqual,
  assertThrows,
  run,
  test,
} from "../browser/harness.js";
import {
  Component,
  createElement,
  createRoot,
} from "../../src/stage-3/runtime.js";

function createFixture() {
  const fixture = document.createElement("div");
  document.body.append(fixture);
  return fixture;
}

test("JSX creates descriptions for the Mini React runtime", () => {
  const fixture = createFixture();
  const root = createRoot(fixture);

  try {
    root.render(<p data-stage="3b">Lifecycle ready</p>);

    assertEqual(fixture.querySelector("p").textContent, "Lifecycle ready");
    assertEqual(fixture.querySelector("p").dataset.stage, "3b");
  } finally {
    root.unmount();
    fixture.remove();
  }
});

await run();
```

- [ ] **Step 4: Create the browser runner**

Create `tests/stage-3/lifecycle.test.html`:

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Stage 3 lifecycle tests</title>
  </head>
  <body>
    <h1>Stage 3 lifecycle tests</h1>
    <p data-test-summary>Tests have not run.</p>
    <ol data-test-results></ol>
    <script type="module" src="./lifecycle.test.generated.js"></script>
  </body>
</html>
```

- [ ] **Step 5: Build and verify the JSX smoke test**

Run:

```bash
npm run build:stage3-lifecycle-tests
git check-ignore tests/stage-3/lifecycle.test.generated.js
```

Open:

```text
http://localhost:4250/tests/stage-3/lifecycle.test.html
```

Expected:

```text
1/1 tests passed
```

Inspect the generated file only long enough to confirm that the JSX became calls to the imported Mini React `createElement`. Do not stage the generated file.

- [ ] **Step 6: Commit the JSX test entry point**

```bash
git add .gitignore package.json tests/stage-3/lifecycle.test.jsx tests/stage-3/lifecycle.test.html
git commit -m "test(stage-3): add JSX lifecycle test entry point"
```

---

### Task 2: Run mount lifecycles after connected DOM

**Files:**
- Modify: `tests/stage-3/lifecycle.test.jsx`
- Modify: `src/stage-3/runtime.js:60-120`
- Modify: `src/stage-3/runtime.js:424-473`

**Interfaces:**
- Consumes: `rootContext` passed through `mountRecords(description, rootContext)`.
- Produces: `rootContext.enqueueLifecycle(callback)` and post-render lifecycle flushing; later update work uses the same queue.

- [ ] **Step 1: Append failing mount-order tests before `await run()`**

```jsx
test("mount lifecycles see connected DOM and run child before parent", () => {
  const fixture = createFixture();
  const root = createRoot(fixture);
  const calls = [];

  class Child extends Component {
    componentDidMount() {
      calls.push(`child:${fixture.contains(fixture.querySelector("[data-child]"))}`);
    }

    render() {
      return <span data-child="">Child</span>;
    }
  }

  class Parent extends Component {
    componentDidMount() {
      calls.push(`parent:${fixture.contains(fixture.querySelector("[data-parent]"))}`);
    }

    render() {
      return (
        <section data-parent="">
          <Child />
        </section>
      );
    }
  }

  try {
    root.render(<Parent />);
    assertEqual(calls.join(","), "child:true,parent:true");
  } finally {
    root.unmount();
    fixture.remove();
  }
});

test("keyed movement does not mount a retained component again", () => {
  const fixture = createFixture();
  const root = createRoot(fixture);
  let mounts = 0;

  class Row extends Component {
    componentDidMount() {
      mounts += 1;
    }

    render() {
      return <li data-id={this.props.id}>{this.props.id}</li>;
    }
  }

  try {
    root.render(
      <ul>
        <Row key="a" id="a" />
        <Row key="b" id="b" />
      </ul>,
    );
    const rowA = fixture.querySelector('[data-id="a"]');

    root.render(
      <ul>
        <Row key="b" id="b" />
        <Row key="a" id="a" />
      </ul>,
    );

    assertEqual(mounts, 2);
    assertEqual(fixture.querySelectorAll("li")[1], rowA);
  } finally {
    root.unmount();
    fixture.remove();
  }
});
```

- [ ] **Step 2: Rebuild and verify the mount tests fail**

Run:

```bash
npm run build:stage3-lifecycle-tests
```

Refresh the lifecycle page.

Expected: `1/3 tests passed`; both new tests fail because `componentDidMount()` is never called.

- [ ] **Step 3: Add the root lifecycle queue**

Inside `createRoot`, add lifecycle storage and expose one queue operation through `rootContext`:

```js
let lifecycleCallbacks = [];

const rootContext = {
  get isRendering() {
    return isRendering;
  },

  enqueueLifecycle(callback) {
    lifecycleCallbacks.push(callback);
  },

  requestRender() {
    performRender();
  },
};

function flushLifecycleCallbacks() {
  const callbacks = lifecycleCallbacks;
  lifecycleCallbacks = [];

  for (const callback of callbacks) {
    callback();
  }
}
```

Flush only after a successful DOM pass. Clear partially collected callbacks if reconciliation throws:

```js
function performRender() {
  if (isRendering) {
    throw new Error("Cannot update state while rendering");
  }

  let completed = false;
  isRendering = true;
  try {
    const nextDescriptions = expandDescriptions(currentElement);
    childRecords = reconcileChildren(
      container,
      childRecords,
      nextDescriptions,
      rootContext,
    );
    completed = true;
  } finally {
    isRendering = false;
    if (!completed) lifecycleCallbacks = [];
  }

  flushLifecycleCallbacks();
}
```

- [ ] **Step 4: Register mount callbacks child before parent**

In the class-component branch of `mountRecords`, enqueue after its child record has mounted:

```js
const [child] = mountRecords(childDescription, rootContext);
record.child = child;

if (typeof instance.componentDidMount === "function") {
  rootContext.enqueueLifecycle(() => {
    instance.componentDidMount();
  });
}

return [record];
```

Recursive child mounting reaches this code before the parent, so the queue order is child then parent. The root flushes only after `reconcileChildren` has inserted the returned host DOM.

- [ ] **Step 5: Rebuild and verify mount behavior**

Run:

```bash
npm run build:stage3-lifecycle-tests
```

Expected lifecycle page summary:

```text
3/3 tests passed
```

Also refresh `tests/stage-3/runtime.test.html`; expected `42/42 tests passed`.

- [ ] **Step 6: Commit mount lifecycle behavior**

```bash
git add src/stage-3/runtime.js tests/stage-3/lifecycle.test.jsx
git commit -m "feat(stage-3): run mount lifecycles after DOM work"
```

---

### Task 3: Supply previous values to update lifecycles

**Files:**
- Modify: `tests/stage-3/lifecycle.test.jsx`
- Modify: `src/stage-3/runtime.js:346-371`

**Interfaces:**
- Consumes: `rootContext.enqueueLifecycle(callback)` from Task 2.
- Produces: `componentDidUpdate(prevProps, prevState)` after child reconciliation, with current values already installed on the instance.

- [ ] **Step 1: Append failing update-value tests before `await run()`**

```jsx
test("update lifecycle receives previous values and sees updated DOM", () => {
  const fixture = createFixture();
  const root = createRoot(fixture);
  const observations = [];
  let probe;

  class Probe extends Component {
    constructor(props) {
      super(props);
      probe = this;
      this.state = { count: 0 };
    }

    componentDidUpdate(prevProps, prevState) {
      observations.push(
        [
          prevProps.label,
          prevState.count,
          this.props.label,
          this.state.count,
          fixture.textContent,
        ].join("|"),
      );
    }

    render() {
      return <p>{this.props.label}:{this.state.count}</p>;
    }
  }

  try {
    root.render(<Probe label="Before" />);
    probe.setState({ count: 1 });
    root.render(<Probe label="After" />);

    assertEqual(
      observations.join(","),
      "Before|0|Before|1|Before:1,Before|1|After|1|After:1",
    );
  } finally {
    root.unmount();
    fixture.remove();
  }
});

test("nested update lifecycles run child before parent", () => {
  const fixture = createFixture();
  const root = createRoot(fixture);
  const calls = [];

  class Child extends Component {
    componentDidUpdate() {
      calls.push(`child:${this.props.value}:${fixture.textContent}`);
    }

    render() {
      return <span>{this.props.value}</span>;
    }
  }

  class Parent extends Component {
    componentDidUpdate() {
      calls.push(`parent:${this.props.value}:${fixture.textContent}`);
    }

    render() {
      return (
        <section>
          <Child value={this.props.value} />
        </section>
      );
    }
  }

  try {
    root.render(<Parent value="one" />);
    root.render(<Parent value="two" />);

    assertEqual(calls.join(","), "child:two:two,parent:two:two");
  } finally {
    root.unmount();
    fixture.remove();
  }
});
```

- [ ] **Step 2: Rebuild and verify the update tests fail**

Run:

```bash
npm run build:stage3-lifecycle-tests
```

Expected: `3/5 tests passed`; both new tests fail because update lifecycles are not queued.

- [ ] **Step 3: Capture previous values before updating the instance**

At the start of the component branch in `reconcileRecord`:

```js
if (oldRecord.kind === "component") {
  const prevProps = oldRecord.instance.props;
  const prevState = oldRecord.instance.state;

  oldRecord.instance.props = description.props;
  processPendingState(oldRecord);
```

Keep these references unchanged while rendering and reconciling the next child.

- [ ] **Step 4: Queue the update lifecycle after child reconciliation**

After assigning the reconciled child and record props:

```js
oldRecord.child = reconcileRecord(
  parent,
  oldRecord.child,
  nextDescription,
  rootContext,
);

oldRecord.props = description.props;

if (typeof oldRecord.instance.componentDidUpdate === "function") {
  rootContext.enqueueLifecycle(() => {
    oldRecord.instance.componentDidUpdate(prevProps, prevState);
  });
}

return oldRecord;
```

The child component registers its callback during recursive reconciliation before the parent reaches this block.

- [ ] **Step 5: Rebuild and verify update behavior**

Run:

```bash
npm run build:stage3-lifecycle-tests
```

Expected lifecycle page summary:

```text
5/5 tests passed
```

Refresh the Stage 3 runtime page; expected `42/42 tests passed`.

- [ ] **Step 6: Commit update lifecycle behavior**

```bash
git add src/stage-3/runtime.js tests/stage-3/lifecycle.test.jsx
git commit -m "feat(stage-3): add update lifecycle snapshots"
```

---

### Task 4: Defer lifecycle state work until callback flushing ends

**Files:**
- Modify: `tests/stage-3/lifecycle.test.jsx`
- Modify: `src/stage-3/runtime.js:60-120`

**Interfaces:**
- Consumes: component update queues and lifecycle callbacks from Tasks 2 and 3.
- Produces: root work loop fields `renderRequested`, `isPerformingWork`, and `isFlushingLifecycles`; lifecycle `setState()` calls produce one follow-up root pass.

- [ ] **Step 1: Append the failing lifecycle-state test before `await run()`**

```jsx
test("lifecycle state requests wait for one follow-up render", () => {
  const fixture = createFixture();
  const root = createRoot(fixture);
  const calls = [];
  let childRenders = 0;
  let parentRenders = 0;

  class Child extends Component {
    constructor(props) {
      super(props);
      this.state = { ready: false };
    }

    componentDidMount() {
      calls.push("child mount start");
      this.setState({ ready: true });
      calls.push("child mount end");
    }

    componentDidUpdate() {
      calls.push("child update");
    }

    render() {
      childRenders += 1;
      return <span>{String(this.state.ready)}</span>;
    }
  }

  class Parent extends Component {
    constructor(props) {
      super(props);
      this.state = { ready: false };
    }

    componentDidMount() {
      calls.push("parent mount start");
      this.setState({ ready: true });
      calls.push("parent mount end");
    }

    componentDidUpdate() {
      calls.push("parent update");
    }

    render() {
      parentRenders += 1;
      return (
        <section data-parent-ready={this.state.ready}>
          <Child />
        </section>
      );
    }
  }

  try {
    root.render(<Parent />);

    assertEqual(
      calls.join(","),
      "child mount start,child mount end,parent mount start,parent mount end,child update,parent update",
    );
    assertEqual(childRenders, 2);
    assertEqual(parentRenders, 2);
    assertEqual(fixture.querySelector("section").dataset.parentReady, "true");
    assertEqual(fixture.querySelector("span").textContent, "true");
  } finally {
    root.unmount();
    fixture.remove();
  }
});
```

- [ ] **Step 2: Rebuild and verify callback work interleaves incorrectly**

Run:

```bash
npm run build:stage3-lifecycle-tests
```

Expected: `5/6 tests passed`. The new test fails because the first lifecycle `setState()` recursively starts reconciliation before the original lifecycle queue finishes.

- [ ] **Step 3: Replace direct render requests with a root work loop**

Inside `createRoot`, use these state fields:

```js
let isRendering = false;
let isFlushingLifecycles = false;
let isPerformingWork = false;
let renderRequested = false;
let lifecycleCallbacks = [];
```

Change `rootContext.requestRender` and keep lifecycle registration explicit:

```js
const rootContext = {
  get isRendering() {
    return isRendering;
  },

  enqueueLifecycle(callback) {
    lifecycleCallbacks.push(callback);
  },

  requestRender() {
    renderRequested = true;
    flushRootWork();
  },
};
```

Add guarded callback and work flushing:

```js
function flushLifecycleCallbacks() {
  const callbacks = lifecycleCallbacks;
  lifecycleCallbacks = [];
  isFlushingLifecycles = true;

  try {
    for (const callback of callbacks) {
      callback();
    }
  } finally {
    isFlushingLifecycles = false;
  }
}

function flushRootWork() {
  if (isPerformingWork) return;

  isPerformingWork = true;
  try {
    while (renderRequested) {
      renderRequested = false;
      performRender();
      flushLifecycleCallbacks();
    }
  } catch (error) {
    lifecycleCallbacks = [];
    throw error;
  } finally {
    isPerformingWork = false;
    isFlushingLifecycles = false;
  }
}
```

`isPerformingWork` is the re-entrancy guard. `isFlushingLifecycles` records the current phase and is always reset even when user code throws.

- [ ] **Step 4: Make public root rendering request work through the same path**

```js
function render(element) {
  if (isUnmount) {
    throw Error("Cannot render an unmounted root");
  }

  currentElement = element;
  rootContext.requestRender();
}
```

Keep `performRender()` responsible only for reconciliation and its `isRendering` guard. Do not flush callbacks from `performRender()` after this refactor.

- [ ] **Step 5: Rebuild and verify deferred lifecycle work**

Run:

```bash
npm run build:stage3-lifecycle-tests
```

Expected lifecycle page summary:

```text
6/6 tests passed
```

Refresh the Stage 3 runtime and TaskApp test pages; expect `42/42` and `8/8`.

- [ ] **Step 6: Commit lifecycle-triggered work handling**

```bash
git add src/stage-3/runtime.js tests/stage-3/lifecycle.test.jsx
git commit -m "feat(stage-3): defer lifecycle state work"
```

---

### Task 5: Run cleanup before removal

**Files:**
- Modify: `tests/stage-3/lifecycle.test.jsx`
- Modify: `src/stage-3/runtime.js:31-57`
- Modify: `src/stage-3/runtime.js:108-118`
- Modify: `src/stage-3/runtime.js:276-283`
- Modify: `src/stage-3/runtime.js:314-320`
- Modify: `src/stage-3/runtime.js:482-493`

**Interfaces:**
- Consumes: retained component records and their child records.
- Produces: `unmountRecord(record)` which performs parent-before-child cleanup and updater detachment before host removal.

- [ ] **Step 1: Append failing unmount tests before `await run()`**

```jsx
test("unmount runs parent before child while DOM is connected", () => {
  const fixture = createFixture();
  const root = createRoot(fixture);
  const calls = [];
  const blockedMessages = [];

  class Child extends Component {
    componentWillUnmount() {
      calls.push(`child:${fixture.contains(fixture.querySelector("[data-child]"))}`);
      blockedMessages.push(
        assertThrows(
          () => this.setState({ removed: true }),
          Error,
          "Cannot update an unmounted component",
        ).message,
      );
    }

    render() {
      return <span data-child="">Child</span>;
    }
  }

  class Parent extends Component {
    componentWillUnmount() {
      calls.push(`parent:${fixture.contains(fixture.querySelector("[data-parent]"))}`);
    }

    render() {
      return (
        <section data-parent="">
          <Child />
        </section>
      );
    }
  }

  root.render(<Parent />);
  root.unmount();

  assertEqual(calls.join(","), "parent:true,child:true");
  assertEqual(blockedMessages.length, 1);
  assertEqual(fixture.children.length, 0);
  fixture.remove();
});

test("deletion, replacement, and root unmount clean each identity once", () => {
  const fixture = createFixture();
  const root = createRoot(fixture);
  const cleanup = [];

  class Probe extends Component {
    componentWillUnmount() {
      cleanup.push(this.props.id);
    }

    render() {
      return <span data-id={this.props.id}>{this.props.id}</span>;
    }
  }

  try {
    root.render(
      <div>
        <Probe key="a" id="a" />
        <Probe key="b" id="b" />
      </div>,
    );

    root.render(
      <div>
        <Probe key="b" id="b" />
        <Probe key="c" id="c" />
      </div>,
    );
    assertEqual(cleanup.join(","), "a");

    root.render(<section>replacement</section>);
    assertEqual(cleanup.join(","), "a,b,c");
  } finally {
    root.unmount();
    fixture.remove();
  }

  assertEqual(cleanup.join(","), "a,b,c");
});
```

- [ ] **Step 2: Rebuild and verify the unmount tests fail**

Run:

```bash
npm run build:stage3-lifecycle-tests
```

Expected: `6/8 tests passed`; cleanup callbacks are not yet called.

- [ ] **Step 3: Reject state changes as soon as unmount begins**

Extend the `Component.setState` status switch:

```js
case "unmounting":
case "unmounted":
  throw new Error("Cannot update an unmounted component");
```

- [ ] **Step 4: Replace detachment with explicit unmount cleanup**

Replace `detachRecord` with:

```js
function unmountRecord(record) {
  if (record.kind === "component") {
    const instance = record.instance;
    instance.__status = "unmounting";

    try {
      if (typeof instance.componentWillUnmount === "function") {
        instance.componentWillUnmount();
      }
    } finally {
      unmountRecord(record.child);
      instance.__enqueueStateUpdate = null;
      instance.__status = "unmounted";
    }
    return;
  }

  if (record.kind === "host") {
    for (const child of record.children) {
      unmountRecord(child);
    }
  }
}
```

This invokes a component before its descendant record, matching the pinned React deletion ordering.

- [ ] **Step 5: Call cleanup before every DOM removal path**

For component/type replacement, move cleanup before `replaceChild`:

```js
if (!hasSameType(oldRecord, description)) {
  const [nextRecord] = mountRecords(description, rootContext);
  unmountRecord(oldRecord);
  parent.replaceChild(getDom(nextRecord), getDom(oldRecord));
  return nextRecord;
}
```

For unmatched child deletion:

```js
if (!usedRecords.has(oldRecord) && oldDom.parentNode === parent) {
  unmountRecord(oldRecord);
  oldDom.remove();
}
```

For root unmount:

```js
for (const record of childRecords) {
  unmountRecord(record);
}

isUnmount = true;
container.replaceChildren();
childRecords = [];
```

Replace every remaining call to `detachRecord` with `unmountRecord` and verify with:

```bash
rg -n "detachRecord" src/stage-3/runtime.js
```

Expected: no matches.

- [ ] **Step 6: Rebuild and verify unmount behavior**

Run:

```bash
npm run build:stage3-lifecycle-tests
```

Expected lifecycle page summary:

```text
8/8 tests passed
```

Refresh the Stage 3 runtime page; expected `42/42 tests passed`, including stale-instance checks.

- [ ] **Step 7: Commit unmount lifecycle behavior**

```bash
git add src/stage-3/runtime.js tests/stage-3/lifecycle.test.jsx
git commit -m "feat(stage-3): clean up components before removal"
```

---

### Task 6: Lock lifecycle error recovery guards

**Files:**
- Modify: `tests/stage-3/lifecycle.test.jsx`
- Review: `src/stage-3/runtime.js:60-140`

**Interfaces:**
- Consumes: `flushRootWork()` and `flushLifecycleCallbacks()` from Task 4.
- Produces: a regression contract that user lifecycle errors propagate while root work guards reset and stale queued callbacks do not leak into later work.

- [ ] **Step 1: Append the lifecycle-error regression before `await run()`**

```jsx
test("a lifecycle error propagates without trapping later root work", () => {
  const fixture = createFixture();
  const root = createRoot(fixture);
  let staleCallbackRuns = 0;

  class Broken extends Component {
    componentDidMount() {
      throw new Error("mount failed");
    }

    render() {
      return <span>Broken</span>;
    }
  }

  class StaleSibling extends Component {
    componentDidMount() {
      staleCallbackRuns += 1;
    }

    render() {
      return <span>Stale</span>;
    }
  }

  assertThrows(
    () =>
      root.render(
        <div>
          <Broken />
          <StaleSibling />
        </div>,
      ),
    Error,
    "mount failed",
  );

  root.render(<p>Recovered</p>);

  assertEqual(staleCallbackRuns, 0);
  assertEqual(fixture.textContent, "Recovered");
  root.unmount();
  fixture.remove();
});
```

- [ ] **Step 2: Rebuild and inspect the result**

Run:

```bash
npm run build:stage3-lifecycle-tests
```

Expected lifecycle page summary if Task 4 followed the specified snapshot-and-`finally` structure:

```text
9/9 tests passed
```

If the test fails, the only permitted runtime correction is to ensure:

```js
const callbacks = lifecycleCallbacks;
lifecycleCallbacks = [];
```

happens before invoking user callbacks, and both `isPerformingWork` and `isFlushingLifecycles` reset in `finally` blocks. Do not add error boundaries or swallow the thrown error.

- [ ] **Step 3: Run all Stage 3 pages**

Open and record:

```text
http://localhost:4250/tests/stage-3/runtime.test.html
http://localhost:4250/tests/stage-3/task-app.test.html
http://localhost:4250/tests/stage-3/lifecycle.test.html
```

Expected summaries:

```text
42/42 tests passed
8/8 tests passed
9/9 tests passed
```

- [ ] **Step 4: Commit the error-guard regression**

```bash
git add src/stage-3/runtime.js tests/stage-3/lifecycle.test.jsx
git commit -m "test(stage-3): guard lifecycle callback failures"
```

---

### Task 7: Record the lifecycle model and React source map

**Files:**
- Create: `notes/stage-3-lifecycles.md`
- Reference: `/Users/admin/Desktop/open-sources/react` at commit `52912a1453`

**Interfaces:**
- Consumes: the implemented Stage 3B behavior and pinned React source.
- Produces: the learner-reviewed lifecycle explanation required before Stage 4.

- [ ] **Step 1: Create the note structure without pre-filling learner answers**

```markdown
# Stage 3 Class Lifecycle Moments

## The Missing Problem After Component State

## Mount, Update, and Unmount Timing

## Lifecycle State Update Flow

## Why This Queue Is Not a Commit Phase

## Differences from Production React

## React Source Map

## My Explanation
```

- [ ] **Step 2: Inspect the pinned React mount/update source**

Run from `/Users/admin/Desktop/open-sources/react`:

```bash
git cat-file -t 52912a1453
git show 52912a1453:packages/react-reconciler/src/ReactFiberCommitEffects.js | nl -ba | sed -n '340,495p'
git show 52912a1453:packages/react-reconciler/src/ReactFiberCommitWork.js | nl -ba | sed -n '591,635p'
```

Expected observations:

- `commitClassLayoutLifecycles` chooses did-mount when there is no current Fiber and did-update when a current Fiber exists.
- Did-update receives previous memoized props and state.
- The class layout path traverses descendants before invoking the class lifecycle.

- [ ] **Step 3: Inspect the pinned React unmount source**

```bash
git show 52912a1453:packages/react-reconciler/src/ReactFiberCommitWork.js | nl -ba | sed -n '1700,1717p'
```

Expected: the class deletion path calls `componentWillUnmount()` before recursively traversing descendant deletions.

Explain each unfamiliar production responsibility against the Stage 3B runtime before recording it. Do not copy function names into the note without understanding their role.

- [ ] **Step 4: Pass the explanation gate one question at a time**

1. Why can `componentDidMount()` not run immediately when `mountRecords()` creates a component record?
2. Why do did-mount and did-update callbacks run child before parent, while will-unmount runs parent before child?
3. Why must update reconciliation capture previous props and state before changing the retained instance?
4. Why does lifecycle `setState()` request follow-up work instead of recursively interrupting the current callback flush?
5. Why does keyed movement preserve an instance without calling did-mount again?
6. Why is the Stage 3B lifecycle queue still not React's Fiber commit phase?

Record only explanations the learner has actually given and understood.

- [ ] **Step 5: Complete the note after the explanation gate**

Summarize the implemented behavior in the first six sections, add exact pinned-source observations under `React Source Map`, and place the reviewed learner answers under `My Explanation`.

- [ ] **Step 6: Run the complete regression checkpoint**

First build the generated lifecycle module:

```bash
npm run build:stage3-lifecycle-tests
```

Open and record the visible summaries from:

```text
http://localhost:4250/tests/stage-0/task-app.test.html
http://localhost:4250/tests/stage-1/runtime.test.html
http://localhost:4250/tests/stage-1/task-app.test.html
http://localhost:4250/tests/stage-2/runtime.test.html
http://localhost:4250/tests/stage-2/task-app.test.html
http://localhost:4250/tests/stage-3/runtime.test.html
http://localhost:4250/tests/stage-3/task-app.test.html
http://localhost:4250/tests/stage-3/lifecycle.test.html
```

Expected summaries:

```text
7/7
12/12
8/8
24/24
8/8
42/42
8/8
9/9
```

Then run:

```bash
npm run inspect:stage1-jsx
npm run build:stage3-lifecycle-tests
git check-ignore tests/stage-3/lifecycle.test.generated.js
git diff --check
git status --short
```

Expected:

- both npm commands exit `0`;
- `git check-ignore` prints `tests/stage-3/lifecycle.test.generated.js`;
- `git diff --check` prints nothing;
- status contains only intentional Stage 3B changes and the pre-existing `.codeflow/` paths;
- the generated test module does not appear as staged or untracked.

- [ ] **Step 7: Commit the completed lifecycle note**

```bash
git add notes/stage-3-lifecycles.md
git commit -m "docs(stage-3): record lifecycle findings"
```

- [ ] **Step 8: Stop for learner review**

Do not merge, tag, push, or begin Stage 4 until the learner reviews the Stage 3B behavior, source map, and explanations.
