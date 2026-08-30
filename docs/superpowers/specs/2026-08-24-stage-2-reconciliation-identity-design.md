# Stage 2 Reconciliation and Identity Design

**Date:** 2026-08-24
**Status:** Approved
**Depends on:** Completed Stage 1 checkpoint `stage-1-declarative-renderer`

## Goal

Build a small synchronous reconciler that updates the Stage 1 task application without replacing every DOM node on every render.

Stage 2 introduces the central identity rule behind reconciliation: an element's type, key, and position determine whether an existing host node can represent the next description. The learner first experiences positional reuse and its failure mode, then introduces keys to preserve identity when list order changes.

The outcome is not a production React reconciler. It is the smallest runtime that makes reuse, update, insertion, movement, replacement, and deletion observable and explainable.

## Starting Problem

Stage 1 stores application state in a closure and recreates a complete DOM subtree after each state change. Visible content is correct, but browser-owned state is lost because every host node is replaced.

The entry experiment is:

1. Focus the task input.
2. Type an unsubmitted draft.
3. Trigger a filter update that rerenders the application.
4. Observe in Stage 1 that the input object is replaced, its draft disappears, and focus is lost.
5. Require Stage 2 to preserve the same input DOM object, draft, and focus.

This failure defines the first Stage 2 invariant: when the next description represents the same host identity, reuse its existing DOM node.

## Historical Learning Rule

The workshop continues to encounter a problem before introducing the mechanism that addresses it.

Stage 2 therefore proceeds in two deliberate passes:

1. Positional reconciliation proves that selective DOM reuse is possible.
2. A list insertion exposes that position alone is not sufficient identity, motivating keys.

Keys are not introduced as unexplained React syntax. They are added only after the learner observes the wrong host identity being reused.

## Preserving Earlier Stages

Stage 0 and Stage 1 remain unchanged and runnable. Stage 2 is added beside them:

```text
src/
  stage-0/
  stage-1/
  stage-2/
    runtime.js
    app.js

tests/
  stage-0/
  stage-1/
  stage-2/
    runtime.test.html
    runtime.test.js
    task-app.test.html
    task-app.test.js

notes/
  stage-0-imperative-dom.md
  stage-1-declarative-rendering.md
  stage-2-reconciliation.md

stage-2.html
```

Stage 2 may reuse the shared browser test harness and Stage 0 stylesheet. It does not import runtime or application behavior from an earlier stage.

## Public Runtime Boundary

Stage 2 preserves the Stage 1 public API:

```js
createElement(type, props, ...children)
createRoot(container) // -> { render(element), unmount() }
```

The task application also preserves:

```js
mountTaskApp(container)
```

Application code still creates element descriptions and calls `root.render(nextElement)`. The change belongs inside the runtime: `render` now compares with retained records instead of replacing all root contents.

## Description and Key Model

Host elements, text, arrays, empty children, and function components retain their Stage 1 meanings. Stage 2 adds reserved key metadata.

Conceptually:

```js
createElement(TaskRow, { key: task.id, task })

// produces a description shaped like
{
  type: TaskRow,
  key: task.id,
  props: { task },
}
```

`key` is identity information for the reconciler. It is not included in component props and is never applied to a DOM node. `null` or an omitted key means the child is unkeyed.

Keys need to be unique only among siblings. Duplicate non-null keys in one next-child list throw a focused diagnostic because the reconciler could not identify one unambiguous prior child.

## Retained Record Model

Element descriptions remain disposable values. The root additionally retains a small record tree representing the rendered result.

A root record owns the container and an ordered child-record list:

```js
{
  kind: "root",
  container,
  children,
}
```

A host record retains enough information to update one browser element:

```js
{
  kind: "host",
  type,
  key,
  props,
  dom,
  children,
}
```

A text record retains one browser text node:

```js
{
  kind: "text",
  key,
  value,
  dom,
}
```

These are teaching records, not Fiber nodes. They have no parent/sibling work links, alternate tree, update queue, effect flags, lifecycle state, or scheduling information. The traversal cannot pause, resume, or abandon work.

## Input Normalization

Before matching children, the runtime normalizes renderable input:

- `null`, `undefined`, and booleans produce no child.
- Strings and numbers become text descriptions.
- Nested arrays are flattened into an ordered child list.
- Host descriptions remain descriptions until they are mounted or reconciled.
- Function components are invoked with props, and their returned output is normalized.

The root pseudo-record is what allows arrays to produce multiple root children without pretending a `DocumentFragment` remains in the DOM after insertion.

