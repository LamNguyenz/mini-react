# Stage 3 Class Lifecycle Moments

## The Missing Problem After Component State

This section describes what was missing before lifecycle support, not a new
feature missing from the current runtime. Component state and reconciliation
already let the runtime preserve instances and update the UI. What was missing
was notifying component code after mounting or updating, and before removal.
Lifecycle methods provide those moments for setup, responding to changes, and
cleanup; `render()` remains responsible for describing the UI.

## Mount, Update, and Unmount Timing

- Mount: `mountRecords()` processes the child, then queues
  `componentDidMount()`. The root invokes it after DOM work finishes.
- Update: `reconcileRecord()` saves previous props/state before updating the
  instance, reconciles its child, then queues
  `componentDidUpdate(prevProps, prevState)`.
- Mount/update callbacks run child before parent.
- Unmount: `detachRecord()` invokes `componentWillUnmount()` before descending
  into child cleanup, and before the caller removes the DOM. Cleanup runs
  parent before child.
- A keyed movement that retains the same component identity preserves its
  instance and state; it does not mount the component again.

## Lifecycle State Update Flow

`setState()` queues an update and calls `requestRender()`. During a lifecycle
callback flush, `isPerformingWork` prevents another `flushRootWork()` from
starting recursively. The request sets `renderRequested`; the outer loop
finishes the current callbacks, then performs follow-up rendering and flushes
the callbacks produced by that work.

The callback queue is taken as a snapshot and cleared before invocation. If a
callback throws, the error propagates and the remaining callbacks in that
snapshot are not replayed during later work. The work guard is reset in
`finally`. This is a limited safeguard, not full error recovery.

## Why This Queue Is Not a Commit Phase

Our reconciler calculates changes and mutates the DOM in the same recursive
pass. The queue defers mount/update callbacks, not DOM mutations. A separate
commit phase would apply changes prepared earlier; separating the phases does
not by itself require asynchronous execution.

A queue can also be used for cleanup, but it would need to run before removal.
Our current implementation calls unmount cleanup directly instead. The key
distinction is callback timing, not whether a queue exists.

## Differences from Production React

This lesson supports three class lifecycle methods with a synchronous recursive
reconciler and a root-owned callback queue. It does not implement Fiber work
units, scheduling/priorities, separate render and commit phases, or production
error boundaries and recovery. It also omits other lifecycle APIs such as
`getSnapshotBeforeUpdate()` and development Strict Mode lifecycle checks.

Centralizing the scattered lifecycle checks is a possible readability refactor
for later. It is separate from adding lifecycle behavior, and would not by
itself introduce a commit phase.

## React Source Map

Reference: React commit `52912a14531dad54d7844c83bc0e35f2c6a74c11`, verified in
`/Users/admin/Desktop/open-sources/react`. These are conceptual mappings;
our callback queue is not React's Fiber commit implementation.

| Responsibility | Our runtime | Pinned React source |
| --- | --- | --- |
| Invoke the mount callback | `mountRecords()` queues `instance.componentDidMount()`; the root flush invokes it after DOM work | [`commitClassLayoutLifecycles`](https://github.com/react/react/blob/52912a14531dad54d7844c83bc0e35f2c6a74c11/packages/react-reconciler/src/ReactFiberCommitEffects.js#L340) invokes did-mount when `current === null` |
| Invoke the update callback with previous values | `reconcileRecord()` captures previous props/state and queues `instance.componentDidUpdate(prevProps, prevState)` | The same function's update branch reads previous values from `current.memoizedProps` and `current.memoizedState` before invoking did-update |
| Run child mount/update callbacks before the parent's | `mountRecords()` mounts the child before queuing the parent's mount callback; `reconcileRecord()` reconciles the child before queuing the parent's update callback | [`commitLayoutEffectOnFiber`](https://github.com/react/react/blob/52912a14531dad54d7844c83bc0e35f2c6a74c11/packages/react-reconciler/src/ReactFiberCommitWork.js#L618) traverses child layout work before invoking the class lifecycle for the current Fiber |
| Run parent unmount cleanup before child cleanup | `detachRecord()` invokes the instance's `componentWillUnmount()` before descending into `record.child` | The class branch of [`commitDeletionEffectsOnFiber`](https://github.com/react/react/blob/52912a14531dad54d7844c83bc0e35f2c6a74c11/packages/react-reconciler/src/ReactFiberCommitWork.js#L1700) calls `safelyCallComponentWillUnmount()` before traversing child deletion work |

Here, `finishedWork.stateNode` holds the class instance. `current` is the
previous committed Fiber, or `null` for a newly mounted identity. Fiber is
React's internal work record; these fields let this function select the
lifecycle and obtain its instance and previous values.

## My Explanation

### Why mount callbacks wait

`mountRecords()` creates the new DOM before the runtime inserts it into the
page. For example, during replacement, `replaceChild()` runs after
`mountRecords()` returns. Calling `componentDidMount()` immediately during
mounting would therefore run the callback before the new DOM is connected.
We queue the callback and invoke it after the DOM work finishes.

### Why child mount callbacks run first

Child callbacks run first so the parent's callback can observe their completed
synchronous initialization. State updates requested by these callbacks are
processed in follow-up work after the current callback flush finishes.

### Why parent cleanup runs first

Parent-first cleanup gives the parent a chance to stop using its children's
resources before the children dispose of them. We call the parent's
`componentWillUnmount()` before descending into `detachRecord(record.child)`.

### Why update callbacks need previous values

We save the previous props and state before updating the retained instance.
If we assigned new props first, `prevProps` would contain the new values: for
example, "After" instead of "Before". The callback would no longer receive
the previous values it needs for comparison or other processing. Capturing
the old references before replacing them preserves those values for
`componentDidUpdate(prevProps, prevState)`.

### Why lifecycle state updates wait

Starting a new render immediately inside a mount callback would interrupt the
current callback flush. The nested render could run update callbacks before
the remaining mount callbacks, even running a parent's `componentDidUpdate()`
before its `componentDidMount()`. We finish the current callbacks first and
then process their queued state updates in follow-up work, preserving the
lifecycle callback order.

### Why keyed movement preserves a mounted instance

Within the same parent, matching a stable key and component type lets us reuse
the component's record and instance. Its state, such as `count: 3`, remains
with that instance when the component moves. We also reuse and move its DOM.
Movement does not create a new component identity, so it does not run
`componentDidMount()` again. A changed key or component type creates a new
instance with its initial state instead.

### Why the lifecycle queue is not a separate commit phase

Our reconciler compares descriptions with records and mutates the DOM in the
same recursive pass. The lifecycle queue does not defer those DOM mutations;
it defers `componentDidMount()` and `componentDidUpdate()` until after the
mutations finish. Unmount cleanup runs before removal. A separate commit
phase would apply previously prepared changes later. The distinction is
where DOM mutations happen, not simply whether the work is synchronous.
