# Stage 3B Class Lifecycle Design

## Purpose

Stage 3A gave state a persistent class-component identity. Stage 3B adds the
smallest lifecycle surface needed to explain how pre-Hooks React connects that
identity to host mutations and resource cleanup.

The runtime will support:

- `componentDidMount()`
- `componentDidUpdate(prevProps, prevState)`
- `componentWillUnmount()`

The goal is to reproduce React's observable lifecycle timing without adding
Fiber, effect flags, or a general commit phase before Stage 4.

## Learning Problem

The current runtime can retain state and reconcile DOM, but a component cannot
observe when its output has entered or changed in the browser, and it has no
defined place to clean up resources before its identity is discarded.

Calling lifecycle methods directly from the existing recursive functions would
not solve this correctly. A mount callback could run before an ancestor inserts
the component's DOM into the document, and a state update from a lifecycle
could interrupt the current traversal. Stage 3B therefore needs a small
root-owned lifecycle boundary.

## Scope

### Included

- Optional mount, update, and unmount methods on class-component instances.
- React-like callback arguments and ordering.
- A root-owned queue for post-mutation mount and update callbacks.
- Follow-up rendering when a mount or update callback calls `setState()`.
- Parent-before-child unmount cleanup before DOM removal.
- JSX-authored lifecycle tests compiled through the project's existing esbuild
  dependency and the Mini React `createElement` factory.
- Focused source comparison against React commit `52912a1453`.

### Excluded

- Deprecated `componentWillMount`, `componentWillReceiveProps`, and
  `componentWillUpdate` methods.
- `shouldComponentUpdate`, `getSnapshotBeforeUpdate`, derived state, refs,
  context, Hooks, and effects.
- Strict Mode's development-only mount/unmount/mount check.
- A `setState` callback argument.
- Error boundaries or commit-phase error recovery.
- General event batching, timers, scheduling, priorities, lanes, interruption,
  or restart behavior.
- Fiber nodes, alternates, effect flags, and a separate general commit walk.

## Public Lifecycle Contract

### Mount

If an instance defines `componentDidMount()`, the runtime calls it once after
the initial root DOM pass has completed. The instance already exposes its
current props and state, and its host output is connected to the root
container. The method receives no arguments and its return value is ignored.

Nested mount callbacks run child before parent.

### Update

If an existing component identity defines
`componentDidUpdate(prevProps, prevState)`, the runtime calls it after the
component's child has reconciled and after the root DOM pass completes. It is
not called for the initial mount.

The arguments are the props and state from before that update. During the
callback, `this.props` and `this.state` contain the current values. The return
value is ignored.

Nested update callbacks run child before parent. Because Stage 3B has no
`shouldComponentUpdate`, every same-identity component reconciliation that
calls `render()` also queues its update lifecycle.

### Unmount

If an instance defines `componentWillUnmount()`, the runtime calls it once when
that identity is replaced, deleted, or removed by `root.unmount()`. The callback
runs before the DOM is removed and before the instance loses its private
updater. It receives no arguments and its return value is ignored.

The instance is marked as unmounting before the callback, so `setState()` from
the callback throws the focused unmount error. Nested cleanup runs parent
before child, matching the inspected React deletion traversal.

## Root Work and Lifecycle Flow

The root keeps the existing synchronous DOM reconciliation but adds a small
post-mutation lifecycle queue.

```text
root.render() or setState()
  -> request synchronous work
  -> reconcile descriptions and mutate DOM
  -> collect child-before-parent did callbacks
  -> finish the complete root DOM pass
  -> flush did callbacks
  -> run one follow-up render if callbacks requested state work
```

The root tracks these concepts:

- whether render/reconciliation is active;
- whether lifecycle callbacks are being flushed;
- whether another render was requested;
- the did-callback queue for the current DOM pass.

`setState()` remains synchronous when requested from normal application code.
During a lifecycle flush, however, it appends update data and marks another
render as requested instead of recursively interrupting the current callback
queue. After all callbacks from the current pass finish, the root processes the
accumulated updates in one follow-up render. This is limited lifecycle-flush
batching, not general event batching.

An unconditional `setState()` in `componentDidUpdate()` can therefore create an
update loop, as it can in React. Tests use guarded updates only.

## Record and Reconciliation Changes

### Mounting a Component Record

The runtime creates the instance and component record as in Stage 3A, renders
and mounts its child, then registers the instance's mount callback if present.
Because the root delays callback execution until the complete DOM pass has
finished, the component's output is connected when the callback runs.

Recursive child mounting registers child callbacks first, producing
child-before-parent order without a second tree traversal.

### Updating a Component Record

Before replacing instance fields, reconciliation captures:

- `prevProps` from the retained instance;
- `prevState` from the retained instance.

It then installs the next props, reduces pending state updates, calls
`render()`, and reconciles the child. After the child is complete, it registers
`componentDidUpdate(prevProps, prevState)` if present. Child callbacks are
therefore registered before the parent's callback.

