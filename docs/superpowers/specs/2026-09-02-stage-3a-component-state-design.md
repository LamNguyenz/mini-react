# Stage 3A Component Identity and State Design

**Date:** 2026-09-02
**Status:** Approved
**Depends on:** Completed Stage 2 reconciliation checkpoint

## Goal

Add the smallest pre-Hooks component-state mechanism that explains how state can
belong to one persistent component identity across renders.

Stage 2 retains host and text records, but it expands function components away.
That means a function call can calculate host output, but the runtime retains no
component boundary where props, state, or pending updates can live. Stage 3A adds
that missing boundary with class-style component instances, a synchronous
`setState` API, and retained component records.

The result is still a synchronous teaching runtime. It is not Fiber and does not
separate render work from DOM mutation.

## Historical Learning Rule

The workshop continues to introduce mechanisms in the order needed to explain
why they exist. Component instances and state come before Hooks, and their state
updates remain synchronous before scheduling and batching are introduced.

The workshop copies the important mechanism rather than every historical or
modern React surface detail:

- A persistent component instance owns `props` and `state`.
- `setState` enqueues an update rather than directly editing DOM.
- Rendering calculates the next child description from current props and state.
- Reconciliation preserves or replaces the instance according to type, key, and
  sibling position.

The public syntax uses an ES class-style `Component` API because it exposes the
instance mechanism clearly. Obsolete `createClass` syntax is not reproduced.

## Stage Boundary

Stage 3 is split into two checkpoints:

- **Stage 3A:** component identity, initial state, queued state updates, and a
  synchronous `setState`-style API.
- **Stage 3B:** deliberately small mount, update, and unmount lifecycle moments.

This specification covers Stage 3A only. Lifecycle methods are designed after
the learner can trace state through a persistent component record.

## Preserving Earlier Stages

Stages 0, 1, and 2 remain unchanged and runnable. Stage 3A is added beside them:

```text
src/
  stage-0/
  stage-1/
  stage-2/
  stage-3/
    runtime.js
    app.js

tests/
  stage-0/
  stage-1/
  stage-2/
  stage-3/
    runtime.test.html
    runtime.test.js
    task-app.test.html
    task-app.test.js

notes/
  stage-0-imperative-dom.md
  stage-1-declarative-rendering.md
  stage-2-reconciliation.md
  stage-3-component-state.md

stage-3.html
```

Stage 3 may reuse the shared browser test harness and Stage 0 stylesheet. It
does not import runtime or application behavior from an earlier stage.

## Public Runtime Boundary

Stage 3 keeps the existing element and root APIs and adds `Component`:

```js
createElement(type, props, ...children)
createRoot(container) // -> { render(element), unmount() }

class Component {
  constructor(props)
  setState(update)
}
```

Application code defines a class component by extending `Component`, assigning
initial state, and implementing `render()`:

```js
class Counter extends Component {
  constructor(props) {
    super(props);
    this.state = { count: 0 };
  }

  render() {
    return createElement(
      "button",
      {
        onClick: () => {
          this.setState((state) => ({ count: state.count + 1 }));
        },
      },
      this.state.count,
    );
  }
}
```

`Component` does not know about DOM nodes or reconciliation. The runtime
attaches a private update requester to a mounted instance. `setState` stores the
update and asks the owning root to render synchronously.

Stateless function components keep their Stage 2 behavior. They are expanded
into host/text descriptions and do not gain state in Stage 3A. Hooks remain
deferred.

## Component Classification

A description whose `type` is a function follows one of two paths:

- If `type.prototype instanceof Component`, the runtime treats it as a
  persistent class component.
- Otherwise, the runtime treats it as a stateless function component and
  expands it as Stage 2 did.

This explicit rule prevents the runtime from invoking a class constructor as a
plain function and keeps the two teaching models distinguishable.

## Retained Component Record

Descriptions remain disposable input values. A mounted class component adds a
persistent record:

```js
{
  kind: "component",
  type,
  key,
  props,
  instance,
  pendingUpdates,
  child,
}
```

The fields have separate responsibilities:

- `type` and `key` participate in identity matching.
- `props` retain the last rendered props.
- `instance` owns the public `this.props` and `this.state` values.
- `pendingUpdates` stores object or functional state updates until rendering.
- `child` is the single retained record produced by `instance.render()`.

The component record does not own a DOM node. Its rendered child eventually
leads to a host or text record. A small runtime helper follows nested component
records to find that host node when the parent must insert, move, replace, or
remove the component's visible output.

