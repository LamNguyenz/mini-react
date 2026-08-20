# Stage 1 Declarative Elements and Recursive Rendering Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a dependency-light declarative renderer and use it to reproduce the Stage 0 task application while deliberately replacing the complete DOM tree on every update.

**Architecture:** Stage 1 converts plain element descriptions into browser DOM nodes with a synchronous recursive renderer. The application owns closure state, creates a complete `TaskApp(state)` description after every event, and calls `root.render(element)`; the renderer replaces the prior root contents so the identity problem for Stage 2 remains visible.

**Tech Stack:** Plain JavaScript, browser ES modules, HTML, browser DOM APIs, the existing dependency-free browser assertion harness, and `esbuild` as a development-only JSX inspection tool.

**Spec:** `docs/superpowers/specs/2026-08-20-stage-1-declarative-elements-design.md`

## Global Constraints

- The learner writes `src/stage-1/runtime.js` and `src/stage-1/app.js` by hand; the guide adds or presents the smallest failing check and reviews learner-authored code.
- Preserve `src/stage-0/`, `tests/stage-0/`, `index.html`, and the Stage 0 behavior unchanged.
- Add Stage 1 beside Stage 0; do not move or clear Stage 0 files.
- Use the existing branch and workspace. Do not create a worktree. Do not use subagents without the learner's explicit permission.
- Runtime code uses plain JavaScript and browser ES modules.
- Stage 1 uses `createElement(type, props, ...children)` and `createRoot(container) -> { render(element), unmount() }`.
- State remains in an application closure. Hooks, class state, lifecycle APIs, reconciliation, Fiber, scheduling, lanes, refs, effects, portals, fragments, hydration, and server rendering are excluded.
- Every render creates a fresh DOM tree and uses root replacement. Do not retain or compare the old element tree.
- JSX is introduced only after handwritten element objects and `createElement` are understood. `esbuild` remains development-only.
- Production React source comparisons use `/Users/admin/Desktop/open-sources/react` at commit `52912a1453` and happen after the smaller mechanism exists.
- Serve browser modules over HTTP from the repository root with `python3 -m http.server 4173`. Reload pages after changes; if the browser retains a stale module graph, verify on a fresh local port.
- Keep the branch runnable and commit after every reviewed task.

## File Map

- `src/stage-1/runtime.js` — element creation, child normalization, recursive DOM rendering, supported prop/event application, function components, and root lifecycle.
- `src/stage-1/app.js` — declarative task components, closure state, event actions, and rerender requests.
- `stage-1.html` — visible Stage 1 entry point; reuses the unchanged Stage 0 stylesheet.
- `tests/stage-1/runtime.test.html` — browser report page for renderer mechanisms.
- `tests/stage-1/runtime.test.js` — black-box runtime behavior and deliberate identity contract.
- `tests/stage-1/task-app.test.html` — browser report page for Stage 1 task behavior.
- `tests/stage-1/task-app.test.js` — Stage 0 parity tests that re-query after full replacement.
- `examples/stage-1/jsx-example.jsx` — small JSX input inspected only after the element-object gate.
- `package.json` / `package-lock.json` — development-only `esbuild` command and locked dependency.
- `notes/stage-1-declarative-rendering.md` — observed problem, runtime map, identity evidence, history notes, and pinned React source comparison.

---

### Task 1: First Handwritten Element and Root Boundary

**Files:**
- Modify: `tests/browser/harness.js`
- Create: `tests/stage-1/runtime.test.html`
- Create: `tests/stage-1/runtime.test.js`
- Create: `src/stage-1/runtime.js`

**Interfaces:**
- Consumes: browser `HTMLElement`, `document.createElement`, `document.createTextNode`, and `container.replaceChildren`.
- Produces: `createRoot(container) -> { render(element), unmount() }`, initially sufficient for one handwritten string-type element with text children.

- [ ] **Step 1: Add a reusable throwing assertion to the shared harness**

Append this export to `tests/browser/harness.js` after `assertEqual`:

```js
export function assertThrows(callback, ErrorType, message) {
  let thrown;
  try {
    callback();
  } catch (error) {
    thrown = error;
  }

  assert(thrown instanceof ErrorType, `expected ${ErrorType.name}`);
  if (message !== undefined) assertEqual(thrown.message, message);
  return thrown;
}
```

- [ ] **Step 2: Create the runtime test page**

Create `tests/stage-1/runtime.test.html`:

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Stage 1 runtime tests</title>
  </head>
  <body>
    <h1>Stage 1 runtime tests</h1>
    <p data-test-summary>Tests have not run.</p>
    <ol data-test-results></ol>
    <script type="module" src="./runtime.test.js"></script>
  </body>
