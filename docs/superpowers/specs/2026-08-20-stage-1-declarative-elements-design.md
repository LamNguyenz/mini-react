# Stage 1 Declarative Elements and Recursive Rendering Design

**Date:** 2026-08-20  
**Status:** Draft for learner review  
**Depends on:** Completed Stage 0 checkpoint `stage-0-imperative-dom`

## Goal

Build a small declarative renderer and use it to reproduce the complete Stage 0 task application without distributing DOM synchronization instructions across event handlers.

Stage 1 proves the first React philosophy introduced by this workshop: application code describes what the UI should be for current state, while a renderer translates that description into browser host operations. This stage does not attempt to make updates efficient. Full DOM replacement is intentional evidence for Stage 2 reconciliation.

## Historical Learning Rule

The workshop follows a history-guided problem order:

1. Experience a problem in the smaller runtime.
2. Learn the major mechanism React introduced to address that class of problem.
3. Build a bounded teaching version.
4. Compare it with the pinned production source.
5. Record historical differences and later replacements.

The workshop follows the order of major ideas without reproducing every obsolete public API. Modern names may be used when they create a clearer stable teaching boundary. Deviations from exact release chronology must be stated explicitly.

For Stage 1:

- `createRoot` is used as a clear root-ownership boundary even though it is a modern public API name.
- Element objects are handwritten before `createElement` is introduced, even though JSX was present early in React's public story.
- Hooks, Fiber, scheduling, lanes, effects, and reconciliation are excluded until their motivating problems have been observed.

## Preserving Stage 0

Stage 0 remains unchanged and runnable. Stage 1 is added beside it so the imperative and declarative applications can be compared directly.

```text
src/
  stage-0/
    app.js
    styles.css
  stage-1/
    runtime.js
    app.js

tests/
  browser/
    harness.js
  stage-0/
    task-app.test.html
    task-app.test.js
  stage-1/
    runtime.test.html
    runtime.test.js
    task-app.test.html
    task-app.test.js

notes/
  stage-0-imperative-dom.md
  stage-1-declarative-rendering.md

index.html
stage-1.html
```

`index.html` continues to show Stage 0. `stage-1.html` hosts the declarative application. The browser assertion harness remains shared infrastructure, but Stage 1 imports no Stage 0 application code.

`stage-1.html` links the unchanged Stage 0 stylesheet so both applications have the same presentation during comparison. Sharing presentation rules is allowed; runtime and application behavior remain isolated.

## Application Parity

The Stage 1 application reproduces the Stage 0 behavior and observable DOM contract:

- Add a non-blank task.
- Reject blank task titles with a visible error.
- Toggle task completion.
- Filter All, Active, and Completed tasks.
- Keep the derived `C of T completed` summary synchronized.
- Preserve the established `data-task-*`, `data-filter`, `data-completed`, `hidden`, and `aria-pressed` behavior.
- Provide a visible submit control.
- Unmount without affecting another root.

Stage 0 tests remain green. Stage 1 receives separate behavior tests so shared selectors do not hide coupling between implementations.

## State and Update Flow

Hooks do not exist in Stage 1. Each mounted Stage 1 task app owns ordinary closure state:

```text
tasks
activeFilter
nextTaskId
```

An interaction follows this path:

```text
browser event
  -> update closure state
  -> create the next TaskApp element description
  -> root.render(nextElement)
  -> recursively create a fresh DOM tree
  -> replace the previous root contents
```

Event handlers update state and request another render. They do not directly update task rows, summary text, visibility, completion attributes, or selected-filter attributes.

## Element Data Model

An element is a plain immutable-by-convention description:

```js
{
  type,
  props: {
    ...properties,
    children,
  },
}
```

Supported `type` values:

- A string such as `"div"` or `"button"` describes a browser host element.
- A function such as `TaskRow` describes a function component.

Supported children:

- Strings remain text values and numbers normalize to strings.
- Nested arrays are flattened.
- `null`, `undefined`, and booleans render nothing.
- Element objects render recursively.
- Unsupported objects and unsupported element types throw focused diagnostics.

Keys, refs, fragments, portals, and special React symbols are excluded. Keys enter with reconciliation in Stage 2.

## Runtime Boundary

The teaching runtime exposes:

```js
createElement(type, props, ...children)
createRoot(container) // -> { render(element), unmount() }
```

Learning begins with handwritten element objects. `createElement` is introduced only after the learner can explain the object shape it returns.

`createElement` treats `null` or omitted props as an empty object, copies supported props, normalizes all child arguments into one flat array, and stores that array as `props.children`. Handwritten objects use the same normalized shape after the normalization lesson.

`createRoot(container)` validates an `HTMLElement` container and owns only that container. `render(element)` recursively creates a fresh DOM subtree and replaces the previous root contents. `unmount()` empties the root container and permanently marks that root inactive. Repeated `unmount()` calls are harmless; `render()` after unmounting throws a focused error.

No old tree is retained for comparison. No DOM node is reused across renders.

## Recursive Renderer

The renderer handles one description at a time:

```text
empty child
  -> no DOM node

text child
  -> document.createTextNode

string element type
  -> document.createElement
  -> apply supported props
  -> recursively render children
  -> append child DOM nodes

function element type
  -> call the component with props
  -> recursively render its returned description
```

The first implementation is synchronous and recursive. It performs browser mutations while walking the tree. Render/commit separation is deliberately absent.

## Supported Props and Events

Stage 1 implements only the surface needed by the task application:

- Direct DOM properties: `value`, `checked`, `hidden`, `type`, and `id`.
- Name mappings: `className` to `class` and `htmlFor` to `for`.
- Attributes beginning with `data-` or `aria-`.
- Event props `onClick`, `onSubmit`, and `onChange`, registered with browser listeners.
- `children` is consumed by recursive rendering and never assigned as an attribute.

Unsupported props produce a focused diagnostic instead of silently pretending to support the full React DOM surface. Style objects, refs, `dangerouslySetInnerHTML`, capture events, event delegation, and generic property diffing are excluded.

Detached DOM subtrees and their listeners become collectible after full replacement. Stage 1 does not build an event registry or delegated event system.

## Function Components

A function component receives one props object and returns a supported description:

```js
function TaskRow(props) {
  return createElement(/* ... */);
}
```

The runtime, not application code, invokes component functions during recursive rendering. Components do not own persistent runtime state in this stage. Application closure state is passed down through props.

## JSX Boundary

JSX is excluded until handwritten objects and `createElement` calls are understood. After that gate:

1. Add `esbuild` as a development-only transform.
2. Transform a small JSX example.
3. Inspect the generated element-creation calls.
4. Confirm the runtime has no JSX dependency.

The initial Stage 1 application may remain in explicit `createElement` calls until the learner approves a JSX conversion exercise.

## Deliberate Failure Evidence

Full replacement must produce an observable identity failure:

1. Focus a task input or retain a reference to an existing DOM node.
2. Trigger a state change and `root.render`.
3. Observe that the prior node is disconnected and focus or selection is lost.
4. Record that the visible content can be correct while host identity is unnecessarily destroyed.

This is not fixed during Stage 1. It is the entry problem for Stage 2 reconciliation.

## Test Strategy

Tests remain dependency-free browser modules using the shared assertion harness.

Runtime tests cover:

- Rendering a handwritten host element object.
- Nested recursive rendering.
- Text and child normalization.
- `createElement` output shape.
- Supported prop and event application.
- Function component invocation and props.
- Root isolation, replacement, and unmounting.
- Focused errors for invalid containers, element types, children, and props.

Task application tests repeat the complete Stage 0 observable contract against Stage 1. An explicit identity test proves that a second render replaces the prior DOM node.

Every mechanism follows the learner-driven red-green loop: the guide adds or presents the smallest failing behavior, the learner predicts the failure, and the learner writes runtime or application code by hand.

## Lesson Sequence

1. Render one handwritten element object.
2. Recursively render nested host elements.
3. Normalize text, arrays, and empty children.
4. Introduce `createElement` and inspect its output.
5. Apply the required DOM props and browser events.
6. Invoke function components with props and children.
7. Rebuild the task application declaratively with closure state.
8. Reproduce the DOM identity and focus-loss failure.
9. Inspect JSX transformation after the element-object gate.
10. Compare the smaller mechanism with pinned React source and complete the Stage 1 checkpoint.

## React Source Comparison

Production comparison remains pinned to React commit `52912a1453` and happens after the smaller mechanism exists.

Primary landmarks:

- `packages/react/src/jsx/ReactJSXElement.js`
- `packages/react/index.js`
- `packages/react-dom/src/client/ReactDOMRoot.js`
- The public `react-dom/client` entry point

The Stage 1 note records:

- The public call that begins rendering.
- The element data React receives.
- The boundary between element descriptions, component invocations, Fiber internals, and DOM host nodes.
- Complexity intentionally omitted from the workshop renderer.
- Historical deviations such as the modern `createRoot` name and delayed JSX exercise.

Stage 1 source reading does not explain child reconciliation, Fiber work loops, scheduling, hooks, or commit effects.

## Exclusions

Stage 1 does not implement:

- Old/new tree comparison or keyed identity.
- DOM reuse, prop diffing, placement, movement, or deletion planning.
- Fiber nodes or interruptible work.
- Component state APIs, class lifecycles, Hooks, refs, or effects.
- Scheduling, batching, priorities, lanes, transitions, or Suspense.
- Separate render and commit phases.
- Server rendering or hydration.
- A production-complete DOM property or event system.

## Exit Criteria

Stage 1 is complete only when the learner can explain, in their own words:

1. Why a declarative state-to-UI description removes manual DOM dependency updates from event handlers.
2. The difference between an element description, a function component invocation, and a DOM node.
3. Why `createElement` does not create a DOM element.
4. How recursive rendering translates descriptions into browser host operations.
5. Why full replacement can produce correct content while losing DOM identity, focus, and selection.
6. Why reconciliation is the next mechanism rather than part of Stage 1.

The stage ends with all Stage 0 and Stage 1 tests passing, both visible applications runnable, a completed source-map note, focused commits, and an annotated Stage 1 tag.