This record is still not a Fiber. It has no parent/child/sibling work links,
alternate, priority, effect flags, or resumable work state.

## Temporary Output Restriction

For Stage 3A, a class component's `render()` method must produce exactly one
non-empty root description. That root may be:

- one host element description,
- one text value, or
- one nested component description.

Arrays, fragments, portals, and empty output such as `null` are not supported
for persistent class components in this checkpoint. Modern React supports those
values, but doing so here would require one component record to represent zero
or multiple host nodes through placeholders or DOM ranges. That is a separate
mechanism and is not necessary to understand component-owned state.

The runtime throws a focused `TypeError` when a class component violates this
temporary contract. The Stage 3 note must state this difference from modern
React explicitly.

## Mounting a Class Component

On first mount, the runtime:

1. Creates the instance with `new ComponentType(props)`.
2. Verifies that `instance.state` is a non-null, non-array object; the base class
   supplies an empty object when the subclass does not assign initial state.
3. Creates the component record and attaches its private update requester.
4. Calls `instance.render()` with `this.props` and `this.state` already set.
5. Mounts the returned description as the record's single child.
6. Retains the instance and child for future renders.

Constructors and `render()` stay pure with respect to host mutations. DOM nodes
are still created by the host/text mounting paths, not by component code.

## State Update Model

`setState(update)` accepts either:

- a non-null, non-array object that is shallowly merged into the current pending
  state, or
- a pure updater function called with `(pendingState, props)` whose returned
  non-null, non-array object is shallowly merged.

Invalid update values or updater results throw a focused `TypeError`.

Calling `setState` follows this path:

```text
component event handler
  -> instance.setState(update)
  -> append update to the owning component record
  -> ask the owning root to render synchronously
  -> revisit the retained component record
  -> reduce pending updates in insertion order
  -> assign the resulting state to the instance
  -> call instance.render()
  -> reconcile the previous child with the next child description
  -> retain the updated component record
```

The queue matters even before scheduling exists: it makes state transition data
explicit and gives functional updaters the latest pending result. It prepares
the conceptual boundary needed for later batching without implementing batching
early.

Stage 3A deliberately flushes each external `setState` call immediately. As a
result, this teaching runtime has updated `this.state` by the time `setState`
returns. Production React treats `setState` as a request and may batch it, so
application code must not depend on this Stage 3A timing difference.

The callback form `setState(update, callback)` is not supported.

## Reusing and Replacing Component Identity

A next class-component description reuses an old component record only when its
component type and key match under the existing sibling reconciliation rules.

When the identity matches, the runtime:

1. Reuses the existing instance and state.
2. Replaces `instance.props` with the next props.
3. Applies any pending state updates in order.
4. Calls `instance.render()` again.
5. Reconciles the previous child record with the returned description.
6. Retains the same component record and instance.

When the type or key does not match, the runtime detaches private update
requesters throughout the removed record subtree, discards the old component
record, and mounts a fresh instance with fresh initial state. Stage 3B will add
explicit lifecycle callbacks before this discard.

Keyed component records participate directly in sibling lookup. Their keys no
longer need to be transferred to a resolved host root. Moving a keyed component
moves the host output reached through its child while retaining the component
instance, state, and child record.

## Root Ownership and Re-entrancy

Each mounted component's private updater routes to its owning root. The root
retains the last submitted root description so it can synchronously reconcile
that description again after a state request.

The root guards against a state update during an active render. Calling
`setState` from a constructor or `render()` throws a focused error in Stage 3A
instead of entering an accidental recursive render loop. Event handlers remain
the intended update source for this checkpoint.

Whenever a component is deleted, replaced, or removed by `root.unmount()`, its
instance and any descendant component instances lose their private update
requesters. Calling `setState` on one of those unmounted instances throws a
focused error. This makes stale instance usage deterministic until Stage 3B
introduces lifecycle callbacks.

## Task Application Migration

The Stage 3 task application preserves every existing selector and behavior,
but replaces the application-state closure with a persistent `TaskApp` instance:

```js
this.state = {
  tasks: [],
  activeFilter: "all",
  nextTaskId: 1,
  errorMessage: "",
};
```

Task addition, completion toggling, and filter changes use functional state
updates when they depend on previous state. `render()` derives the visible rows,
selected filter state, and completion summary from `this.state`.

