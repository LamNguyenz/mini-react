function normalizeChildren(children) {
  return children
    .flat(Infinity)
    .filter((child) => child != null && typeof child !== "boolean")
    .map((child) => (typeof child === "number" ? String(child) : child));
}

export function createElement(type, props, ...children) {
  if (!(typeof type == "string" || typeof type == "function")) {
    throw new TypeError("createElement requires a string or function type");
  }
  const { key = null, ...copiedProps } = props ?? {};
  return {
    type,
    key,
    props: {
      ...copiedProps,
      children: normalizeChildren(children),
    },
  };
}

export class Component {
  constructor(props) {
    this.props = props;
    this.state = {};
    this.__enqueueStateUpdate = null;
    this.__status = "constructing";
  }

  setState(update, callback) {
    if (callback !== undefined) {
      throw new TypeError("setState callbacks are not supported");
    }
    switch (this.__status) {
      case "constructing":
        throw new Error("Cannot update state during component construction");
      case "rendering":
        throw new Error("Cannot update state while rendering");
      case "unmounted":
        throw new Error("Cannot update an unmounted component");
      default:
    }
    if (
      update === null ||
      (typeof update !== "object" && typeof update !== "function") ||
      Array.isArray(update)
    ) {
      throw new TypeError("setState requires an object or updater function");
    }

    if (this.__enqueueStateUpdate === null) {
      throw new Error("Cannot update component state before mounting");
    }

    this.__enqueueStateUpdate(update);
  }
}

export function createRoot(container) {
  let isUnmount = false;
  let currentElement = null;
  let childRecords = [];
  let lifecycleCallbacks = [];

  if (!(container instanceof HTMLElement)) {
    throw new TypeError("createRoot requires an HTMLElement container");
  }

  let isRendering = false;

  const rootContext = {
    get isRendering() {
      return isRendering;
    },

    enqueueLifecycle(callback) {
      lifecycleCallbacks.push(callback);
    },

    requestRender() {
      performRender();
    },
  };

  function flushLifecycleCallbacks() {
    const callbacks = lifecycleCallbacks;
    lifecycleCallbacks = [];

    for (const callback of callbacks) {
      callback();
    }
  }

  function performRender() {
    if (isRendering) {
      throw new Error("Cannot update state while rendering");
    }

    isRendering = true;
    let completed = false;
    try {
      const nextDescriptions = expandDescriptions(currentElement);

      childRecords = reconcileChildren(
        container,
        childRecords,
        nextDescriptions,
        rootContext,
      );

      completed = true;
    } finally {
      isRendering = false;

      if (!completed) {
        lifecycleCallbacks = [];
      }
    }
    flushLifecycleCallbacks();
  }

  function render(element) {
    if (isUnmount) {
      throw Error("Cannot render an unmounted root");
    }
    currentElement = element;
    performRender();
  }

  function unmount() {
    if (isUnmount) return;

    for (const record of childRecords) {
      detachRecord(record);
    }

    isUnmount = true;
    container.replaceChildren();
    childRecords = [];
  }

  return { render, unmount };
}

const DIRECT_PROPERTIES = new Set([
  "value",
  "checked",
  "hidden",
  "type",
  "id",
  "className",
  "htmlFor",
]);
const EVENT_NAMES = {
  onClick: "click",
  onSubmit: "submit",
  onChange: "change",
};

function setProp(node, name, value) {
  if (name === "children") {
    return;
  }

  if (DIRECT_PROPERTIES.has(name)) {
    node[name] = value;
    return;
  }

  if (name.startsWith("data-") || name.startsWith("aria-")) {
    node.setAttribute(name, String(value));
    return;
  }

  if (name in EVENT_NAMES) {
    if (typeof value !== "function") {
      throw TypeError(`Event prop ${name} requires a function`);
    }
    node.addEventListener(EVENT_NAMES[name], value);
    return;
  }

  throw TypeError(`Unsupported prop: ${name}`);
}

function removeProp(node, name, value) {
  if (name === "children") return;

  if (DIRECT_PROPERTIES.has(name)) {
    node[name] = typeof node[name] === "boolean" ? false : "";
    return;
  }

  if (name.startsWith("data-") || name.startsWith("aria-")) {
    node.removeAttribute(name);
    return;
  }

  if (name in EVENT_NAMES) {
    node.removeEventListener(EVENT_NAMES[name], value);
    return;
  }

  throw TypeError(`Unsupported prop: ${name}`);
}

