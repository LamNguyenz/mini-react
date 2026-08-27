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
  const copiedProps = { ...props };
  return {
    type,
    props: {
      ...copiedProps,
      children: normalizeChildren(children),
    },
  };
}

export function createRoot(container) {
  let isUnmount = false;
  let childRecords = [];

  if (!(container instanceof HTMLElement)) {
    throw new TypeError("createRoot requires an HTMLElement container");
  }
  function render(element) {
    if (isUnmount) {
      throw Error("Cannot render an unmounted root");
    }

    const oldRecord = childRecords[0];
    if (
      oldRecord &&
      typeof element?.type === "string" &&
      oldRecord.type === element.type
    ) {
      childRecords[0] = reconcileRecord(container, oldRecord, element);
      return;
    }

    const nextRecords = mountRecords(element);

    container.replaceChildren(...nextRecords.map((record) => record.dom));
    childRecords = nextRecords;
  }

  function unmount() {
    if (isUnmount) return;

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

  return (
    oldRecord.kind === "host" &&
    typeof description === "object" &&
    typeof description.type === "string" &&
    oldRecord.type === description.type
  );
}

function reconcileChildren(parent, oldRecords, nextDescriptions) {
  const nextRecords = [];

  for (let i = 0; i < nextDescriptions.length; i++) {
    const oldRecord = oldRecords[i];
    const nextDescription = nextDescriptions[i];

    if (oldRecord === undefined) {
      const [nextRecord] = mountRecords(nextDescription);
      const anchor = parent.childNodes[i] ?? null;

      parent.insertBefore(nextRecord.dom, anchor);
      nextRecords.push(nextRecord);
      continue;
    }

    nextRecords.push(reconcileRecord(parent, oldRecord, nextDescription));
  }

  for (
    let index = nextDescriptions.length;
    index < oldRecords.length;
    index++
  ) {
    oldRecords[index].dom.remove();
  }

  return nextRecords;
}

function reconcileRecord(parent, oldRecord, description) {
  if (!hasSameType(oldRecord, description)) {
    const [nextRecord] = mountRecords(description);
    parent.replaceChild(nextRecord.dom, oldRecord.dom);
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
    const nextDescriptions = description.props.children;

    oldRecord.children = reconcileChildren(
      oldRecord.dom,
      oldRecord.children,
      nextDescriptions,
    );
    oldRecord.props = description.props;
    return oldRecord;
  }
}

function mountRecords(description) {
  if (description == null || typeof description === "boolean") {
    return [];
  }

  if (Array.isArray(description)) {
    return description.flatMap(mountRecords);
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

    const children = mountRecords(description.props.children);

    dom.append(...children.map((child) => child.dom));

    return [
      {
        kind: "host",
        type: description.type,
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
    const output = description.type(description.props);
    return mountRecords(output);
  }

  throw TypeError("Unsupported child description");
}
