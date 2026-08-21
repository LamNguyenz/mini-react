export function createRoot(container) {
  if (!(container instanceof HTMLElement)) {
    throw new TypeError("createRoot requires an HTMLElement container");
  }
  function render(element) {
    const node = document.createElement(element.type);
    for (const str of element.props.children) {
      const textNode = document.createTextNode(str);
      node.append(textNode);
    }
    container.replaceChildren(node);
  }
  function unmount() {
    container.replaceChildren();
  }
  return { render, unmount };
}