function updateProps(node, oldProps, nextProps) {
  for (const [name, oldValue] of Object.entries(oldProps)) {
    if (name === "children") continue;

    if (!(name in nextProps)) {
      removeProp(node, name, oldValue);
    }
  }

  for (const [name, newValue] of Object.entries(nextProps)) {
    if (name === "children") continue;

    const oldValue = oldProps[name];
    if (oldValue === newValue) continue;

    if (name in EVENT_NAMES && name in oldProps) {
      removeProp(node, name, oldProps[name]);
    }

    setProp(node, name, nextProps[name]);
  }
}

function hasSameType(oldRecord, description) {
  if (oldRecord.kind === "text") {
    return typeof description === "string" || typeof description === "number";
  }

  if (oldRecord.kind === "host") {
    return (
      typeof description === "object" &&
      typeof description.type === "string" &&
      oldRecord.type === description.type
    );
  }

  if (oldRecord.kind === "component") {
    return (
      typeof description === "object" &&
      description !== null &&
      isClassComponentDescription(description) &&
      oldRecord.type === description.type
    );
  }

  return false;
}

function reconcileChildren(parent, oldRecords, nextDescriptions, rootContext) {
  const oldKeys = new Map();
  const oldUnkeyedByIndex = new Map();

  for (const [index, record] of oldRecords.entries()) {
    if (record.key == null) {
      oldUnkeyedByIndex.set(index, record);
    } else {
      oldKeys.set(record.key, record);
    }
  }

  const nextRecords = [];
  const usedRecords = new Set();
  for (let i = 0; i < nextDescriptions.length; i++) {
    const nextDescription = nextDescriptions[i];

    const oldRecord =
      nextDescription.key == null
        ? (oldUnkeyedByIndex.get(i) ?? null)
        : (oldKeys.get(nextDescription.key) ?? null);

    let nextRecord;
    if (oldRecord == null) {
      [nextRecord] = mountRecords(nextDescription, rootContext);
    } else {
      usedRecords.add(oldRecord);
      nextRecord = reconcileRecord(
        parent,
        oldRecord,
        nextDescription,
        rootContext,
      );
    }

    const nextDom = getDom(nextRecord);
    const anchor = parent.childNodes[i] ?? null;
    if (nextDom !== anchor) {
      parent.insertBefore(nextDom, anchor);
    }
    nextRecords.push(nextRecord);
  }

  for (const oldRecord of oldRecords) {
    const oldDom = getDom(oldRecord);

    if (!usedRecords.has(oldRecord) && oldDom.parentNode === parent) {
      detachRecord(oldRecord);
      oldDom.remove();
    }
  }

  return nextRecords;
}

function processPendingState(record) {
  let nextState = record.instance.state;

  for (const update of record.pendingUpdates) {
    let partialState =
      typeof update === "function"
        ? update(nextState, record.instance.props)
        : update;

    if (
      partialState === null ||
      typeof partialState !== "object" ||
      Array.isArray(partialState)
    ) {
      throw new TypeError("A state updater must return an object");
    }

    nextState = {
      ...nextState,
      ...partialState,
    };
  }
  record.pendingUpdates = [];
  record.instance.state = nextState;
}

function reconcileRecord(parent, oldRecord, description, rootContext) {
  if (!hasSameType(oldRecord, description)) {
    const [nextRecord] = mountRecords(description, rootContext);
    parent.replaceChild(getDom(nextRecord), getDom(oldRecord));
    detachRecord(oldRecord);
    return nextRecord;
  }

  if (oldRecord.kind === "text") {
    const nextValue = String(description);

    if (oldRecord.value !== nextValue) {
      oldRecord.dom.nodeValue = nextValue;
      oldRecord.value = nextValue;
    }
    return oldRecord;
  }

  if (oldRecord.kind === "host") {
    updateProps(oldRecord.dom, oldRecord.props, description.props);
    const nextDescriptions = expandDescriptions(description.props.children);

    oldRecord.children = reconcileChildren(
      oldRecord.dom,
      oldRecord.children,
      nextDescriptions,
      rootContext,
    );
    oldRecord.props = description.props;
    return oldRecord;
  }

  if (oldRecord.kind === "component") {
    const prevProps = oldRecord.instance.props;
    const prevState = oldRecord.instance.state;

    oldRecord.instance.props = description.props;
    processPendingState(oldRecord);

    oldRecord.instance.__status = "rendering";

    let nextDescription;
    try {
      nextDescription = resolveSingleComponentOutput(
        oldRecord.instance.render(),
      );
    } finally {
      if (oldRecord.instance.__status !== "unmounted") {
        oldRecord.instance.__status = "mounted";
      }
    }

    oldRecord.child = reconcileRecord(
      parent,
      oldRecord.child,
      nextDescription,
      rootContext,
    );

    oldRecord.props = description.props;

    if (typeof oldRecord.instance.componentDidUpdate === "function") {
      rootContext.enqueueLifecycle(() => {
        oldRecord.instance.componentDidUpdate(prevProps, prevState);
      });
    }

    return oldRecord;
  }
}

