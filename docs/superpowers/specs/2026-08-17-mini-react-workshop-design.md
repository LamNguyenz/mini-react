# Mini React Problem-Driven Workshop Design

Date: 2026-08-17
Status: Approved curriculum and architecture
Learning project: `/Users/admin/Desktop/mini-react`
Reference source: `/Users/admin/Desktop/open-sources/react`
Reference React commit: `52912a1453`

## Purpose

This project is a hands-on workshop for understanding how React works by rebuilding its core ideas in plain JavaScript. The learner already knows advanced JavaScript and has experience building React applications. The workshop therefore focuses on runtime behavior and architectural reasoning rather than React API syntax.

The central teaching rule is: encounter the problem before studying React's solution.

For every mechanism, the learner will first build or use a simpler system, reproduce a concrete limitation, design a possible solution, implement it by hand, and then compare it with the corresponding production React source.

## Outcomes

By the end of the workshop, the learner should be able to:

1. Build a small React-like runtime from first principles.
2. Explain why declarative elements, reconciliation, Fiber, scheduling, hooks, and commit phases exist.
3. Trace an update from `createRoot().render()` or a state dispatch through scheduling, rendering, and DOM mutation.
4. Read important React source modules without treating their abstractions as unexplained machinery.
5. Explain the tradeoffs and edge cases that make production React more sophisticated than the workshop runtime.
6. Reason at a contribution-ready technical depth without requiring an actual contribution to React.

## Non-Goals

The workshop will not:

- Produce a production-compatible React replacement.
- Match every React API or edge case.
- Cover React Native, Server Components, or the React Compiler in the core path.
- Optimize for quickly shipping an application.
- Require the learner to contribute changes to the React repository.
- Copy large sections of React source into the learning project.

## Teaching Contract

The learner writes the runtime code by hand. The guide introduces one small objective at a time, reviews the learner's implementation, asks reasoning questions, and helps diagnose failures. The guide does not silently replace the learner's code with a completed solution.

Each lesson follows this loop:

1. Introduce a concrete UI requirement.
2. Predict how the current implementation will behave.
3. Reproduce and inspect its limitation.
4. Describe the invariant the next mechanism must preserve.
5. Give the learner one bounded coding objective.
6. Review the learner's implementation and reasoning.
7. Test normal behavior and edge cases.
8. Trace the corresponding path in production React.
9. Record why React's implementation needs additional complexity.
10. Create a Git checkpoint before starting the next mechanism.

Lessons advance only after the learner can explain the current mechanism and its motivation in their own words.

## Repository Structure

The repository evolves incrementally. Files for future mechanisms are not created before their stage begins.

```text
mini-react/
|-- src/          # The evolving React-like runtime
|-- examples/     # Browser programs that expose behavior and limitations
|-- tests/        # Focused behavioral and algorithmic tests
|-- notes/        # Problem statements, invariants, and React source maps
|-- docs/         # Workshop design and implementation plans
`-- index.html    # Minimal browser entry point
```

The expected final runtime boundaries are:

- Element creation and normalization
- Root and update queues
- Fiber nodes and the work loop
- Child reconciliation
- Scheduling and priorities
- Hooks and component update queues
- Commit phases and effects
- Browser host operations

These boundaries are introduced only when a demonstrated problem requires them.

## Runtime Data Flow

The runtime grows toward this update path:

```text
Application description
  -> element objects and components
  -> root update queue
  -> scheduled units of work
  -> Fiber reconciliation
  -> completed effect information
  -> atomic commit
  -> browser DOM operations