</html>
```

- [ ] **Step 3: Write the first runtime tests**

Create `tests/stage-1/runtime.test.js`:

```js
import {
  assertEqual,
  assertThrows,
  run,
  test,
} from "../browser/harness.js";
import { createRoot } from "../../src/stage-1/runtime.js";

function createFixture() {
  const fixture = document.createElement("div");
  document.body.append(fixture);
  return fixture;
}

test("renders one handwritten host element description", () => {
  const fixture = createFixture();
  const root = createRoot(fixture);
  try {
    root.render({
      type: "p",
      props: { children: ["Hello Stage 1"] },
    });

    assertEqual(fixture.children.length, 1);
    assertEqual(fixture.firstElementChild.tagName, "P");
    assertEqual(fixture.firstElementChild.textContent, "Hello Stage 1");
  } finally {
    root.unmount();
    fixture.remove();
  }
});

test("rejects a non-element root container", () => {
  assertThrows(
    () => createRoot(null),
    TypeError,
    "createRoot requires an HTMLElement container",
  );
});

run();
```

- [ ] **Step 4: Run RED and record the predicted failure**

Run `python3 -m http.server 4173` and open:

```text
http://localhost:4173/tests/stage-1/runtime.test.html
```

Expected before `runtime.js` exists: the browser reports a missing module and no test can pass. Ask the learner to predict which browser operations the smallest renderer must perform.

- [ ] **Step 5: Learner implements the smallest root and handwritten host renderer**

The learner writes only this behavior in `src/stage-1/runtime.js`:

```text
createRoot(container)
  validate HTMLElement or throw the exact TypeError
  render(element)
    create the DOM element named by element.type
    create text nodes for element.props.children strings
    append text children to the DOM element
    replace the root container contents with that DOM element
  unmount()
    empty the container
```

Do not add `createElement`, nested element recursion, function components, prop handling, lifecycle state, or old-tree storage yet.

- [ ] **Step 6: Run GREEN and commit**

Expected: `2/2 tests passed`, no console errors, and Stage 0 remains `7/7`.

```bash
git add tests/browser/harness.js tests/stage-1/runtime.test.html tests/stage-1/runtime.test.js src/stage-1/runtime.js
git commit -m "feat(stage-1): render a handwritten element"
```

---

### Task 2: Recursive Rendering and Child Normalization

**Files:**
- Modify: `tests/stage-1/runtime.test.js`
- Modify: `src/stage-1/runtime.js`

**Interfaces:**
- Consumes: `createRoot(container)` from Task 1 and handwritten `{ type, props: { children } }` descriptions.
- Produces: recursive rendering for nested host elements and normalized strings, numbers, arrays, and empty children.

- [ ] **Step 1: Append failing recursive and invalid-child tests**

```js
test("recursively renders nested and normalized children", () => {
  const fixture = createFixture();
  const root = createRoot(fixture);
  try {
    root.render({
      type: "section",
      props: {
        children: [
          { type: "h2", props: { children: ["Tasks"] } },
          ["Count: ", 2, null, undefined, false, true],
        ],
      },
    });

    assertEqual(fixture.querySelector("h2").textContent, "Tasks");
    assertEqual(fixture.querySelector("section").textContent, "TasksCount: 2");
  } finally {
    root.unmount();
    fixture.remove();
  }
});

test("rejects an unsupported child description", () => {
  const fixture = createFixture();
  const root = createRoot(fixture);
  try {
    assertThrows(
      () =>
        root.render({
          type: "div",
          props: { children: [{ unsupported: true }] },
        }),
      TypeError,
      "Unsupported child description",
    );
  } finally {
    root.unmount();
    fixture.remove();
  }
});
```

- [ ] **Step 2: Run RED**

Expected: the original two tests pass; nested element/array rendering fails, and the invalid object does not yet produce the required diagnostic.

- [ ] **Step 3: Learner generalizes the renderer recursively**

```text
renderDescription(description)
  null / undefined / boolean -> no DOM node
  string -> Text node
  number -> Text node containing String(number)
  array -> flatten recursively into a DocumentFragment
  valid element object -> create host element, recursively render children, append them
  any other object -> throw TypeError("Unsupported child description")