A keyed function component in this stage must resolve to one host root so its key can identify one retained record. Keyed text output, persistent component records, and keyed multi-node component groups are deferred.

## Root Lifecycle and Data Flow

The first call to `root.render(element)` normalizes and mounts the description, then stores the resulting record tree.

Every later render follows this synchronous path:

```text
next application description
  -> normalize renderable input
  -> compare next children with retained child records
  -> reuse or create records and DOM nodes
  -> update, insert, move, replace, or remove DOM nodes
  -> retain the resulting record tree for the next render
```

Comparison and browser mutation happen during the same recursive pass. Stage 2 still has no separate render and commit phases. That separation is deferred until interruptible work makes mutations during calculation unsafe.

`root.unmount()` removes the root's rendered DOM, discards its records, and permanently marks the root inactive. Repeated unmount calls remain harmless. Rendering after unmount throws the same focused lifecycle error as Stage 1.

## Positional Reconciliation Rules

The first implementation compares each next child with the old child at the same index.

For each position:

1. **Old and next are text:** reuse the existing text node. Update `nodeValue` only when the text value changed.
2. **Old and next are host elements with the same type:** reuse the existing DOM node, update its props, then reconcile its children.
3. **The types differ:** mount the next record and replace the old DOM node.
4. **Only the next child exists:** mount and insert it at the required position.
5. **Only the old child exists:** remove its DOM node and discard its record.

Unchanged descriptions do not cause host writes. This includes leaving an input's browser-owned draft alone when neither the old nor next description supplies a `value` prop.

## Prop and Event Updates

Reused host nodes receive a symmetric comparison of old and next supported props.

- A new or changed direct property is assigned only when its described value changed.
- A new or changed `data-*` or `aria-*` value is written with `setAttribute`.
- A removed attribute is removed with `removeAttribute`.
- A changed event handler removes the previous listener before registering the next listener.
- A removed event handler removes its previous listener.
- An unchanged prop or handler performs no host operation.
- `children` and `key` are reconciler data and never applied as host props.

The supported prop and event surface remains intentionally limited to what the workshop application and focused runtime tests require. Stage 2 adds removal and update behavior; it does not become a complete React DOM property system.

## Positional Identity Failure

Positional matching is intentionally incomplete. Inserting a task at the beginning of an unkeyed list can make the first prior task row represent a different task merely because both rows have the same host type at index zero.

The visible text can be updated while browser-owned row state, focus, or a retained DOM reference follows the position rather than the logical task. The learner records this incorrect reuse before implementing keyed matching.

## Keyed Child Reconciliation

The keyed pass changes sibling matching from position-only identity to type-and-key identity.

For a next keyed child:

- The same key and same resolved host type reuse the prior record and DOM node.
- The same key with a different resolved host type replaces the prior record.
- A new key mounts a new record.
- An old key absent from the next list is removed.
- A matched record at a different position is moved with DOM insertion semantics rather than recreated.

Unkeyed children continue to use their relative positional identity among the remaining unkeyed siblings. The runtime inserts or moves each resulting DOM node before the current host anchor, then removes unmatched old records.

The Stage 2 task list uses stable task IDs as keys. Array indexes are discussed as positions, not stable task identity, and are used to reproduce the failure rather than presented as the solution.

## Function Component Boundary

Function components are invoked again on every render. The reconciler compares their resolved host/text output; it does not retain a persistent component instance.

```text
function component description
  -> invoke component
  -> normalize returned description
  -> reconcile resolved host/text output
```

This means Stage 2 can preserve host identity beneath `TaskApp` and `TaskRow`, but it cannot yet attach state, lifecycle behavior, Hooks, or an update queue to a component identity. That missing persistent component mechanism is the entry problem for Stage 3.

## Task Application Parity

The Stage 2 task application preserves the observable Stage 1 contract:

- Add a non-blank task.
- Reject blank task titles with a visible error.
- Toggle task completion.
- Filter All, Active, and Completed tasks.
- Keep the derived `C of T completed` summary synchronized.
- Preserve established `data-task-*`, `data-filter`, `data-completed`, `hidden`, and `aria-pressed` behavior.
- Unmount without affecting another root.

Application event handlers continue to update closure state and request a render. They do not directly synchronize task rows, summary text, filter attributes, or visibility.

Stage 2 reverses the Stage 1 identity contract: an unrelated rerender must preserve the input DOM object, its browser-owned draft, and focus.

## Error Strategy

Stage 2 preserves focused synchronous errors for invalid containers, unsupported descriptions, unsupported child types, unsupported props, invalid event handler values, and rendering after unmount.

