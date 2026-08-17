# Stage 0 Imperative Browser UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build and examine a dependency-free imperative task application whose manually synchronized DOM demonstrates the problem that motivates declarative UI.

**Architecture:** A single browser entry point mounts a Stage 0 application implemented with browser DOM APIs and ES modules. The application owns plain JavaScript task state but each event handler explicitly coordinates the DOM regions affected by that state change; a dependency-free in-browser harness verifies observable behavior and makes synchronization omissions visible.

**Tech Stack:** Plain JavaScript, browser ES modules, HTML, CSS, browser DOM APIs, and a custom in-browser assertion harness; no runtime, build, or test dependencies.

## Global Constraints

- The learner writes the application code by hand; the guide introduces one bounded objective at a time, reviews the result, and does not silently replace learner-owned code.
- Runtime code uses plain JavaScript and browser ES modules.
- Stage 0 uses browser APIs directly and has no runtime or build dependency.
- JSX is excluded until Stage 1.
- Browser integration behavior is checked with a visible example and a minimal in-browser assertion harness.
- The Stage 0 interface includes item creation, completion toggling, filtering, and a derived summary so one state change affects several parts of the DOM.
- The implementation is intentionally imperative: do not add a virtual tree, `createElement`, a general `render(state)` function, reconciliation, Fiber, scheduling, or hooks.
- Production React comparisons use `/Users/admin/Desktop/open-sources/react` pinned to commit `52912a1453`.
- The main branch must remain runnable at every committed checkpoint.

## Workshop Execution Protocol

This is a learner-driven plan, not permission to generate the application solution. For every task:

1. The guide adds or presents the smallest failing behavioral check.
2. The guide asks the learner to predict the failure before running it.
3. The learner writes the corresponding code in `src/stage-0/app.js` by hand.
4. The guide reviews the learner's code and asks the reasoning questions listed in that task.
5. The learner fixes defects with diagnosis and hints from the guide.
6. The guide and learner run the task's verification before committing.

The test, HTML, CSS, and note snippets below are exact scaffolding. The learner-owned application body is specified as an interface, state model, event flow, and acceptance criteria rather than supplied as a completed solution. If the learner asks for help, reveal hints progressively: identify the failing invariant, identify the relevant DOM/state boundary, provide pseudocode, and only then provide a local code example for the blocked fragment.

## File Map

- `index.html` — minimal visible entry point; imports and mounts the Stage 0 app.
- `src/stage-0/app.js` — learner-owned task state, DOM creation, event handlers, and explicit synchronization operations.
- `src/stage-0/styles.css` — small usability layer; it must not encode application state except through `[hidden]`, `data-completed`, and `aria-pressed` attributes set by JavaScript.
- `tests/browser/harness.js` — dependency-free test registration, assertions, result rendering, and pass/fail status.
- `tests/stage-0/task-app.test.html` — browser page that hosts the test report.
- `tests/stage-0/task-app.test.js` — black-box interaction tests against the mounted DOM.
- `notes/stage-0-imperative-dom.md` — predictions, synchronization inventory, failure experiment, invariant, and pinned React host-operation source map.

## Stable Interfaces and DOM Contract

`src/stage-0/app.js` exports exactly this public boundary:

```js
export function mountTaskApp(container) // -> { destroy() }
```

- `container` must be an `HTMLElement`; otherwise throw `TypeError("mountTaskApp requires an HTMLElement container")`.
- Once task behavior is introduced, each mount owns isolated state: `{ tasks: [], activeFilter: "all", nextTaskId: 1 }`.
- Each task is `{ id: number, title: string, completed: boolean }`.
- `destroy()` removes listeners installed by the mount and empties only that mount's container.
- Tests use only DOM interactions and `destroy()`; do not expose internal task state for testing.

The mounted DOM exposes these stable selectors:

| Selector | Meaning |
| --- | --- |
| `[data-task-form]` | New-task form |
| `[data-task-input]` | Task-title input |
| `[data-task-error]` | Validation message; hidden when empty |
| `[data-task-summary]` | Exact text `C of T completed` |
| `[data-task-list]` | Task rows container |
| `[data-task-row]` | One task; includes `data-task-id` and `data-completed` |
| `[data-task-toggle]` | Checkbox that toggles one task |
| `[data-task-title]` | Visible task title |
| `[data-filter="all|active|completed"]` | Filter button |

