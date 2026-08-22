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