```

A browser event or state dispatch feeds back into the root update queue and starts another scheduled render. Rendering prepares a possible next tree without mutating the visible application. Committing applies completed work to the browser and runs the appropriate effect lifecycles.

This separation is a core invariant once interruptible rendering is introduced: abandoned render work must not leak visible mutations.

## Tooling

- Runtime code uses plain JavaScript and browser ES modules.
- Stage 0 uses browser APIs directly and has no runtime or build dependency.
- JSX is intentionally excluded until element objects and `createElement` are understood.
- Stage 1 introduces `esbuild` as a development-only JSX transform after handwritten element objects are understood. The runtime itself never depends on JSX.
- Browser integration behavior is checked with small visible examples and a minimal in-browser assertion harness.
- Pure algorithms and data structures use Node's built-in `node:test` runner beginning in Stage 2.
- Production React comparisons are pinned to commit `52912a1453` so source references remain stable during the workshop.

## Curriculum

### Stage 0: Imperative Browser UI

Problem: state, event handlers, and manual DOM mutations become difficult to keep synchronized.

Build: a small task interface using only HTML and browser DOM APIs. It includes item creation, completion toggling, filtering, and a derived summary so one state change affects several parts of the DOM.

Evidence of the problem: update logic becomes distributed, repeated, order-dependent, and easy to leave inconsistent.

React connection: identify the browser host operations that React DOM must eventually perform, including creating, inserting, updating, and removing nodes.

Exit criterion: the learner can explain the difference between imperative mutation and a declarative description of UI state.

### Stage 1: Declarative Elements and Recursive Rendering

Problem: imperative updates describe how to change the DOM but do not provide one description of what the UI should be for the current state.

Build: element objects, `createElement`, text normalization, function components, props, children, `createRoot`, and a recursive DOM renderer. Inspect JSX output only after handwritten element objects are understood.

Evidence of the problem: replacing the entire rendered tree loses DOM identity, focus, and selection while performing unnecessary work.

React source landmarks: `packages/react/src/jsx/ReactJSXElement.js`, `packages/react/index.js`, and the public `react-dom/client` entry point.

Exit criterion: the learner can explain the difference between a React element, a component invocation, and a DOM node.

### Stage 2: Reconciliation and Identity

Problem: full replacement destroys identity and repeats DOM work.

Build: old/new tree comparison, node reuse, prop updates, placement, deletion, text updates, and keyed child reconciliation.

Evidence of the problem: unkeyed or incorrectly keyed lists reuse the wrong identity, while naive list diffing performs unnecessary operations.

React source landmark: `packages/react-reconciler/src/ReactChildFiber.js`.

Exit criterion: the learner can predict reuse, insertion, movement, and deletion from type and key identity.

### Stage 3: Pre-Hooks Component State and Lifecycles

Problem: application closure state does not compose into independently reusable component instances, while component state and lifecycle behavior must persist across renders.

Build: reconciled component-instance records, initial state, queued state updates, a synchronous `setState`-style API, and deliberately small mount, update, and unmount lifecycle moments. Historical APIs are studied, but obsolete surface syntax is not copied unless it reveals a mechanism.

Evidence of the problem: state stored only in render-time function calls disappears, while state stored only in application closures cannot follow multiple component identities safely.

React source landmarks: `ReactBaseClasses.js`, `ReactFiberClassComponent.js`, and `ReactFiberClassUpdateQueue.js`.

Exit criterion: the learner can explain how pre-Hooks React associated state and lifecycle work with a persistent component identity.

### Stage 4: Fiber, Work Units, and Commit Separation

Problem: recursive rendering is one synchronous call stack, and browser mutations performed during that traversal cannot be safely abandoned or resumed.

Build: Fiber nodes, parent/child/sibling links, units of work, `beginWork`, `completeWork`, current/work-in-progress trees, effect flags, and a separate mutation commit walk.

Evidence of the problem: a sufficiently large render delays browser work, while an abandoned render must not leak partial DOM mutations.

React source landmarks: `ReactFiberWorkLoop.js`, `ReactFiberBeginWork.js`, `ReactFiberCompleteWork.js`, `commitRoot`, and `ReactFiberCommitWork.js`.

Exit criterion: the learner can trace traversal and commit order and explain why Fiber is a persistent data structure, a unit of work, and a boundary that makes deferred mutation possible.

### Stage 5: Hooks and Effect APIs

Problem: function component calls are temporary, but state, refs, and effects must persist without class instances and must retain stable positional identity.

Build: hook storage on Fiber, `useState`, update queues, `useReducer`, refs, effect lists, cleanup, and hook-order validation. Effects reuse the render/commit separation established in Stage 4.

Evidence of the problem: conditional hook calls break positional identity; stale closures and queued updates reveal why dispatch is not direct assignment; cleanup ordering reveals why effects cannot run during render.

React source landmark: `packages/react-reconciler/src/ReactFiberHooks.js`.

Exit criterion: the learner can trace a state dispatch through its queue, explain hook ordering, and predict basic effect setup and cleanup timing without relying on slogans.

### Stage 6: Concurrent Scheduling, Priorities, and Lanes

Problem: updates differ in urgency, long work blocks input, and interrupted work may become stale.

Build: cooperative scheduling, root scheduling, batching, priority classes, interruption, restart behavior, transitions, and a deliberately small lane model.

Evidence of the problem: urgent input should not wait behind background rendering, and newer updates must not be lost when work pauses or restarts.

React source landmarks: `scheduleUpdateOnFiber`, the `scheduler` package, React lane modules, and transition update paths.

Exit criterion: the learner can explain when work is queued, selected, interrupted, resumed, restarted, and committed, and why lanes extend the earlier Fiber architecture.

### Stage 7: Selected Production Mechanisms

Problem: production applications need events, context, async boundaries, hydration, and failure recovery to cooperate with the same core engine.

Build: a delegated event system, context propagation, a Suspense-like thrown-value experiment, transition-style priority, a simple error boundary, and a limited hydration experiment.

React source landmarks: the React DOM event system, context propagation, Suspense handling, transition lanes, error capture, and hydration paths.

Exit criterion: the learner can independently enter an advanced React source path, identify its Fiber and scheduling interactions, and produce a reliable end-to-end trace.

## Testing Strategy

Tests are executable explanations, not a substitute for reasoning.

For each mechanism:

- Begin with a behavior that the current runtime cannot satisfy.
- Record the expected failure before implementing the mechanism.
- Add the smallest success case first.
- Add edge cases only when they reveal an invariant or design tradeoff.
- Keep browser-visible examples for focus, selection, event ordering, yielding, and effect timing.
- Keep deterministic unit tests for element normalization, tree identity, traversal order, queues, priorities, and hook ordering.
- Compare observable behavior with React when the public semantics should match.

The workshop does not chase full React compatibility or test implementation details that have no learning value.

## Error Strategy

- Early stages throw synchronous errors with explicit context instead of hiding failures.
- Expected lesson failures are labeled and isolated from unrelated errors.
- Invalid elements, unsupported child types, duplicate keys, and invalid hook order gain dedicated diagnostics when their mechanisms are introduced.
- Render errors are not swallowed. Recovery behavior is added only in the advanced error-boundary stage.
- Effect setup and cleanup failures are tested separately so commit ordering remains observable.
- The guide diagnoses root causes with the learner before proposing code changes.

## React Source Comparison Method

Every stage maintains a short source map in `notes/` containing:

1. The public call that begins the behavior.
2. The important production files and functions.
3. The data structures that cross each boundary.
4. The relevant invariants.
5. Complexity present in React but intentionally omitted from the workshop runtime.

The initial complete source trace is:

```text
createRoot(container).render(element)
  -> ReactDOMRoot.createRoot
  -> createContainer / createFiberRoot
  -> ReactDOMRoot.render
  -> updateContainer
  -> scheduleUpdateOnFiber
  -> performUnitOfWork
  -> beginWork / completeWork
  -> commitRoot
  -> React DOM host operations