Only the selected filter has `aria-pressed="true"`. Nonmatching task rows use the native `hidden` property. Completed rows have `data-completed="true"`; active rows have `data-completed="false"`.

---

### Task 1: Runnable Foundation and Browser Test Harness

**Files:**
- Create: `index.html`
- Create: `src/stage-0/app.js`
- Create: `src/stage-0/styles.css`
- Create: `tests/browser/harness.js`
- Create: `tests/stage-0/task-app.test.html`
- Create: `tests/stage-0/task-app.test.js`

**Interfaces:**
- Consumes: native `HTMLElement`, DOM event, and ES module APIs.
- Produces: `mountTaskApp(container) -> { destroy() }` and the stable selectors in the DOM contract.

- [ ] **Step 1: Create the browser assertion harness**

Create `tests/browser/harness.js`:

```js
const tests = [];

export function test(name, callback) {
  tests.push({ name, callback });
}

export function assert(condition, message) {
  if (!condition) throw new Error(message);
}

export function assertEqual(actual, expected, message = "Values differ") {
  if (!Object.is(actual, expected)) {
    throw new Error(`${message}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
}

export async function run() {
  const results = document.querySelector("[data-test-results]");
  let failures = 0;

  for (const { name, callback } of tests) {
    const item = document.createElement("li");
    try {
      await callback();
      item.textContent = `PASS: ${name}`;
      item.dataset.result = "pass";
    } catch (error) {
      failures += 1;
      item.textContent = `FAIL: ${name} — ${error.message}`;
      item.dataset.result = "fail";
      console.error(error);
    }
    results.append(item);
  }

  document.body.dataset.testStatus = failures === 0 ? "passed" : "failed";
  document.querySelector("[data-test-summary]").textContent =
    `${tests.length - failures}/${tests.length} tests passed`;
}
```

- [ ] **Step 2: Create the test page and the first failing smoke test**

Create `tests/stage-0/task-app.test.html`:

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Stage 0 task app tests</title>
  </head>
  <body>
    <h1>Stage 0 task app tests</h1>
    <p data-test-summary>Tests have not run.</p>
    <ol data-test-results></ol>
    <script type="module" src="./task-app.test.js"></script>
  </body>
</html>
```

Create `tests/stage-0/task-app.test.js`:

```js
import { assert, assertEqual, run, test } from "../browser/harness.js";
import { mountTaskApp } from "../../src/stage-0/app.js";

function mountFixture() {
  const fixture = document.createElement("div");
  document.body.append(fixture);
  const app = mountTaskApp(fixture);
  return {
    fixture,
    cleanup() {
      app.destroy();
      fixture.remove();
    },
  };
}

test("mounts the empty task interface", () => {
  const { fixture, cleanup } = mountFixture();
  try {
    assert(fixture.querySelector("[data-task-form]"), "task form is missing");
    assert(fixture.querySelector("[data-task-input]"), "task input is missing");
    assert(fixture.querySelector("[data-task-list]"), "task list is missing");
    assertEqual(
      fixture.querySelector("[data-task-summary]").textContent.trim(),
      "0 of 0 completed",
      "initial summary is incorrect",
    );
    assertEqual(fixture.querySelectorAll("[data-task-row]").length, 0);
  } finally {
    cleanup();
  }
});

test("rejects a non-element mount target", () => {
  let thrown;
  try {
    mountTaskApp(null);
  } catch (error) {
    thrown = error;
  }
  assert(thrown instanceof TypeError, "expected a TypeError");
  assertEqual(thrown.message, "mountTaskApp requires an HTMLElement container");
});

run();
```

- [ ] **Step 3: Run the smoke test and predict the failure**

Run in terminal A:

```bash
python3 -m http.server 4173
```

Open `http://localhost:4173/tests/stage-0/task-app.test.html`.

Expected before `app.js` exists: the browser reports a module load failure for `/src/stage-0/app.js`; the test page cannot pass. Ask the learner why ES modules require HTTP serving rather than opening the file directly.

- [ ] **Step 4: Learner builds the smallest mount shell that can pass the smoke tests**