Duplicate sibling keys remain unsupported. React reports them with a development-only warning rather than throwing; Stage 2 has no development/production diagnostics layer, so that warning is intentionally deferred. Errors from the focused runtime validations are not swallowed or recovered. Error boundaries remain outside this stage.

Expected lesson failures, such as the initial focus loss and later unkeyed-list identity bug, are written as isolated observations so they cannot be confused with unrelated runtime errors.

## Test Strategy

Browser tests provide the primary evidence because DOM identity, focus, input draft values, event listeners, and movement are browser behaviors.

Runtime tests are introduced one mechanism at a time:

1. Same type and position preserve the DOM object.
2. Changed text updates the existing text node.
3. Props can be added, changed, and removed without touching unchanged props.
4. Changed and removed event handlers do not leave duplicate listeners.
5. Children can be inserted, replaced, and deleted at the correct position.
6. Positional list reconciliation reproduces wrong logical identity after a front insertion.
7. Stable keys preserve identity through insertion and reordering.
8. Removed keyed children disconnect from the DOM.
9. A keyed function component with multiple host roots is rejected because this stage cannot retain one key for a multi-node group.
10. Unmount discards retained records and keeps root isolation.

Task application tests copy the Stage 1 behavior contract and change only the identity expectation: filter-driven rerenders preserve the input object, draft, and focus.

Node's built-in `node:test` may be used for a pure matching helper if one naturally emerges. The design does not require extracting a planning subsystem merely to create unit tests; host behavior remains visible in browser tests.

Stage 0 and Stage 1 suites remain regression checks and must continue to pass unchanged.

## Lesson Sequence

1. Reproduce Stage 1 input identity, draft, and focus loss.
2. Make the Stage 2 identity test fail against an initial full-replacement renderer.
3. Retain a minimal root record and reuse one same-type host node.
4. Reconcile text while preserving its text-node identity.
5. Diff supported props and event listeners symmetrically.
6. Insert, replace, and delete positional children.
7. Rebuild the task application with the Stage 2 runtime and prove input preservation.
8. Reproduce wrong identity after inserting or reordering unkeyed task rows.
9. Add reserved keys and keyed sibling matching.
10. Prove keyed insertion, movement, deletion, and same-key type replacement; defer React-style development warnings for duplicate keys.
11. Record the mechanism and compare it with the pinned React source boundary.
12. Complete the explanation gate and Git checkpoint.

Each coding step remains learner-driven: the guide explains the problem, state flow, function responsibility, and acceptance criterion; the learner predicts the result and writes the bounded code; then both review and verify it.

## React Source Comparison

Production comparison remains pinned to React commit `52912a1453` and happens only after the smaller mechanism is understood.

The primary Stage 2 landmark is:

- `packages/react-reconciler/src/ReactChildFiber.js`

The comparison maps concepts we built—type matching, keys, placement, deletion, reuse, and text updates—to their production boundaries. If React source introduces a mechanism not yet built, the note explains it at a high level and labels its implementation deferred rather than assuming the learner understands it from a function name.

The comparison must explicitly distinguish the Stage 2 record tree from Fiber. Production React performs reconciliation while producing work for a later commit and supports component identity, update queues, priorities, and many element kinds. Stage 2 mutates the DOM during its synchronous comparison and supports only the bounded teaching surface.

## Exclusions

Stage 2 does not implement:

- Persistent function-component instances or component-owned state.
- Class component state or lifecycle methods.
- Fiber parent/child/sibling work links, current/work-in-progress alternates, or effect flags.
- Separate render and commit phases.
- Scheduling, batching, priorities, lanes, interruption, or restart behavior.
- Hooks, refs, effects, context, portals, fragments as persistent identities, Suspense, hydration, or error recovery.
- React's complete key coercion, warning, iterable, DOM property, style, or synthetic-event behavior.
- An optimal general-purpose tree-diff algorithm.

## Exit Criteria

Stage 2 is complete only when the learner can explain, in their own words:

1. Why full replacement loses browser-owned state even when application state is correct.
2. What information the retained record stores that an element description does not.
3. Why same type and position can justify reuse for simple children.
4. Why position alone gives the wrong identity when list order changes.
5. Why a stable key is meaningful only among siblings and must represent logical identity.
6. How prop and event comparison avoids both unnecessary writes and stale listeners.
7. How insertion, movement, replacement, and deletion differ at the host level.
8. Why the Stage 2 record tree is not Fiber.
9. Why function-component state and separate render/commit phases remain unsolved.
