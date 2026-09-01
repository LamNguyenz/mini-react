# Reconciliation and Host Identity

## Problem

Replacing the complete DOM tree can display correct content while disconnecting
browser objects that own draft input values, focus, selection, and other local
state.

## Retained Record

An element description says what UI is wanted now. A retained record additionally
remembers the host or text DOM object, prior supported props, and rendered child
records so the next description can be compared with existing output.

## Positional Reuse

When an unkeyed child keeps the same type and position, the reconciler reuses its
DOM node, updates changed props and text, and recursively compares its children.
This preserves identity for stable structures but treats position as identity.

## Reproduced Positional Failure

Inserting a same-type row at the front makes the former first row display a new
task. Its browser-owned state follows the DOM object and therefore follows the
old position instead of the logical task.

## Stable Keys

A key identifies one logical child among its siblings. The same key and resolved
host type reuse a record; a new key mounts; an absent key deletes; and a matched
key at another position moves the existing DOM node. Keys must be stable and
unique among siblings. Duplicate-key behavior is unsupported; React warns in
development rather than throwing.

## Host Operations

| Purpose | Stage 2 mechanism | Browser operation |
| --- | --- | --- |
| Reuse host | same type and identity | retain existing node |
| Update text | text record comparison | `textNode.nodeValue = value` |
| Update property | prop comparison | `node[name] = value` |
| Remove attribute | prop comparison | `node.removeAttribute(name)` |
| Replace listener | event comparison | `removeEventListener` then `addEventListener` |
| Insert or move | ordered child reconciliation | `parent.insertBefore(node, anchor)` |
| Replace type | record comparison | `parent.replaceChild(next, old)` |
| Delete child | unmatched old record | `node.remove()` |

## What This Record Tree Is Not

The records support synchronous host comparison only. They are not Fiber nodes:
they have no work-in-progress alternate, scheduling priority, update queue,
effect flags, or ability to pause and abandon calculation.

## React Source Map

| What we built | React boundary | What we understand | New mechanism deferred |
| --- | --- | --- | --- |
| Ordered sibling comparison | `reconcileChildrenArray` and `updateSlot` | Type, key, and position influence reuse | Fiber creation and alternate reuse |
| Keyed lookup | `mapRemainingChildren` | Explicit keys match identity; unkeyed children use their old index | Iterable handling and development warnings |
| Placement and movement | `placeChild` | Existing Fibers may stay or receive placement work | Effect flags and separate commit traversal |
| Deletion | `deleteChild` | Unmatched old identity must be removed | Deletion flags and lifecycle cleanup |
| Text child reuse | `updateSlot` and `updateTextNode` | Existing text output can be reused | Host update preparation and commit timing |
| Host prop updates | Outside the inspected `ReactChildFiber` boundary | Existing host output can change in place | Host configuration and commit implementation |

These names were verified against pinned React commit `52912a1453`. The source
records placement and deletion work on Fibers; unlike Stage 2, it does not
perform those DOM mutations directly inside child matching.

## Mechanisms Intentionally Deferred

- Persistent function-component identity and component-owned state
- Class state and lifecycle methods
- Fiber work units and current/work-in-progress trees
- Separate render and commit phases
- Scheduling, priorities, and lanes
- Hooks, refs, effects, context, Suspense, and hydration

## Learner Explanation

### 1. Why can full replacement show correct content while losing browser-owned state?

Application state can produce a new description with the same visible content,
but browser-owned state belongs to a particular DOM object. Full replacement
disconnects that object and creates another one, so the new node does not inherit
its focus, unfinished input value, or selection.

### 2. What does a retained record remember that an element description does not?

A retained record remembers the existing DOM object, previously rendered props,
rendered child records, and the previous text value. This gives the reconciler
existing output to compare with and update. A description only says what output
is wanted next.

### 3. Why does same type and position preserve identity for a stable tree?

When the structure stays stable, the same position continues to refer to the
same logical child. The same host type means its existing DOM node is compatible
with the next description, so that object can be updated while keeping its
browser-owned state.

### 4. How does a front insertion prove that position is not logical list identity?

For an unkeyed list changing from `A, B` to `X, A, B`, positional matching pairs
the new X description with A's old record at index zero. A's DOM object is
repurposed to display X while retaining A's browser-owned state. The object stays
the same, but the logical task it represents changes.

### 5. Why must a key be stable and unique only among siblings?

A stable key identifies the same logical child across renders. When its key and
host type match, the reconciler can reuse and move its existing DOM node. Keys
only need to be unique among siblings because reconciliation compares the child
records inside one parent; records under different parents are not matched.

### 6. What is the difference between insertion, movement, replacement, and deletion?

- Insertion mounts a new record because no old identity matches, then inserts
  its new DOM node.
- Movement places a reused DOM node at a different sibling position without
  cloning it.
- Replacement mounts a new DOM node because the matched identity has an
  incompatible host type, then replaces the old node.
- Deletion removes an old record's DOM node because that identity was not reused.

When identity and type both match, the operation is an update rather than a
replacement: the runtime retains the node and changes only the necessary text,
props, listeners, and children.

### 7. Why must changed event handlers remove the previous listener?

Registering a different callback does not unregister the previous callback. If
the old listener remains, one event may run both old and new logic, causing stale
or duplicate updates. The DOM must remove the previous function and register the
current one.

### 8. Why is this record tree not Fiber?

Stage 2 records remember host output, but reconciliation progress still exists
only in JavaScript's recursive call stack and DOM mutations happen during that
same traversal. The records have no current/work-in-progress alternate, saved
unit of work, priority, update queue, or effect flags. The runtime cannot pause,
resume, abandon, or schedule individual records, and it has no separate commit
phase.

### 9. Which problem remains before component state can belong to function-component identity?

Function components currently disappear during expansion because Stage 2 only
retains text and host records. The runtime needs a persistent component record
that retains the component type and key for identity, its props, state and
pending updates, and its rendered child record. Without that component boundary,
there is nowhere to associate state with one component instance across renders.