```

Source reading happens after implementing the smaller mechanism so production details answer questions the learner has already encountered.

## Git Checkpoints

The project uses Git from the first design document onward. Each completed mechanism receives a focused commit. Major stage completions receive descriptive tags such as `stage-0-imperative-dom` and `stage-3-fiber-work-loop`.

The learner's implementation is preserved. Experimental failures may remain in dedicated examples or notes when they provide useful evidence, but the main branch remains runnable at every stage checkpoint.

## Scope and Planning

This document is the workshop charter and curriculum map. It is intentionally not implemented as one large plan.

Each curriculum stage receives its own design clarification when needed, implementation plan, coding cycle, verification, and checkpoint. The first implementation plan covers only:

1. Minimal project foundation.
2. The Stage 0 imperative browser application.
3. The first problem observation notes.
4. Stage 0 verification and checkpoint.

Stage 1 planning begins only after the learner can explain the Stage 0 problem and approves moving forward.

## Workshop Completion Criteria

The workshop is complete when the learner can:

- Rebuild the core runtime mechanisms without copying React source.
- Explain which demonstrated problem motivated each mechanism.
- Trace initial render and state-update paths through the real React source.
- Predict identity, scheduling, hook, and effect behavior in non-trivial examples.
- Identify where the workshop runtime is intentionally simpler than React and explain the production concerns behind that complexity.