Ask the learner to write `src/stage-0/app.js` by hand. The implementation for this task must do only the following:

```text
mountTaskApp(container)
  validate that container is an HTMLElement
  create the form and task input
  create summary text "0 of 0 completed"
  create an empty task list
  attach the shell to container
  return destroy(), which empties container
```

Do not create task rows, error UI, filter buttons, task state, or event handlers yet. Those behaviors do not have failing tests in this task. Review that a second mount can be created and destroyed without affecting the first container.

- [ ] **Step 5: Create the visible page and minimal styles**

Create `index.html`:

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Mini React — Stage 0</title>
    <link rel="stylesheet" href="./src/stage-0/styles.css" />
  </head>
  <body>
    <main id="app"></main>
    <script type="module">
      import { mountTaskApp } from "./src/stage-0/app.js";
      mountTaskApp(document.querySelector("#app"));
    </script>
  </body>
</html>
```

Create `src/stage-0/styles.css`:

```css
:root {
  color-scheme: light dark;
  font-family: system-ui, sans-serif;
}

body {
  margin: 0;
  padding: 2rem;
}

main {
  max-width: 40rem;
  margin-inline: auto;
}

form,
[data-task-row] {
  display: flex;
  gap: 0.75rem;
  align-items: center;
}

[data-task-list] {
  padding: 0;
  list-style: none;
}

[data-task-row] {
  padding-block: 0.5rem;
}

[data-completed="true"] [data-task-title] {
  text-decoration: line-through;
  opacity: 0.65;
}

```

- [ ] **Step 6: Verify and commit the foundation**

Refresh the test page and open `http://localhost:4173/`.

Expected: `2/2 tests passed`; the visible page shows the empty task interface; the browser console has no errors.

```bash
git add index.html src/stage-0 tests/browser tests/stage-0
git commit -m "chore(stage-0): add browser workshop foundation"
```

### Task 2: Task Creation and Input Validation

**Files:**
- Modify: `src/stage-0/app.js`
- Modify: `tests/stage-0/task-app.test.js`

**Interfaces:**
- Consumes: the Task 1 mount shell.
- Produces: form submission that appends `{ id, title, completed: false }`, creates one DOM row, and updates the summary.

- [ ] **Step 1: Add failing creation and validation tests before `run()`**

Add these helpers near `mountFixture()`:

```js
function submitTitle(fixture, title) {
  const input = fixture.querySelector("[data-task-input]");
  input.value = title;
  fixture.querySelector("[data-task-form]").dispatchEvent(
    new SubmitEvent("submit", { bubbles: true, cancelable: true }),
  );
}

function taskRows(fixture) {
  return [...fixture.querySelectorAll("[data-task-row]")];
}
```

Add before `run()`:

```js
test("submitting a title appends an active task", () => {
  const { fixture, cleanup } = mountFixture();
  try {
    submitTitle(fixture, "Read React source");
    const rows = taskRows(fixture);
    assertEqual(rows.length, 1);
    assertEqual(rows[0].querySelector("[data-task-title]").textContent, "Read React source");
    assertEqual(rows[0].dataset.completed, "false");
    assertEqual(rows[0].querySelector("[data-task-toggle]").checked, false);
    assertEqual(fixture.querySelector("[data-task-summary]").textContent, "0 of 1 completed");
    assertEqual(fixture.querySelector("[data-task-input]").value, "");
  } finally {
    cleanup();
  }
});

test("blank input leaves state and DOM unchanged", () => {
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

- [ ] **Step 2: Run and confirm the meaningful failures**

Refresh the test page.

Expected: the two existing tests pass; task creation fails because no row is appended; blank validation fails because the error remains hidden. Ask the learner to predict which state and DOM locations a successful submission must change.

- [ ] **Step 3: Learner implements the submit path by hand**

Before registering the submit handler, extend the mount setup with private `tasks = []` and `nextTaskId = 1` variables plus a hidden `[data-task-error]` region.

Required submit-event flow:

```text
submit event
  prevent default browser submission
  trim the input value
  if empty: show exact message "Enter a task." and stop without changing tasks or nextTaskId
  otherwise: hide and clear the error
  create { id: nextTaskId, title, completed: false }
  increment nextTaskId
  append task to tasks
  create and append one li row with the stable row selectors and attributes
  update summary to "0 of T completed"
  clear the input and return focus to it
