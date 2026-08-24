# Stage 1: Declarative Elements and Recursive Rendering

## Requirement
Application code now focus on description, now user only need to describe the UI while the runtime handle DOM creation.

## Stage 0 Synchronization Removed
When an event changes application state, manually updating every related DOM
node can create duplicated logic and inconsistent UI. A declarative approach
uses state as the source of truth: the event updates state, and rendering
derives the complete UI description from that state.

## Element Description Shape
Element description is now a plain JS object, but not DOM node anymore. By that we can easily define attribute without touching the DOM api.
```JS
{type, props: {children}}
```

## Recursive Render Path
By recursive we can renders a description and then render it's children, so that we don't manually update every node by ourself anymore.

## Element vs Component vs DOM Node
Element: Plain description object
Component: Function that receive props and return description
DOM Node: Real browser object produced by the renderer

## Reproduced Identity Failure
A renderer that replaces the complete DOM tree creates new DOM objects on every
render. Application state stored in JavaScript survives, but DOM-local state
such as an unsubmitted input value, focus, selection, and node identity can be
lost.

## Browser Host Operations

| Purpose | Runtime function | Browser operation |
| --- | --- | --- |
| Create text | renderDescription | document.createTextNode |
| Create a host element | renderDescription | document.createElement |
| Group array children | renderDescription | document.createDocumentFragment() and fragment.append() |
| Apply a direct property | applyProp | node[name] = value |
| Apply data/ARIA attributes | applyProp | element.setAttribute |
| Attach event behavior | applyProp | element.addEventListener |
| Insert children | renderDescription | element.append |
| Replace the root contents | render | container.replaceChildren(node) |


## React Source Map

| What we built | React equivalent | What we understand | New mechanism deferred |
| --- | --- | --- | --- |
| `createElement` | React `createElement` / JSX runtime | Creates description data, not DOM | Keys, owners, development metadata |
| `createRoot` | React DOM `createRoot` | Connects a root object to a host container | `FiberRoot`, event-system setup |
| `root.render` | `ReactDOMRoot.prototype.render` | Submits the next element description | `updateContainer` and scheduling |
| Full DOM replacement | Reconciliation and commit | Produces visible host output | How React preserves and updates existing nodes |

## Mechanisms Intentionally Omitted

| Mechanism | Problem it solves | What Stage 1 does instead |
| --- | --- | --- |
| Reconciliation | Determines which existing host nodes can be reused, updated, inserted, or removed | Discards the complete old DOM tree |
| Fiber | Represents React’s component work as connected units that React can track | Uses one synchronous recursive function call |
| Scheduling and lanes | Prioritizes updates and decides when work should run | Performs every update immediately |
| Hooks | Gives function components persistent state and reusable stateful behavior | Stores state in the `mountTaskApp` closure |
| Effects | Synchronizes rendered components with external systems after rendering | Has no component effect system |
| Separate render and commit phases | Separates calculating changes from mutating the host | Creates and mutates DOM during the same recursive pass |

## Historical Context
1. JSX appeared early in React
React introduced JSX early as a convenient way to write element descriptions. Our workshop delayed JSX until after we manually understood the resulting { type, props } objects.
2. createRoot is a modern API name
Early React did not begin with today’s createRoot API. We use the modern name because it gives us a clear boundary:
element descriptions
→ root
→ host container
This does not mean our root implements everything modern React’s root implements.
3. The workshop separates React’s mechanisms
Real React accumulated mechanisms over time:
declarative elements
→ component state and lifecycle
→ reconciliation
→ Fiber
→ Hooks and effects
→ scheduling and concurrent lanes
We are separating them into stages so each new mechanism solves a problem we have already reproduced.

## Learner Explanation
1. Why does a declarative description remove manual summary, row, and filter DOM updates from event handlers?
Because now we have the runtime renderer, we don't have to repeatedly update DOM for every element when some changes happen. By declarative description, we have the recipe, TaskApp receives the current state and derives the complete UI description, including rows, summary, and filter properties. So we just need to re-render the parent, we don't care about all the nested children. In manually way, we have to remember all the DOM need to update.

2. What is the difference between creating an element description, invoking a function component, and creating a DOM node?
Creating element description is just creating an object, that are used for later render DOM node
Invoking a function component is to use props to derive and return description. We pass props to the function invoke for the function to process before return the description, give more control over description
And finally, creating a DOM node is the one that really interact with the real browser DOM node, help us create the real DOM node in the browser

3. Why does createElement not call document.createElement?
Because the createElement must return object description. It should not create DOM node right away because we need to construct the structure of the React description. So we only call the document.createElement when the user call render, by that we have full information for the tree structure to render.

4. How does recursive rendering reach browser host operations?
It recursive over the children element in description object, by that it call recursive renderDescription. In the renderDescription we call the browser DOM node operations.
It keeps descending through descriptions until it reaches a host type or text, where browser operations become necessary

5. Why can the rendered content be correct while focus and DOM node identity are lost?
Why the visible content is correct:
→ The visible content is correct because it render based on the props it passed, when the render happen, the state keep in the closure, so it can remain the value of application state or props when re-render

Why identity and focus are lost:
→ The one that handle by the browser are not saved in the closure, so when we render, it will return back to the default value of the browser, that cause the lost.
renderDescription creates new DOM nodes, and container.replaceChildren(node) disconnects the old tree. Because the input draft and focus were attached to the old input and were not stored in application state, the new input begins empty and unfocused.

6. Why is reconciliation the next mechanism instead of being included in Stage 1?
Why Stage 1 intentionally uses full replacement:
→ It is easy enough for us to implement and learn the basic concept, it we use reconciliation right now, it will be overwhelming

What problem reconciliation should solve next:
→ It should use to determine which existing host node should be resued, updated, inserted or removed, help us to keep the input or focus without losting them