```

Keep the implementation synchronous and mutation-based. Do not introduce an old tree or a second phase.

- [ ] **Step 4: Run GREEN and commit**

Expected: `4/4 tests passed`.

```bash
git add tests/stage-1/runtime.test.js src/stage-1/runtime.js
git commit -m "feat(stage-1): render descriptions recursively"
```

---

### Task 3: `createElement` and Normalized Element Objects

**Files:**
- Modify: `tests/stage-1/runtime.test.js`
- Modify: `src/stage-1/runtime.js`

**Interfaces:**
- Consumes: recursive description rendering from Task 2.
- Produces: `createElement(type, props, ...children) -> { type, props }`, with flat normalized `props.children`.

- [ ] **Step 1: Extend the runtime import**

Change the runtime import to:

```js
import { createElement, createRoot } from "../../src/stage-1/runtime.js";
```

- [ ] **Step 2: Append failing element-factory tests**

```js
test("createElement returns a normalized description without creating DOM", () => {
  const child = createElement("span", null, "B");
  const element = createElement(
    "section",
    { id: "tasks" },
    "A",
    [1, null, false, child],
  );

  assertEqual(element.type, "section");
  assertEqual(element.props.id, "tasks");
  assertEqual(element.props.children.length, 3);
  assertEqual(element.props.children[0], "A");
  assertEqual(element.props.children[1], "1");
  assertEqual(element.props.children[2], child);
  assertEqual(document.querySelector("#tasks"), null);
});

test("createElement rejects an unsupported type", () => {
  assertThrows(
    () => createElement({}, null),
    TypeError,
    "createElement requires a string or function type",
  );
});
```

- [ ] **Step 3: Run RED**

Expected: import failure or `createElement is not a function`.

- [ ] **Step 4: Learner implements the factory**

```text
createElement(type, props, ...children)
  validate type is string or function
  copy props or use an empty object when props is null/undefined
  flatten child arrays
  discard null, undefined, and boolean children
  convert number children to strings
  preserve strings and valid element objects
  return { type, props: { ...copiedProps, children: normalizedChildren } }
```

The function returns data only. It must not call any DOM API.

- [ ] **Step 5: Run GREEN and commit**

Expected: `6/6 tests passed`.

```bash
git add tests/stage-1/runtime.test.js src/stage-1/runtime.js
git commit -m "feat(stage-1): create normalized element objects"
```

---

### Task 4: Supported DOM Props and Browser Events

**Files:**
- Modify: `tests/stage-1/runtime.test.js`
- Modify: `src/stage-1/runtime.js`

**Interfaces:**
- Consumes: string-type elements produced by `createElement`.
- Produces: supported properties, name mappings, data/ARIA attributes, and `onClick`/`onSubmit`/`onChange` listeners.

- [ ] **Step 1: Append the failing prop/event test**

```js
test("applies supported DOM props, attributes, and events", () => {
  const fixture = createFixture();
  const root = createRoot(fixture);
  let clicks = 0;
  let submits = 0;
  let changes = 0;

  try {
    root.render(
      createElement(
        "form",
        {
          className: "task-form",
          "data-task-form": "",
          onSubmit(event) {
            event.preventDefault();
            submits += 1;
          },
        },
        createElement("input", {
          id: "task-toggle",
          type: "checkbox",
          value: "yes",
          checked: true,
          hidden: false,
          "aria-label": "Task toggle",
          onChange() {
            changes += 1;
          },
        }),
        createElement(
          "label",
          { htmlFor: "task-toggle" },
          "Task",
        ),
        createElement(
          "button",
          {
            type: "submit",
            onClick() {
              clicks += 1;
            },
          },
          "Add task",
        ),
      ),
    );

    const form = fixture.querySelector("form");
    const input = fixture.querySelector("input");
    const button = fixture.querySelector("button");
    assertEqual(form.className, "task-form");
    assertEqual(form.hasAttribute("data-task-form"), true);
    assertEqual(input.id, "task-toggle");
    assertEqual(input.type, "checkbox");
    assertEqual(input.value, "yes");
    assertEqual(input.checked, true);
    assertEqual(input.hidden, false);
    assertEqual(input.getAttribute("aria-label"), "Task toggle");
    assertEqual(fixture.querySelector("label").htmlFor, "task-toggle");

    input.click();
    button.click();
    assertEqual(changes, 1);
    assertEqual(clicks, 1);
    assertEqual(submits, 1);
  } finally {
    root.unmount();
    fixture.remove();
  }
});

test("rejects an unsupported DOM prop", () => {
  const fixture = createFixture();
  const root = createRoot(fixture);
  try {
    assertThrows(
      () => root.render(createElement("div", { title: "unsupported" })),
      TypeError,
      "Unsupported prop: title",
    );
  } finally {
    root.unmount();
    fixture.remove();
  }
});
```

- [ ] **Step 2: Run RED**

Expected: attributes/properties/listeners are absent or the renderer tries to treat props as children only.

- [ ] **Step 3: Learner adds one focused prop application boundary**

```text
applyProp(domElement, name, value)
  children -> skip
  value / checked / hidden / type / id -> assign the DOM property
  className -> assign className
  htmlFor -> assign htmlFor
  data-* / aria-* -> setAttribute(name, String(value))
  onClick / onSubmit / onChange -> addEventListener(lowercase event name, value)
  anything else -> throw TypeError(`Unsupported prop: ${name}`)
