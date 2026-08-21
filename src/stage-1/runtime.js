function normalizeChildren(children) {
  return children
    .flat(Infinity)
    .filter(
      (child) =>
        child != null && typeof child !== "boolean",
    )
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
  if (!(container instanceof HTMLElement)) {
    throw new TypeError("createRoot requires an HTMLElement container");
  }
  function render(element) {
    const node = renderDescription(element);
    if (node === null) {
      container.replaceChildren();
    } else {
      container.replaceChildren(node);
    }
  }
  function unmount() {
    container.replaceChildren();
  }
  return { render, unmount };
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
    const children = renderDescription(description.props.children);

    if (children != null) {
      node.append(children);
    }

    return node;
  }

  throw TypeError("Unsupported child description");
}
