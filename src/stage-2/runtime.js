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
      childRecords[0] = reconcileRecord(oldRecord, element);
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

function applyProp(node, name, value) {
  if (name === "children") {
    return;
  }

  const directProperties = [
    "value",
    "checked",
    "hidden",
    "type",
    "id",
    "className",
    "htmlFor",
  ];

  if (directProperties.includes(name)) {
    node[name] = value;
    return;
  }

  if (name.startsWith("data-") || name.startsWith("aria-")) {
    node.setAttribute(name, String(value));
    return;
  }

  const eventNames = {
    onClick: "click",
    onSubmit: "submit",
    onChange: "change",
  };

  if (name in eventNames) {
    node.addEventListener(eventNames[name], value);
    return;
  }

  throw TypeError(`Unsupported prop: ${name}`);
}

function reconcileRecord(oldRecord, description) {
  if (oldRecord.kind === "text") {
    const nextValue = String(description);

    if (oldRecord.value !== nextValue) {
      oldRecord.dom.nodeValue = nextValue;
      oldRecord.value = nextValue;
    }
    return oldRecord;
  }

  if (oldRecord.kind === "host") {
    const nextDescriptions = description.props.children;

    oldRecord.children = oldRecord.children.map((childRecord, index) =>
      reconcileRecord(childRecord, nextDescriptions[index]),
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
      applyProp(dom, name, value);
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