```

Do not add generic property diffing, event delegation, styles, refs, or dangerously-set HTML.

- [ ] **Step 4: Run GREEN and commit**

Expected: `8/8 tests passed`.

```bash
git add tests/stage-1/runtime.test.js src/stage-1/runtime.js
git commit -m "feat(stage-1): apply host props and events"
```

---

### Task 5: Function Components, Props, and Children

**Files:**
- Modify: `tests/stage-1/runtime.test.js`
- Modify: `src/stage-1/runtime.js`

**Interfaces:**
- Consumes: `createElement` descriptions whose `type` may be a function.
- Produces: recursive component invocation `type(props) -> supported description`.

- [ ] **Step 1: Append the failing function-component test**

```js
test("invokes function components with props and normalized children", () => {
  const fixture = createFixture();
  const root = createRoot(fixture);

  function Greeting({ name, children }) {
    return createElement(
      "section",
      { "data-greeting": "" },
      createElement("h2", null, `Hello ${name}`),
      children,
    );
  }

  try {
    root.render(
      createElement(
        Greeting,
        { name: "Ada" },
        createElement("p", null, "Child content"),
      ),
    );

    assertEqual(fixture.querySelector("h2").textContent, "Hello Ada");
    assertEqual(fixture.querySelector("p").textContent, "Child content");
  } finally {
    root.unmount();
    fixture.remove();
  }
});
```

- [ ] **Step 2: Run RED**

Expected: the renderer cannot pass a function type to `document.createElement`.

- [ ] **Step 3: Learner adds the component branch**

```text
when element.type is a function
  call element.type(element.props)
  recursively render the returned description

when element.type is a string
  keep using the host-element branch
```

Do not add persistent component state or call components manually from application event handlers.

- [ ] **Step 4: Run GREEN and commit**

Expected: `9/9 tests passed`.

```bash
git add tests/stage-1/runtime.test.js src/stage-1/runtime.js
git commit -m "feat(stage-1): render function components"
```

---

### Task 6: Root Replacement, Isolation, and Unmount Lifecycle

**Files:**
- Modify: `tests/stage-1/runtime.test.js`
- Modify: `src/stage-1/runtime.js`

**Interfaces:**
- Consumes: complete recursive renderer from Tasks 1-5.
- Produces: intentional node replacement, isolated roots, idempotent unmount, and final render-after-unmount failure.

- [ ] **Step 1: Append the root behavior tests**

```js
test("a second render replaces the previous DOM identity", () => {
  const fixture = createFixture();
  const root = createRoot(fixture);
  try {
    root.render(createElement("input", { id: "draft", value: "first" }));
    const firstInput = fixture.querySelector("input");
    firstInput.focus();

    root.render(createElement("input", { id: "draft", value: "second" }));
    const secondInput = fixture.querySelector("input");

    assertEqual(firstInput === secondInput, false);
    assertEqual(firstInput.isConnected, false);
    assertEqual(secondInput.value, "second");
    assertEqual(document.activeElement === secondInput, false);
  } finally {
    root.unmount();
    fixture.remove();
  }
});

test("roots replace and unmount only their own containers", () => {
  const firstFixture = createFixture();
  const secondFixture = createFixture();
  const firstRoot = createRoot(firstFixture);
  const secondRoot = createRoot(secondFixture);
  try {
    firstRoot.render(createElement("p", null, "First"));
    secondRoot.render(createElement("p", null, "Second"));
    firstRoot.unmount();

    assertEqual(firstFixture.children.length, 0);
    assertEqual(secondFixture.textContent, "Second");
  } finally {
    firstRoot.unmount();
    secondRoot.unmount();
    firstFixture.remove();
    secondFixture.remove();
  }
});

test("rendering after unmount throws a focused error", () => {
  const fixture = createFixture();
  const root = createRoot(fixture);
  root.unmount();
  root.unmount();

  assertThrows(
    () => root.render(createElement("p", null, "Too late")),
    Error,
    "Cannot render an unmounted root",
  );
  fixture.remove();
});
```

- [ ] **Step 2: Run RED**

Expected: replacement may already pass, but render-after-unmount does not yet throw and root lifecycle is not explicit.

- [ ] **Step 3: Learner adds only root lifecycle state**

```text
createRoot closure owns isUnmounted = false
render
  if isUnmounted -> throw exact Error
  create a fresh DOM description and replace this container
unmount
  if already unmounted -> return
  mark unmounted
  empty this container