`mountTaskApp(container)` creates one root, renders
`createElement(TaskApp, null)`, and returns an `unmount()` method that delegates
to `root.unmount()`.

The text input remains uncontrolled so browser-owned draft state continues to
demonstrate host identity preservation. A successful submission clears that
input explicitly, as in Stage 2.

## Error Handling

Stage 3A produces focused errors for:

- constructing a class component whose initial state is not an object,
- calling `setState` with neither an object nor a function,
- an updater function returning a non-object value,
- a class component returning zero or multiple root descriptions,
- calling `setState` during construction or rendering,
- calling `setState` after its component has unmounted, and
- calling `render` on an already unmounted root.

Duplicate sibling keys remain unsupported input rather than a new diagnostic
project. Stage 3A does not broaden Stage 2's duplicate-key behavior.

## Test Strategy

Runtime tests are added one behavior at a time and serve as the learner's
red-green checkpoints. They prove:

1. A class component renders from its initial state.
2. Object-form `setState` shallowly merges state and updates visible output.
3. Functional `setState` receives the latest state and current props.
4. A state update preserves the component instance and same-type host DOM node.
5. New props reach a retained component instance without resetting its state.
6. Two instances of the same component keep independent state.
7. Keyed component instances retain their state and host identity when reordered.
8. A changed component type or key creates a fresh instance and initial state.
9. Nested component records resolve to the correct host node for movement and
   replacement.
10. Invalid updates, invalid output, render-phase updates, and post-unmount
    updates produce the specified errors.

Task-app tests preserve the Stage 2 behavioral contract:

- empty rendering,
- task creation and validation,
- completion updates,
- filter behavior,
- host identity and browser-owned input state,
- independent mounted applications, and
- destroy behavior.

The final checkpoint reruns every Stage 0, Stage 1, Stage 2, and Stage 3 suite.
Browser modules continue to be served by one HTTP process on port `4250`; source
edits do not require restarting that process.

## Teaching Sequence

Each implementation task begins with one concrete problem, a focused failing
browser test, and a prediction from the learner. The learner writes the runtime
change by hand, then the result is reviewed and verified before moving forward.

The intended sequence is:

1. Reproduce why render-time function calls cannot retain component state.
2. Add `Component` and mount the first persistent component record.
3. Reconcile the same component identity and preserve its instance.
4. Add object-form state updates and synchronous root update requests.
5. Add the ordered queue and functional state updaters.
6. Preserve state across prop changes and keyed component movement.
7. Migrate the task application's closure state into `TaskApp`.
8. Record the mechanism and compare it with pinned React source.

The plan may split a sequence item into smaller red-green tasks, but it must not
combine several new mechanisms into one learner exercise.

## React Source Study

Production source is inspected only after the smaller mechanism exists. The
source checkout remains pinned to commit `52912a1453`.

The Stage 3A note maps the workshop mechanism to:

- `packages/react/src/ReactBaseClasses.js` for the public class and `setState`
  boundary,
- `packages/react-reconciler/src/ReactFiberClassComponent.js` for instance
  construction, props/state adoption, and class rendering,
- `packages/react-reconciler/src/ReactFiberClassUpdateQueue.js` for queued state
  transitions.

Any production mechanism not built in Stage 3A is explained before it is named
as a comparison. Function names alone are not treated as learner understanding.

## Explicit Exclusions

Stage 3A does not implement:

- lifecycle methods, lifecycle ordering, or lifecycle error handling,
- function-component state or Hooks,
- refs, context, effects, portals, fragments, or empty component output,
- multiple host roots from one persistent component,
- Fiber parent/child/sibling work units or current/work-in-progress alternates,
- separate render and commit phases or effect flags,
- batching, scheduling, priorities, lanes, interruption, or restart behavior,
- error boundaries, Suspense, hydration, or server rendering.

## Completion Criteria

Stage 3A is complete when:

1. Class components retain independent state through persistent component
   identity.
2. Object and functional state updates flow through an explicit queue and cause
   synchronous declarative rerenders.
3. Props and keyed movement preserve the correct instance, state, and host DOM.
4. Type or key replacement creates fresh component state.
5. The Stage 3 task app matches the established task-app behavior while storing
   application state on `TaskApp` rather than in `mountTaskApp`'s closure.
6. Earlier stage suites remain unchanged and green.
7. The learner can explain why a component record is needed, why `setState` is
   an update request, and why this recursive record tree is still not Fiber.
