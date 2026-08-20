# Stage 0: Imperative DOM Observations

## Requirement
With DOM api, we maintain the UI information show in the screen, sync with the state and vice versa, we handle user interaction to UI to call and update state.

## Prediction Inventory

| Action | JavaScript state changed | DOM regions that must synchronize |
| --- | --- | --- |
| Add task | tasks, nextTaskId | new row, list, summary, input, error |
| Toggle task | task.completed | list, summary |
| Select filter | activeFilter | list, aria-pressed on filter buttons |

## Reproduced Failure
We temporarily removed `updateSummary()` from `handleTaskChange()`.
After creating two tasks and completing the first task, the task's
`completed` state, checkbox, row `data-completed` value, and filtered
visibility updated correctly.

However, the summary remained `0 of 2 completed` instead of changing
to `1 of 2 completed`. Two tests failed because both completion and
filtering expected the summary to be synchronized.

This showed that one event handler can make part of the UI correct
while leaving another part stale when it forgets one DOM update.

## Stage 0 Invariant
After every user interaction, the tasks array and DOM must agree
Each task has exactly one row with the same ID.
Checkbox and data-completed match task.completed.
Row visibility matches activeFilter.
Exactly one filter button represents activeFilter.
Summary equals completed task count and total task count.

## Why the Current Approach Becomes Difficult
Every event handler must remember all UI regions that consume changed state.
Adding, toggling, and filtering each synchronize different combinations.
Forgetting one operation leaves the UI partly correct and partly stale.
More state and UI regions create more synchronization paths.

## Browser Host Operations
| Purpose | Browser operation | Example from our app |
| --- | --- | --- |
| Create an element | `document.createElement()` | Create task rows, checkboxes, labels, and filter buttons |
| Insert children | `append()` / `appendChild()` | Insert a checkbox into a label and a task row into the list |
| Update text | `textContent` | Update the summary and task title |
| Update properties | `.checked` / `.hidden` | Read checkbox completion and control row visibility |
| Update attributes | `dataset` / `setAttribute()` | Store task identity, completion, and `aria-pressed` |
| Insert before a sibling | `insertBefore()` | Not currently needed, but would place a row before another row |
| Remove UI | `replaceChildren()` | Empty the mounted container during `destroy()` |
| Remove behavior | `removeEventListener()` | Disconnect submit, change, and click handlers |

## React Source Map
React source commit: `52912a1453`.

| React source operation | Data it receives | Browser operation it performs |
| --- | --- | --- |
| `ReactDOMRoot.js` — `createRoot` | Root DOM container and options | Validates the container, creates React's internal root, marks the container, and installs supported event listeners |
| `ReactFiberConfigDOM.js` — `createInstance` | Element type, props, root container, host context, and internal handle | Calls `ownerDocument.createElement()` or `createElementNS()` |
| `appendInitialChild` | Parent DOM instance and child instance | Calls `parentInstance.appendChild(child)` |
| `appendChild` / `appendChildToContainer` | Parent or root container and child | Calls `appendChild()` or `moveBefore()` |
| `commitUpdate` | DOM element, type, old props, and new props | Calls `updateProperties()` to synchronize changed DOM properties |
| `commitTextUpdate` | Text node, old text, and new text | Assigns the new value to `textInstance.nodeValue` |
| `insertBefore` | Parent, child, and reference sibling | Calls `insertBefore()` or `moveBefore()` |
| `removeChild` | Parent and child | Calls `parentInstance.removeChild(child)` |

Stage 0 only demonstrates direct browser DOM mutations. It does not yet implement React’s machinery for determining, organizing, and scheduling updates. Our event handlers update both state and DOM immediately.

The omitted mechanisms are reconciliation, Fiber, scheduling and lanes, hooks, effects, and separate render and commit phases.
## Learner Explanation
1. When a task is completed while the Active filter is selected, which JavaScript state changes, and which DOM locations must update?
JS state changes: task.completed
DOM locations changes: checkbox is checked, row.dataset.completed become "true", row.hidden become true, summary recalculated

2. Why can the UI become partly correct and partly stale during the same event handler?
Because we need to handle manually the updated logic of related calculation. Only we know what need to update when some state change, so when we forgot to update, some UI partly stale.

3. What would a single description of the UI for the current state remove from each event handler?
We could remove the manually dependencies update, just need to update the state

4. Which browser operations in our app correspond to React DOM host-config operations?
Create Dom node - createInstance in ReactFiberConfigDOM.js
Add element - appendChild
Update element - commitUpdate
Remove element - removeChild