```

- [ ] **Step 4: Run GREEN and commit**

Expected: `12/12 tests passed` and no Stage 0 regression.

```bash
git add tests/stage-1/runtime.test.js src/stage-1/runtime.js
git commit -m "feat(stage-1): define root replacement lifecycle"
```

---

### Task 7: Declarative Task App Shell and Visible Stage 1 Page

**Files:**
- Create: `src/stage-1/app.js`
- Create: `tests/stage-1/task-app.test.html`
- Create: `tests/stage-1/task-app.test.js`
- Create: `stage-1.html`

**Interfaces:**
- Consumes: `createElement` and `createRoot` from `src/stage-1/runtime.js`.
- Produces: `mountTaskApp(container) -> { unmount() }`, Stage 1 function components, initial closure state, stable task selectors, and a visible page.

- [ ] **Step 1: Create the Stage 1 task test page**

Create `tests/stage-1/task-app.test.html` with the same harness structure as the runtime page and this module entry:

```html
<script type="module" src="./task-app.test.js"></script>
```

- [ ] **Step 2: Write the empty-shell test and fixture helper**

Create `tests/stage-1/task-app.test.js`:

```js
import {
  assert,
  assertEqual,
  assertThrows,
  run,
  test,
} from "../browser/harness.js";
import { mountTaskApp } from "../../src/stage-1/app.js";

function mountFixture() {
  const fixture = document.createElement("div");
  document.body.append(fixture);
  const app = mountTaskApp(fixture);
  return {
    fixture,
    cleanup() {
      app.unmount();
      fixture.remove();
    },
  };
}

function taskRows(fixture) {
  return [...fixture.querySelectorAll("[data-task-row]")];
}

test("mounts the declarative empty task interface", () => {
  const { fixture, cleanup } = mountFixture();
  try {
    assert(fixture.querySelector("[data-task-form]"), "task form is missing");
    assert(fixture.querySelector("[data-task-input]"), "task input is missing");
    assert(fixture.querySelector("[data-task-submit]"), "submit button is missing");
    assert(
      fixture.querySelector('button[data-task-submit][type="submit"]'),
      "submit control must be a button",
    );
    assert(fixture.querySelector("[data-task-error]"), "task error is missing");
    assert(fixture.querySelector("[data-task-filters]"), "task filters are missing");
    assert(fixture.querySelector("[data-task-list]"), "task list is missing");
    assertEqual(
      fixture.querySelector("[data-task-summary]").textContent,
      "0 of 0 completed",
    );
    assertEqual(taskRows(fixture).length, 0);
    assertEqual(fixture.querySelectorAll('[aria-pressed="true"]').length, 1);
  } finally {
    cleanup();
  }
});

test("rejects a non-element mount target", () => {
  assertThrows(
    () => mountTaskApp(null),
    TypeError,
    "mountTaskApp requires an HTMLElement container",
  );
});

run();
```

- [ ] **Step 3: Run RED**

Expected: missing `src/stage-1/app.js` module.

- [ ] **Step 4: Learner builds the shell from element descriptions**

Use function components and `createElement` calls. The application owns:

```text
tasks = []
activeFilter = "all"
nextTaskId = 1
errorMessage = ""
```

`mountTaskApp(container)` first validates the container and throws the exact tested `TypeError` before creating a root. It then creates one root, defines a private `renderApp()` that calls `root.render(TaskApp(...))`, performs the initial render, and returns an `unmount()` wrapper that calls `root.unmount()`.

The empty description must include the form, input, visible submit button, hidden error, three filter buttons, summary, and empty list with the established selectors. Do not implement task creation or filter actions yet.

- [ ] **Step 5: Create the visible page**

Create `stage-1.html`:

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Mini React — Stage 1</title>
    <link rel="stylesheet" href="./src/stage-0/styles.css" />
  </head>
  <body>
    <main id="app"></main>
    <script type="module">
      import { mountTaskApp } from "./src/stage-1/app.js";
      mountTaskApp(document.querySelector("#app"));
    </script>
  </body>
</html>
```

- [ ] **Step 6: Run GREEN and commit**

Expected: Stage 1 task tests `2/2`, runtime `12/12`, Stage 0 `7/7`, and both visible pages load without console errors.

```bash
git add src/stage-1/app.js tests/stage-1/task-app.test.html tests/stage-1/task-app.test.js stage-1.html
git commit -m "feat(stage-1): mount the declarative task shell"
```

---

### Task 8: Declarative Task Creation and Validation

**Files:**
- Modify: `tests/stage-1/task-app.test.js`
- Modify: `src/stage-1/app.js`

**Interfaces:**
- Consumes: `mountTaskApp`, closure state, `renderApp()`, and form event props from earlier tasks.
- Produces: valid task creation, blank validation, error clearing, input replacement, and summary derivation through complete rerendering.

- [ ] **Step 1: Insert a submit helper before the tests**