```

The row must be created with `document.createElement` and inserted with a browser DOM operation. Do not rebuild the whole list, assign a serialized HTML string containing the task title, or introduce a general render function.

Add the error-region rule to `src/stage-0/styles.css` in this task:

```css
[data-task-error] {
  color: #c62828;
}
```

- [ ] **Step 4: Review normal and edge behavior**

Ask the learner:

1. Why must the title be assigned through `textContent` rather than interpolated into `innerHTML`?
2. Which operation changes JavaScript state, and which operations change visible browser state?
3. What would become inconsistent if the summary update were omitted?

Then refresh the tests and manually submit `<img src=x onerror=alert(1)>` on the visible page.

Expected: `4/4 tests passed`; the HTML-looking title is displayed as text and does not execute.

- [ ] **Step 5: Commit task creation**

```bash
git add src/stage-0/app.js src/stage-0/styles.css tests/stage-0/task-app.test.js
git commit -m "feat(stage-0): add imperative task creation"
```

### Task 3: Completion Toggling and Derived Summary

**Files:**
- Modify: `src/stage-0/app.js`
- Modify: `tests/stage-0/task-app.test.js`

**Interfaces:**
- Consumes: task identity through numeric `data-task-id` and the private task array.
- Produces: checkbox changes that mutate the matching task, synchronize the row's completion attribute, and recompute `C of T completed`.

- [ ] **Step 1: Add the failing completion test before `run()`**

```js
test("toggling a task synchronizes its row and the derived summary", () => {
  const { fixture, cleanup } = mountFixture();
  try {
    submitTitle(fixture, "Trace createRoot");
    submitTitle(fixture, "Trace commitRoot");
    const [firstRow] = taskRows(fixture);
    firstRow.querySelector("[data-task-toggle]").click();

    assertEqual(firstRow.dataset.completed, "true");
    assertEqual(firstRow.querySelector("[data-task-toggle]").checked, true);
    assertEqual(fixture.querySelector("[data-task-summary]").textContent, "1 of 2 completed");
  } finally {
    cleanup();
  }
});
```

- [ ] **Step 2: Run and inspect the partial browser behavior**

Refresh the test page.

Expected: the browser may check the checkbox automatically, but the test still fails because task state, `data-completed`, and summary have not been synchronized. Ask the learner why a checked DOM control is not proof that application state changed.

- [ ] **Step 3: Learner implements the toggle path by hand**

Required event flow:

```text
checkbox change
  read numeric task identity from the containing row
  find exactly one matching task in the task array
  if missing: throw Error("Unknown task id: ID")
  copy checkbox.checked into task.completed
  copy task.completed into row.dataset.completed
  count all completed tasks
  replace summary text with "C of T completed"