function mountRecords(description, rootContext) {
  if (description == null || typeof description === "boolean") {
    return [];
  }

  if (Array.isArray(description)) {
    return description.flatMap((child) => mountRecords(child, rootContext));
  }

  if (typeof description == "string" || typeof description == "number") {
    const value = String(description);
    const dom = document.createTextNode(value);

    return [
      {
        kind: "text",
        value,
        dom,
      },
    ];
  }

  if (typeof description == "object" && typeof description.type === "string") {
    const dom = document.createElement(description.type);

    for (const [name, value] of Object.entries(description.props)) {
      setProp(dom, name, value);
    }

    const childDescriptions = expandDescriptions(description.props.children);

    const children = childDescriptions.flatMap((child) =>
      mountRecords(child, rootContext),
    );

    dom.append(...children.map((child) => getDom(child)));

    return [
      {
        kind: "host",
        type: description.type,
        key: description.key ?? null,
        props: description.props,
        dom,
        children,
      },
    ];
  }

  if (
    typeof description === "object" &&
    typeof description.type === "function"
  ) {
    if (isClassComponentDescription(description)) {
      const instance = new description.type(description.props);

      const instanceState = instance.state;

      if (
        instanceState === null ||
        typeof instanceState !== "object" ||
        Array.isArray(instanceState)
      ) {
        throw new TypeError("Component state must be an object");
      }

      const record = {
        kind: "component",
        type: description.type,
        key: description.key ?? null,
        props: description.props,
        instance,
        child: null,
        pendingUpdates: [],
      };

      instance.__enqueueStateUpdate = (update) => {
        if (rootContext.isRendering) {
          throw new Error("Cannot update state while rendering");
        }

        record.pendingUpdates.push(update);
        rootContext.requestRender();
      };

      instance.__status = "rendering";
      let childDescription;
      try {
        childDescription = resolveSingleComponentOutput(instance.render());
      } finally {
        if (instance.__status !== "unmounted") {
          instance.__status = "mounted";
        }
      }

      const [child] = mountRecords(childDescription, rootContext);
      record.child = child;

      if (typeof instance.componentDidMount === "function") {
        rootContext.enqueueLifecycle(() => instance.componentDidMount());
      }

      return [record];
    }
    const output = description.type(description.props);
    return mountRecords(output, rootContext);
  }

  throw TypeError("Unsupported child description");
}

function detachRecord(record) {
  if (record.kind === "component") {
    record.instance.__status = "unmounted";
    record.instance.__enqueueStateUpdate = null;
    detachRecord(record.child);
  }
  if (record.kind === "host") {
    for (const child of record.children) {
      detachRecord(child);
    }
  }
}

function expandDescriptions(description) {
  if (description == null || typeof description === "boolean") {
    return [];
  }

  if (Array.isArray(description)) {
    return description.flatMap(expandDescriptions);
  }

  if (
    typeof description === "object" &&
    typeof description.type === "function"
  ) {
    if (isClassComponentDescription(description)) {
      return [description];
    }

    const output = description.type(description.props);
    const outputDescriptions = expandDescriptions(output);

    if (description.key != null && outputDescriptions.length !== 1) {
      throw new TypeError(
        "A keyed function component must return exactly one host root",
      );
    }

    if (
      outputDescriptions.length === 1 &&
      typeof outputDescriptions[0]?.type === "string"
    ) {
      const [outputDescription] = outputDescriptions;
      return [
        {
          ...outputDescription,
          key: description.key,
        },
      ];
    }
    return outputDescriptions;
  }

  return [description];
}

function resolveSingleComponentOutput(output) {
  const descriptions = expandDescriptions(output);

  if (descriptions.length !== 1) {
    throw new TypeError(
      "A class component must return exactly one non-empty root",
    );
  }

  return descriptions[0];
}

// Small Utility
function isClassComponentDescription(description) {
  return description.type.prototype instanceof Component;
}

function getDom(record) {
  return record.kind === "component" ? getDom(record.child) : record.dom;
}