```js
function submitTitle(fixture, title) {
  const input = fixture.querySelector("[data-task-input]");
  input.value = title;
  fixture.querySelector("[data-task-form]").dispatchEvent(
    new SubmitEvent("submit", { bubbles: true, cancelable: true }),
  );
}
```

- [ ] **Step 2: Append the failing task-creation tests**

```js
test("submitting a title rerenders one active task", () => {
  const { fixture, cleanup } = mountFixture();
  try {
    submitTitle(fixture, "Describe the UI");
    const rows = taskRows(fixture);
    assertEqual(rows.length, 1);
    assertEqual(rows[0].dataset.taskId, "1");
    assertEqual(rows[0].querySelector("[data-task-title]").textContent, "Describe the UI");
    assertEqual(rows[0].dataset.completed, "false");
    assertEqual(rows[0].querySelector("[data-task-toggle]").checked, false);
    assertEqual(fixture.querySelector("[data-task-summary]").textContent, "0 of 1 completed");
    assertEqual(fixture.querySelector("[data-task-input]").value, "");
  } finally {
    cleanup();
  }
});

test("clicking the visible submit control adds a task", () => {
  const { fixture, cleanup } = mountFixture();
  try {
    fixture.querySelector("[data-task-input]").value = "Use declarative controls";
    fixture.querySelector('button[type="submit"]').click();
    assertEqual(taskRows(fixture).length, 1);
  } finally {
    cleanup();
  }
});

test("blank input rerenders a visible validation error without a task", () => {
  const { fixture, cleanup } = mountFixture();
  try {
    submitTitle(fixture, "   ");
    assertEqual(taskRows(fixture).length, 0);
    const error = fixture.querySelector("[data-task-error]");
    assertEqual(error.hidden, false);
    assertEqual(error.textContent, "Enter a task.");
    assertEqual(fixture.querySelector("[data-task-summary]").textContent, "0 of 0 completed");
  } finally {
    cleanup();
  }
});
```

- [ ] **Step 3: Run RED**

Expected: `2/5 tests passed`; the submit event does not change closure state or request another render.

- [ ] **Step 4: Learner implements state-first submit behavior**

```text
handleSubmit(event)
  prevent default
  read and trim the current form input value
  blank
    set errorMessage
    renderApp()
    return
  valid
    append { id: nextTaskId++, title, completed: false } to tasks
    clear errorMessage
    renderApp()
```

`TaskApp` derives rows and summary from closure state passed as props. The handler must not create a row, set summary text, clear an input property, or hide an error DOM node directly.

- [ ] **Step 5: Run GREEN and commit**

Expected: Stage 1 task tests `5/5`.

```bash
git add tests/stage-1/task-app.test.js src/stage-1/app.js
git commit -m "feat(stage-1): rerender declarative task creation"
```

---

### Task 9: Declarative Completion and Filters

**Files:**
- Modify: `tests/stage-1/task-app.test.js`
- Modify: `src/stage-1/app.js`

**Interfaces:**
- Consumes: task state, `renderApp()`, task/filter components, and browser change/click props.
- Produces: completion state updates, filter state updates, derived attributes/visibility, and selected filter state through new descriptions.

- [ ] **Step 1: Append completion and filter tests that re-query after each render**

```js
test("toggling a task rerenders completion and the derived summary", () => {
  const { fixture, cleanup } = mountFixture();
  try {
    submitTitle(fixture, "Render descriptions");
    submitTitle(fixture, "Observe identity");
    taskRows(fixture)[0].querySelector("[data-task-toggle]").click();

    const rowsAfterRender = taskRows(fixture);
    assertEqual(rowsAfterRender[0].dataset.completed, "true");
    assertEqual(rowsAfterRender[0].querySelector("[data-task-toggle]").checked, true);
    assertEqual(fixture.querySelector("[data-task-summary]").textContent, "1 of 2 completed");
  } finally {
    cleanup();
  }
});

test("filters and completion derive a synchronized next description", () => {
  const { fixture, cleanup } = mountFixture();
  try {
    submitTitle(fixture, "Active task");
    submitTitle(fixture, "Completed task");
    taskRows(fixture)[1].querySelector("[data-task-toggle]").click();

    fixture.querySelector('[data-filter="active"]').click();
    let rows = taskRows(fixture);
    assertEqual(rows[0].hidden, false);
    assertEqual(rows[1].hidden, true);
    assertEqual(fixture.querySelector('[data-filter="active"]').getAttribute("aria-pressed"), "true");

    fixture.querySelector('[data-filter="completed"]').click();
    rows = taskRows(fixture);
    assertEqual(rows[0].hidden, true);
    assertEqual(rows[1].hidden, false);
    assertEqual(fixture.querySelector('[data-filter="completed"]').getAttribute("aria-pressed"), "true");
    assertEqual(fixture.querySelector("[data-task-summary]").textContent, "1 of 2 completed");

    fixture.querySelector('[data-filter="all"]').click();
    rows = taskRows(fixture);
    assertEqual(rows[0].hidden, false);
    assertEqual(rows[1].hidden, false);
    assertEqual(fixture.querySelectorAll('[aria-pressed="true"]').length, 1);
  } finally {
    cleanup();
  }
});
```