```

Keep task lookup, row synchronization, and summary synchronization visibly distinct so the learner can identify the coordination burden. Do not centralize all UI output in a declarative renderer.

- [ ] **Step 4: Verify and reason about the derived view**

Expected after refresh: `5/5 tests passed`.

Ask the learner to trace the exact order for one checkbox click: native checkbox mutation, event callback, task lookup, state mutation, row mutation, summary mutation. Ask which visible result would become stale if an exception occurred halfway through that sequence.

- [ ] **Step 5: Commit completion behavior**

```bash
git add src/stage-0/app.js tests/stage-0/task-app.test.js
git commit -m "feat(stage-0): synchronize task completion"
```

### Task 4: Filtering and the Multi-Region Synchronization Problem

**Files:**
- Modify: `src/stage-0/app.js`
- Modify: `tests/stage-0/task-app.test.js`
- Modify: `src/stage-0/styles.css`

**Interfaces:**
- Consumes: private `activeFilter`, task completion state, row task identities, and filter buttons.
- Produces: `all`, `active`, and `completed` views using row `hidden` properties and one `aria-pressed="true"` button.

- [ ] **Step 1: Add the failing filter interaction test before `run()`**

```js
test("filters stay synchronized when completion changes", () => {
  const { fixture, cleanup } = mountFixture();
  try {
    submitTitle(fixture, "Read beginWork");
    submitTitle(fixture, "Read completeWork");
    const [firstRow, secondRow] = taskRows(fixture);

    fixture.querySelector('[data-filter="active"]').click();
    firstRow.querySelector("[data-task-toggle]").click();
    assertEqual(firstRow.hidden, true, "completed row should leave the active view");
    assertEqual(secondRow.hidden, false, "active row should remain visible");
    assertEqual(fixture.querySelector("[data-task-summary]").textContent, "1 of 2 completed");

    fixture.querySelector('[data-filter="completed"]').click();
    assertEqual(firstRow.hidden, false, "completed row should be visible");
    assertEqual(secondRow.hidden, true, "active row should be hidden");
    assertEqual(
      fixture.querySelector('[data-filter="completed"]').getAttribute("aria-pressed"),
      "true",
    );

    fixture.querySelector('[data-filter="all"]').click();
    assertEqual(firstRow.hidden, false);
    assertEqual(secondRow.hidden, false);
    assertEqual(fixture.querySelectorAll('[aria-pressed="true"]').length, 1);
  } finally {
    cleanup();
  }
});
```

- [ ] **Step 2: Run and identify every affected region**

Refresh the test page.

Expected: `5/6 tests passed`; the filter test fails. Before coding, have the learner fill this prediction table verbally or in scratch notes:

| Action | State mutation | Row mutation | Summary mutation | Filter-button mutation | Visibility mutation |
| --- | --- | --- | --- | --- | --- |
| Add task | yes | create | yes | no | yes |
| Toggle task | yes | update | yes | no | yes |
| Select filter | yes | no | no | yes | yes |

- [ ] **Step 3: Learner implements filtering by hand**

Filtering predicate:

```text
all       -> every task matches
active    -> task.completed is false
completed -> task.completed is true
```

Required filter-button event flow:

```text
create private activeFilter = "all" state when the app mounts
create a [data-task-filters] group with All, Active, and Completed buttons when the app mounts
read the clicked button's data-filter value
reject any value outside all|active|completed with Error("Unknown filter: VALUE")
store the new activeFilter
set aria-pressed=true only on the matching button
for every task row: find its task, evaluate the predicate, set row.hidden to the inverse
```

The task-submit and task-toggle paths must also apply the current visibility predicate after their own state changes. This duplication is intentional evidence for Stage 0; do not solve it with a general renderer.

Add the filter-button style in this task:

```css
[aria-pressed="true"] {
  font-weight: 700;
}
```

- [ ] **Step 4: Run automated and visible verification**

Expected after refresh: `6/6 tests passed`.

On `http://localhost:4173/`, manually perform:

1. Add two tasks.
2. Select Active.
3. Complete the first task; it disappears and the summary becomes `1 of 2 completed`.
4. Select Completed; only the first task appears.
5. Select All; both tasks appear, with the first visually completed.

Confirm keyboard focus is visible, filter buttons are real buttons, checkboxes have associated task-title labels, and the browser console has no errors.

- [ ] **Step 5: Commit filtering behavior**

```bash
git add src/stage-0/app.js src/stage-0/styles.css tests/stage-0/task-app.test.js
git commit -m "feat(stage-0): add imperative task filters"
```

### Task 5: Problem Observation, React Host Map, and Stage Checkpoint

**Files:**
- Create: `notes/stage-0-imperative-dom.md`
- Verify: `index.html`
- Verify: `src/stage-0/app.js`
- Verify: `tests/stage-0/task-app.test.html`

**Interfaces:**
- Consumes: the complete Stage 0 behavior and React source at commit `52912a1453`.
- Produces: an executable demonstration, written synchronization evidence, a source map from workshop DOM operations to React DOM host operations, and tag `stage-0-imperative-dom`.

- [ ] **Step 1: Reproduce one synchronization failure deliberately**

With all six tests passing, identify the statement in the toggle handler that refreshes the summary. Temporarily remove only that statement, refresh the test page, and observe the completion test fail with a stale `0 of 2 completed` value while the checkbox and row appear completed.

Restore that exact statement manually and refresh again. Expected: `6/6 tests passed`. Do not commit the temporary fault.

- [ ] **Step 2: Write the observation note from the evidence**

