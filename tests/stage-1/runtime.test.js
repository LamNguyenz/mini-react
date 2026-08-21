import {
  assertEqual,
  assertThrows,
  run,
  test,
} from "../browser/harness.js";
import { createElement, createRoot } from "../../src/stage-1/runtime.js";

function createFixture() {
  const fixture = document.createElement("div");
  document.body.append(fixture);
  return fixture;
}

test("renders one handwritten host element description", () => {
  const fixture = createFixture();
  let root;
  try {
    root = createRoot(fixture);
    root.render({
      type: "p",
      props: { children: ["Hello Stage 1"] },
    });

    assertEqual(fixture.children.length, 1);
    assertEqual(fixture.firstElementChild.tagName, "P");
    assertEqual(fixture.firstElementChild.textContent, "Hello Stage 1");
  } finally {
    root?.unmount();
    fixture.remove();
  }
});

test("rejects a non-element root container", () => {
  assertThrows(
    () => createRoot(null),
    TypeError,
    "createRoot requires an HTMLElement container",
  );
});

test("recursively renders nested and normalized children", () => {
  const fixture = createFixture();
  const root = createRoot(fixture);
  try {
    root.render({
      type: "section",
      props: {
        children: [
          { type: "h2", props: { children: ["Tasks"] } },
          ["Count: ", 2, null, undefined, false, true],
        ],
      },
    });

    assertEqual(fixture.querySelector("h2").textContent, "Tasks");
    assertEqual(fixture.querySelector("section").textContent, "TasksCount: 2");
  } finally {
    root.unmount();
    fixture.remove();
  }
});

test("rejects an unsupported child description", () => {
  const fixture = createFixture();
  const root = createRoot(fixture);
  try {
    assertThrows(
      () =>
        root.render({
          type: "div",
          props: { children: [{ unsupported: true }] },
        }),
      TypeError,
      "Unsupported child description",
    );
  } finally {
    root.unmount();
    fixture.remove();
  }
});

test("createElement returns a normalized description without creating DOM", () => {
  const child = createElement("span", null, "B");
  const element = createElement(
    "section",
    { id: "tasks" },
    "A",
    "",
    [[[0, [null, [false, child]]]]],
  );

  assertEqual(element.type, "section");
  assertEqual(element.props.id, "tasks");
  assertEqual(element.props.children.length, 4);
  assertEqual(element.props.children[0], "A");
  assertEqual(element.props.children[1], "");
  assertEqual(element.props.children[2], "0");
  assertEqual(element.props.children[3], child);
  assertEqual(document.querySelector("#tasks"), null);
});

test("createElement rejects an unsupported type", () => {
  assertThrows(
    () => createElement({}, null),
    TypeError,
    "createElement requires a string or function type",
  );
});

run();