- [ ] **Step 2: Run RED**

Expected: Stage 1 task tests `5/7`; toggles and filters do not yet update closure state.

- [ ] **Step 3: Learner implements state-only actions**

```text
toggleTask(taskId, completed)
  find the matching task object
  replace or update its completed state
  renderApp()

selectFilter(filter)
  validate all / active / completed
  assign activeFilter
  renderApp()

TaskRow(task, activeFilter, toggleTask)
  derives checked, data-completed, and hidden from task + filter

FilterButton(filter, activeFilter, selectFilter)
  derives aria-pressed from filter equality

TaskApp(tasks, activeFilter, errorMessage, actions)
  derives completed count and every row description
```

No action may query a task row or manually assign DOM state.

- [ ] **Step 4: Run GREEN and commit**

Expected: Stage 1 task tests `7/7`, runtime `12/12`, Stage 0 `7/7`.

```bash
git add tests/stage-1/task-app.test.js src/stage-1/app.js
git commit -m "feat(stage-1): derive completion and filters"
```

---

### Task 10: Reproduce and Record DOM Identity Loss

**Files:**
- Modify: `tests/stage-1/task-app.test.js`
- Create: `notes/stage-1-declarative-rendering.md`

**Interfaces:**
- Consumes: full-replacement `root.render` and the declarative task app.
- Produces: executable identity-loss evidence and the first Stage 1 observation note sections.

- [ ] **Step 1: Temporarily predict identity preservation**

Add a temporary assertion test that captures `[data-task-input]`, clicks the Active filter, and expects the same input object afterward. Run it and observe failure because the references differ. Do not commit that false expectation.

- [ ] **Step 2: Replace the temporary expectation with the observed Stage 1 contract**

Append this committed test:

```js
test("a declarative rerender replaces DOM identity and loses draft focus", () => {
  const { fixture, cleanup } = mountFixture();
  try {
    const firstInput = fixture.querySelector("[data-task-input]");
    firstInput.value = "Uncommitted draft";
    firstInput.focus();

    fixture.querySelector('[data-filter="active"]').click();
    const nextInput = fixture.querySelector("[data-task-input]");

    assertEqual(firstInput === nextInput, false);
    assertEqual(firstInput.isConnected, false);
    assertEqual(nextInput.value, "");
    assertEqual(document.activeElement === nextInput, false);
  } finally {
    cleanup();
  }
});
```

- [ ] **Step 3: Run GREEN**

Expected: Stage 1 task tests `8/8`. Explain why correct visible state does not imply preserved host identity.

- [ ] **Step 4: Create the observation note**

Create `notes/stage-1-declarative-rendering.md` with these completed sections in the learner's own words:

```markdown
# Stage 1: Declarative Elements and Recursive Rendering

## Requirement
## Stage 0 Synchronization Removed
## Element Description Shape
## Recursive Render Path
## Element vs Component vs DOM Node
## Reproduced Identity Failure
## Historical Context
## Browser Host Operations
## React Source Map
## Mechanisms Intentionally Omitted
## Learner Explanation
```

At this task, complete Requirement, Stage 0 Synchronization Removed, Element Description Shape, Recursive Render Path, Element vs Component vs DOM Node, and Reproduced Identity Failure. Leave no placeholder text; omit later sections until Task 11 if they are not yet observed.

- [ ] **Step 5: Commit**

```bash
git add tests/stage-1/task-app.test.js notes/stage-1-declarative-rendering.md
git commit -m "test(stage-1): record full replacement identity loss"
```

---

### Task 11: JSX Inspection, React Source Map, and Stage Checkpoint

**Files:**
- Create: `package.json`
- Create: `package-lock.json`
- Create: `examples/stage-1/jsx-example.jsx`
- Modify: `notes/stage-1-declarative-rendering.md`
- Verify: all Stage 0 and Stage 1 browser pages

**Interfaces:**
- Consumes: completed Stage 1 runtime/app and pinned React source commit `52912a1453`.
- Produces: development-only JSX evidence, completed source map, explanation gate, focused commits, and annotated tag `stage-1-declarative-renderer`.

- [ ] **Step 1: Add development-only JSX tooling**

Create `package.json`:

```json
{
  "name": "mini-react-workshop",
  "private": true,
  "type": "module",
  "scripts": {
    "inspect:stage1-jsx": "esbuild examples/stage-1/jsx-example.jsx --jsx=transform --jsx-factory=createElement --format=esm --log-level=warning"
  },
  "devDependencies": {}
}
```

Run:

```bash
npm install --save-dev esbuild
```

This must create or update `package-lock.json`. Do not import `esbuild` from runtime or application files.

- [ ] **Step 2: Create the JSX input**

Create `examples/stage-1/jsx-example.jsx`:

```jsx
const view = (
  <section data-stage="1">
    <h1>Tasks</h1>
    <p>0 of 0 completed</p>
  </section>
);

console.log(view);
```

- [ ] **Step 3: Inspect the transform output**

Run:

```bash
npm run inspect:stage1-jsx
npm run inspect:stage1-jsx | rg "createElement"
```

Expected: valid JavaScript containing nested `createElement(...)` calls and no JSX syntax. Ask the learner to map each JSX tag, prop, and child to the generated arguments.

- [ ] **Step 4: Inspect pinned React element and root source**

Run:

```bash
git -C /Users/admin/Desktop/open-sources/react show 52912a1453:packages/react/src/jsx/ReactJSXElement.js | nl -ba | sed -n '150,225p'
git -C /Users/admin/Desktop/open-sources/react show 52912a1453:packages/react/src/jsx/ReactJSXElement.js | nl -ba | sed -n '285,350p'
git -C /Users/admin/Desktop/open-sources/react show 52912a1453:packages/react/src/jsx/ReactJSXElement.js | nl -ba | sed -n '600,705p'
git -C /Users/admin/Desktop/open-sources/react show 52912a1453:packages/react/index.js | nl -ba | sed -n '1,80p'
git -C /Users/admin/Desktop/open-sources/react show 52912a1453:packages/react-dom/client.js | nl -ba | sed -n '1,80p'
git -C /Users/admin/Desktop/open-sources/react show 52912a1453:packages/react-dom/src/client/ReactDOMRoot.js | nl -ba | sed -n '90,230p'
```

Record the element fields React produces, what `createRoot` owns, and which Fiber/reconciler calls appear but remain intentionally unexplained until later stages.

- [ ] **Step 5: Complete the Stage 1 note**

Finish Historical Context, Browser Host Operations, React Source Map, Mechanisms Intentionally Omitted, and Learner Explanation with observed, specific prose. Record these historical deviations:

- The workshop uses the modern `createRoot` public name for a clear root boundary.
- JSX appeared early in React's public story, but this workshop delays it until element objects are understood.
- Pre-Hooks component state/lifecycle, reconciliation, Fiber, Hooks/effects, and concurrent lanes enter in later history-guided stages.

- [ ] **Step 6: Pass the Stage 1 explanation gate**

The learner answers in their own words:

1. Why does a declarative description remove manual summary/row/filter DOM updates from event handlers?
2. What is the difference between an element description, invoking a function component, and creating a DOM node?
3. Why does `createElement` not call `document.createElement`?
4. How does recursive rendering reach browser host operations?
5. Why can the rendered content be correct while focus and node identity are lost?
6. Why is reconciliation the next mechanism instead of part of Stage 1?

- [ ] **Step 7: Run final verification**

With a fresh HTTP origin when needed, verify:

```text
/                                             -> Stage 0 workflow works
/tests/stage-0/task-app.test.html              -> 7/7 tests passed
/stage-1.html                                  -> Stage 1 workflow works
/tests/stage-1/runtime.test.html               -> 12/12 tests passed
/tests/stage-1/task-app.test.html              -> 8/8 tests passed
all page consoles                              -> no errors
```

Then run:

```bash
git diff --check
rg -n "T""BD|TO""DO|PLACE""HOLDER|learner observation" notes/stage-1-declarative-rendering.md
git status --short
```

Expected: no diff errors, no placeholder matches, and only the intended JSX tooling/note changes remain before their commits.

- [ ] **Step 8: Commit tooling and the completed note**

```bash
git add package.json package-lock.json examples/stage-1/jsx-example.jsx
git commit -m "chore(stage-1): add JSX inspection"

git add notes/stage-1-declarative-rendering.md
git commit -m "docs(stage-1): record declarative rendering findings"
```

- [ ] **Step 9: Tag the Stage 1 checkpoint**

```bash
git tag -a stage-1-declarative-renderer -m "Complete Stage 1 declarative renderer workshop"
git status --short --branch
git show --no-patch --format='%h %s' stage-1-declarative-renderer
```

Expected: the branch is clean and the annotated tag resolves to the Stage 1 documentation checkpoint commit.

Do not begin Stage 2 automatically. Ask the learner to approve moving to reconciliation only after the Stage 1 explanation gate passes.