Create `notes/stage-0-imperative-dom.md` with the exact title `Stage 0: Imperative DOM Observations` and these completed sections:

- `Requirement` — state that task creation, completion, filtering, and a derived completion summary are maintained with browser DOM APIs directly.
- `Prediction Inventory` — include a table with rows for Add task, Toggle task, and Select filter; name both the JavaScript state affected and every DOM region that must remain synchronized.
- `Reproduced Failure` — name the omitted summary update, the stale visible result, the failing test, and why the remaining DOM looked partly correct.
- `Stage 0 Invariant` — state, in the learner's words, the required relationship between the task array, selected filter, task rows, and completion summary.
- `Why the Current Approach Becomes Difficult` — explain why each event path must remember every consumer of changed state and how ordering or omissions expose inconsistent UI.
- `Browser Host Operations` — map row creation to `document.createElement` / `createInstance`, insertion to `append` / `appendInitialChild`, property or text changes to `textContent` and DOM properties / `commitUpdate`, insertion before a sibling to the browser and host-config `insertBefore`, and mount cleanup to browser removal / `removeChild`.
- `React Source Map` — record `ReactDOMRoot.js` / `createRoot`; `ReactFiberConfigDOM.js` / `createInstance`, `appendInitialChild`, `commitUpdate`, `insertBefore`, and `removeChild`; reference commit `52912a1453`; and the production mechanisms intentionally omitted from Stage 0.
- `Learner Explanation` — explain the difference between imperative mutation and a declarative description of UI state without using a memorized slogan.

Every section must contain observed, specific prose before the note is committed.

- [ ] **Step 3: Inspect the pinned React source after the smaller mechanism exists**

Run:

```bash
git -C /Users/admin/Desktop/open-sources/react show 52912a1453:packages/react-dom/src/client/ReactDOMRoot.js | nl -ba | sed -n '160,230p'
git -C /Users/admin/Desktop/open-sources/react show 52912a1453:packages/react-dom-bindings/src/client/ReactFiberConfigDOM.js | nl -ba | sed -n '520,715p'
git -C /Users/admin/Desktop/open-sources/react show 52912a1453:packages/react-dom-bindings/src/client/ReactFiberConfigDOM.js | nl -ba | sed -n '980,1025p'
git -C /Users/admin/Desktop/open-sources/react show 52912a1453:packages/react-dom-bindings/src/client/ReactFiberConfigDOM.js | nl -ba | sed -n '1115,1225p'
```

For each source landmark, record what data React receives and which browser mutation it eventually performs. Do not read forward into reconciliation yet; Stage 0 is mapping familiar host mutations, not explaining the engine that selects them.

- [ ] **Step 4: Pass the Stage 0 explanation gate**

The learner answers these questions before the checkpoint:

1. When a task is completed under the Active filter, which state and DOM locations change?
2. Why can the UI become partly correct and partly stale in the same event handler?
3. What would a single description of UI for the current state remove from each event handler?
4. Which browser operations in this app correspond to React DOM host-config operations?

Exit criterion: the learner can explain, in their own words, that imperative code distributes mutation instructions across event paths, while a declarative description states what the UI should be for a state and lets a renderer determine the required host mutations.

- [ ] **Step 5: Run final verification**

With the HTTP server running, verify:

```text
http://localhost:4173/                                  -> task workflow works
http://localhost:4173/tests/stage-0/task-app.test.html -> 6/6 tests passed
browser console                                         -> no errors
```

Then run:

```bash
git status --short
rg -n "T""BD|TO""DO|PLACE""HOLDER|learner observation" notes/stage-0-imperative-dom.md
```

Expected: `git status --short` lists only the new note; `rg` returns no matches.

- [ ] **Step 6: Commit and tag the Stage 0 checkpoint**

```bash
git add notes/stage-0-imperative-dom.md
git commit -m "docs(stage-0): record imperative DOM findings"
git tag -a stage-0-imperative-dom -m "Complete Stage 0 imperative DOM workshop"
git status --short --branch
```

Expected: the branch is clean and the annotated tag resolves to the documentation checkpoint commit.

Do not begin Stage 1 automatically. Ask the learner whether they approve moving on only after the Stage 0 exit explanation passes.