### Removing a Record

Removal becomes an explicit operation performed before the corresponding DOM
mutation:

1. Mark a component instance as unmounting.
2. Call its `componentWillUnmount()` if present.
3. Recursively clean up its descendant records.
4. Detach its private updater and mark it unmounted.
5. Remove or replace the host DOM.

This operation is used consistently for type/key replacement, unmatched child
deletion, and root unmounting. Keyed movement does not call unmount or mount
again because it retains the same component record and host DOM object. It may
still produce an update lifecycle because the retained component renders as
part of the root update.

## Re-entrancy and Error Behavior

- `setState()` from a constructor or `render()` remains rejected.
- `setState()` from `componentDidMount()` and `componentDidUpdate()` is queued
  for follow-up root work.
- `setState()` during `componentWillUnmount()` is rejected.
- Root render and lifecycle-flush guards are reset with `finally` blocks.
- Without error boundaries, a thrown lifecycle error propagates to the caller.
- If a did-callback throws, the remaining callbacks in that flush are not
  guaranteed to run. The root remains usable for a later explicit request.
- Stage 3B does not attempt React's commit-phase error capture or recovery.

## JSX Test Authoring

Browser JavaScript cannot parse JSX directly. React's test source is compiled
before it runs, so Stage 3B will make that transformation explicit rather than
adding a runtime JSX compiler.

The readable source will be:

```text
tests/stage-3/lifecycle.test.jsx
```

The committed npm script is named `build:stage3-lifecycle-tests` and runs the
equivalent of:

```bash
esbuild tests/stage-3/lifecycle.test.jsx \
  --bundle \
  --format=esm \
  --jsx=transform \
  --jsx-factory=createElement \
  --sourcemap=inline \
  --outfile=dist/tests/stage-3/lifecycle.test.js
```

This provides:

- JSX transform mode;
- `createElement` as the JSX factory;
- ESM output;
- bundling for the browser test page;
- an inline source map.

It will produce a browser artifact under the repository's already-ignored
generated-output directory:

```text
dist/tests/stage-3/lifecycle.test.js
```

The committed `lifecycle.test.html` page imports that generated module, and
the existing `dist/` rule keeps every generated test bundle out of Git. Editing
the JSX requires rerunning `npm run build:stage3-lifecycle-tests`, but the
existing Python server on port `4250` does not need to restart.

JSX such as:

```jsx
root.render(<LifecycleProbe label="Ready" />);
```

is transformed into a call to this workshop's own `createElement`; it does not
change what `root.render()` receives.

## Test Strategy

Stage 3B is developed in learner-owned red-green steps. Each new failure first
demonstrates one missing lifecycle guarantee before runtime code changes.

Focused browser tests will prove:

1. JSX is transformed through the Mini React `createElement` factory.
2. Mount callbacks see connected DOM and run child before parent.
3. Mount callbacks run exactly once for a retained identity.
4. Update callbacks receive previous props and state while the instance exposes
   current props and state.
5. Update callbacks see the already-mutated DOM and run child before parent.
6. Lifecycle state requests wait until the current callback queue finishes and
   then produce a follow-up render.
7. Unmount callbacks run parent before child and before DOM removal.
8. Replacement, deletion, and `root.unmount()` invoke cleanup exactly once.
9. Keyed movement preserves the instance and does not remount it.
10. Lifecycle errors propagate without leaving root guards permanently active.

All existing Stage 0, Stage 1, Stage 2, and Stage 3A browser pages remain part
of the regression checkpoint. The TaskApp UI and selectors do not change.

## Files

Expected implementation work is limited to:

- `src/stage-3/runtime.js`
- `tests/stage-3/lifecycle.test.jsx`
- `tests/stage-3/lifecycle.test.html`
- `package.json`
- `notes/stage-3-lifecycles.md`

The generated browser test module is ignored and is not committed.

## React Source Map

Source study uses React commit `52912a1453` and the current class lifecycle
documentation.

- `ReactFiberCommitEffects.js` — `commitClassLayoutLifecycles` distinguishes
  mount from update and supplies previous props and state.
- `ReactFiberCommitWork.js` — class layout traversal processes descendants
  before the class callback, producing child-before-parent did ordering.
- `ReactFiberCommitWork.js` — class deletion calls
  `componentWillUnmount()` before recursively deleting descendants.

Stage 3B copies these observable ordering rules, not React's Fiber flags,
alternate trees, commit error recovery, profiling, refs, snapshots, or commit
implementation.

## Completion Criteria

Stage 3B is complete when:

- the JSX lifecycle page shows every focused test passing;
- all earlier browser test pages remain green;
- the generated test artifact is ignored;
- JSX inspection/build commands exit successfully;
- the learner can predict nested mount, update, and unmount order;
- the learner can explain why did-callbacks need post-mutation timing;
- the learner can distinguish the Stage 3B lifecycle queue from Stage 4's full
  Fiber render/commit architecture;
- the source map records only responsibilities actually inspected and
  understood.
