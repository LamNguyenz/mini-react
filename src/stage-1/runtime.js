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
  let isUnmount = false

  if (!(container instanceof HTMLElement)) {
    throw new TypeError("createRoot requires an HTMLElement container");
  }
  function render(element) {
    if (isUnmount) {
      throw Error("Cannot render an unmounted root")
    }
    const node = renderDescription(element);
    if (node === null) {
      container.replaceChildren();
    } else {
      container.replaceChildren(node);
    }
  }
  function unmount() {
    if (isUnmount) return;
    isUnmount = true;
    container.replaceChildren();
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

function renderDescription(description) {
  if (description == null || typeof description === "boolean") {
    return null;
  }

  if (Array.isArray(description)) {
    const fragment = document.createDocumentFragment();

    for (const childDescription of description) {
      const childNode = renderDescription(childDescription);

      if (childNode != null) {
        fragment.append(childNode);
      }
    }

    return fragment;
  }

  if (typeof description == "string" || typeof description == "number") {
    return document.createTextNode(String(description));
  }

  if (typeof description == "object" && typeof description.type === "string") {
    const node = document.createElement(description.type);

    for (const [name, value] of Object.entries(description.props)) {
      applyProp(node, name, value);
    }

    const children = renderDescription(description.props.children);

    if (children != null) {
      node.append(children);
    }

    return node;
  }

  if (
    typeof description === "object" &&
    typeof description.type === "function"
  ) {
    const returnedDescription = description.type(description.props);
    return renderDescription(returnedDescription);
  }

  throw TypeError("Unsupported child description");
}
