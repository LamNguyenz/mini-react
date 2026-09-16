# Stage 3 Component Identity and State

## The Problem

Before Stage 3, application state lived in a closure. Every event handler had
to mutate that state and manually call `root.render()`. The runtime could reuse
DOM nodes, but it could not retain and manage state for each component
identity. Stage 3 gives that state a persistent component instance and lets
`setState()` request rendering automatically.

## Description, Record, Instance, and DOM Node

- An element description is a disposable `{ type, key, props }` object returned
  by `createElement()`. It describes what should exist and contains no DOM node.
- A component record is the runtime's retained representation of one component
  identity. It stores the type, key, props, instance, pending updates, and child
  record. It reaches a DOM node through its child rather than storing one
  directly.
- A component instance is the class object that owns `props`, `state`,
  `setState()`, `render()`, and any user-defined instance fields or methods.
- A DOM node is the real browser object. It can contain browser-owned state such
  as focus, selection, and an uncontrolled input value.

## State Update Flow

`setState()` submits update data instead of changing the DOM. The update is
added to the component record's pending queue and `requestRender()` starts a
synchronous render. `performRender()` calculates the next descriptions and the
reconciler compares them with retained records. Matching nodes are reused and
only the required DOM properties, text, positions, or nodes are changed.

Functional updaters are reduced in order. Each updater receives the state
produced by the updater before it, because `instance.state` is committed only
after the queue has been processed. It also receives the props for the render
currently being calculated.

## Identity Rules

The same component type and key at the same sibling identity reuse the retained
record and instance, so state is preserved. A different type or key represents
a different identity: the old record is detached and a fresh instance starts
with its initial state.

A stable key can move a component to another sibling position while retaining
its record and instance. `parent.insertBefore()` moves the existing DOM object
instead of cloning it, so browser-owned state moves with that object as well.
Keys need to be unique only among the siblings reconciled by the same parent.

## Why This Is Still Not Fiber

Our runtime has no mechanism for pausing and resuming work. It synchronously and
recursively compares descriptions with retained records, so reconciliation
progress exists only on the JavaScript call stack. It also calculates changes
and mutates the DOM in the same recursive pass.

Fiber stores unfinished work as explicit work units. That allows React to keep
track of the next work unit, resume later, and separate preparing changes from
committing them. Our retained records preserve identity, but they are not yet
resumable work units.

## Differences from Production React

- Stage 3A renders synchronously for every external `setState()` call; it does
  not batch updates or schedule them by priority.
- A class component must return exactly one non-empty root, while production
  React accepts broader output such as `null` and arrays.
- Stage 3A omits lifecycle methods, Hooks, refs, effects, context, scheduling,
  priorities, and error recovery.
- Stage 3A calculates changes and mutates the DOM in one pass instead of using
  separate render and commit phases.

## React Source Map

The source observations below use React commit `52912a1453`.

| React source boundary | Observed responsibility | Stage 3A relationship |
| --- | --- | --- |
| `packages/react/src/ReactBaseClasses.js` | `Component.prototype.setState()` validates the request and delegates it to `this.updater.enqueueSetState(...)`. It does not calculate state or render by itself. | Our `Component.setState()` delegates to the runtime-injected `instance.__enqueueStateUpdate`. |
| `packages/react-reconciler/src/ReactFiberClassComponent.js` | `constructClassInstance()` creates and connects the instance to its Fiber. `mountClassInstance()` prepares its initial props, state, context, refs, and queue. `updateClassInstance()` reuses the instance, processes updates, and decides whether it should render. | Our component branch creates one instance and record; later reconciliation reuses that instance, updates its props, and processes its pending state. |
| `packages/react-reconciler/src/ReactFiberClassUpdateQueue.js` | `initializeUpdateQueue()` creates the queue, `enqueueUpdate()` stores prioritized updates, and `processUpdateQueue()` reduces eligible updates in order through `getStateFromUpdate()`. Lower-priority updates can be retained and rebased later. | Our `pendingUpdates` array and `processPendingState()` reduce every update immediately in order, without lanes, skipping, or rebasing. |
| `packages/react-reconciler/src/ReactFiberBeginWork.js` | `finishClassComponent()` can bail out, calls `instance.render()`, and passes the returned children to `reconcileChildren()`. This prepares Fiber work; it does not directly commit DOM mutations. | Our runtime calls `instance.render()` and reconciles its child too, but that recursive pass may mutate the DOM immediately. |

The public `setState()` boundary delegates to an injected updater so the
renderer controls how updates are queued and scheduled. This also keeps the
public component class independent of a particular host renderer such as the
DOM. Merely putting updates in a queue does not guarantee batching; Stage 3A's
injected updater still requests synchronous work immediately.

## My Explanation

1. A function-local variable is created again whenever the function component
   is called, so it cannot be the persistent owner of state across renders. We
   need a retained record or instance outside that call.
2. A description says what should exist. A record is the runtime's retained
   identity. An instance owns class state and behavior. A DOM node is the real
   browser object.
3. `setState()` submits update data so the runtime can control the update flow.
   The runtime processes state, calls `render()`, reconciles the result, and
   applies the necessary DOM changes instead of making event handlers edit DOM
   nodes manually.
4. A functional updater receives pending state because every updater must see
   the result of the updater before it, even before that final state is assigned
   to `instance.state`. It receives the props for the render whose next state is
   being calculated.
5. The same type and key reuse the old record and instance, preserving state. A
   changed type or key creates a different identity and therefore a fresh
   instance with initial state.
6. A keyed component can move while keeping state because reconciliation finds
   and reuses its old record and instance. Moving the same DOM object with
   `insertBefore()` also preserves browser-owned state.
7. Our retained-record tree is not Fiber because recursive work cannot pause or
   resume, and calculating changes and mutating the DOM happen in the same pass.
   Fiber keeps explicit unfinished work and separates preparation from commit.
8. Stage 3A intentionally keeps synchronous state updates, a one-root output
   restriction, a combined reconciliation/DOM pass, and none of React's
   lifecycle, Hook, effect, context, priority, scheduling, or recovery systems.
