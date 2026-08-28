import {
  assertEqual,
  assertThrows,
  run,
  test,
} from "../browser/harness.js";
import { createElement, createRoot } from "../../src/stage-2/runtime.js";

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

test("applies supported DOM props, attributes, and events", () => {
  const fixture = createFixture();
  const root = createRoot(fixture);
  let clicks = 0;
  let submits = 0;
  let changes = 0;

  try {
    root.render(
      createElement(
        "form",
        {
          className: "task-form",
          "data-task-form": "",
          onSubmit(event) {
            event.preventDefault();
            submits += 1;
          },
        },
        createElement("input", {
          id: "task-toggle",
          type: "checkbox",
          value: "yes",
          checked: true,
          hidden: false,
          "aria-label": "Task toggle",
          onChange() {
            changes += 1;
          },
        }),
        createElement("label", { htmlFor: "task-toggle" }, "Task"),
        createElement(
          "button",
          {
            type: "submit",
            onClick() {
              clicks += 1;
            },
          },
          "Add task",
        ),
      ),
    );

    const form = fixture.querySelector("form");
    const input = fixture.querySelector("input");
    const button = fixture.querySelector("button");
    assertEqual(form.className, "task-form");
    assertEqual(form.hasAttribute("data-task-form"), true);
    assertEqual(input.id, "task-toggle");
    assertEqual(input.type, "checkbox");
    assertEqual(input.value, "yes");
    assertEqual(input.checked, true);
    assertEqual(input.hidden, false);
    assertEqual(input.getAttribute("aria-label"), "Task toggle");
    assertEqual(fixture.querySelector("label").htmlFor, "task-toggle");

    input.dispatchEvent(new Event("change", { bubbles: true }));
    button.click();
    assertEqual(changes, 1);
    assertEqual(clicks, 1);
    assertEqual(submits, 1);
  } finally {
    root.unmount();
    fixture.remove();
  }
});

test("rejects an unsupported DOM prop", () => {
  const fixture = createFixture();
  const root = createRoot(fixture);
  try {
    assertThrows(
      () => root.render(createElement("div", { title: "unsupported" })),
      TypeError,
      "Unsupported prop: title",
    );
  } finally {
    root.unmount();
    fixture.remove();
  }
});

test("invokes function components with props and normalized children", () => {
  const fixture = createFixture();
  const root = createRoot(fixture);

  function Greeting({ name, children }) {
    return createElement(
      "section",
      { "data-greeting": "" },
      createElement("h2", null, `Hello ${name}`),
      children,
    );
  }

  try {
    root.render(
      createElement(
        Greeting,
        { name: "Ada" },
        createElement("p", null, "Child content"),
      ),
    );

    assertEqual(fixture.querySelector("h2").textContent, "Hello Ada");
    assertEqual(fixture.querySelector("p").textContent, "Child content");
  } finally {
    root.unmount();
    fixture.remove();
  }
});

test("a second render preserves same-type host identity and browser state", () => {
  const fixture = createFixture();
  const root = createRoot(fixture);
  try {
    root.render(createElement("input", { id: "draft" }));
    const firstInput = fixture.querySelector("input");
    firstInput.value = "Uncommitted draft";
    firstInput.focus();

    root.render(createElement("input", { id: "draft" }));
    const nextInput = fixture.querySelector("input");

    assertEqual(firstInput === nextInput, true);
    assertEqual(firstInput.isConnected, true);
    assertEqual(nextInput.value, "Uncommitted draft");
    assertEqual(document.activeElement === nextInput, true);
  } finally {
    root.unmount();
    fixture.remove();
  }
});

test("updates text while preserving the host and text node objects", () => {
  const fixture = createFixture();
  const root = createRoot(fixture);
  try {
    root.render(createElement("p", null, "Before"));
    const paragraph = fixture.querySelector("p");
    const textNode = paragraph.firstChild;

    root.render(createElement("p", null, "After"));

    assertEqual(fixture.querySelector("p") === paragraph, true);
    assertEqual(paragraph.firstChild === textNode, true);
    assertEqual(textNode.nodeValue, "After");
  } finally {
    root.unmount();
    fixture.remove();
  }
});

test("updates and removes supported props on a reused host node", () => {
  const fixture = createFixture();
  const root = createRoot(fixture);
  try {
    root.render(
      createElement("input", {
        id: "before",
        checked: true,
        hidden: true,
        "data-state": "before",
        "aria-label": "Before",
      }),
    );
    const input = fixture.querySelector("input");

    root.render(createElement("input", { id: "after", checked: false }));

    assertEqual(fixture.querySelector("input") === input, true);
    assertEqual(input.id, "after");
    assertEqual(input.checked, false);
    assertEqual(input.hidden, false);
    assertEqual(input.hasAttribute("data-state"), false);
    assertEqual(input.hasAttribute("aria-label"), false);
  } finally {
    root.unmount();
    fixture.remove();
  }
});

test("replaces and removes event handlers without duplicate listeners", () => {
  const fixture = createFixture();
  const root = createRoot(fixture);
  let firstClicks = 0;
  let nextClicks = 0;
  const firstHandler = () => {
    firstClicks += 1;
  };
  const nextHandler = () => {
    nextClicks += 1;
  };

  try {
    root.render(createElement("button", { onClick: firstHandler }, "Run"));
    const button = fixture.querySelector("button");
    button.click();

    root.render(createElement("button", { onClick: nextHandler }, "Run"));
    button.click();

    root.render(createElement("button", null, "Run"));
    button.click();

    assertEqual(firstClicks, 1);
    assertEqual(nextClicks, 1);
  } finally {
    root.unmount();
    fixture.remove();
  }
});

test("rejects a non-function event prop", () => {
  const fixture = createFixture();
  const root = createRoot(fixture);
  try {
    assertThrows(
      () => root.render(createElement("button", { onClick: "invalid" })),
      TypeError,
      "Event prop onClick requires a function",
    );
  } finally {
    root.unmount();
    fixture.remove();
  }
});

test("inserts, replaces, and deletes positional children", () => {
  const fixture = createFixture();
  const root = createRoot(fixture);
  try {
    root.render(
      createElement(
        "section",
        null,
        createElement("p", { "data-id": "a" }, "A"),
        createElement("p", { "data-id": "b" }, "B"),
      ),
    );
    const section = fixture.querySelector("section");
    const firstParagraph = section.children[0];
    const removedParagraph = section.children[1];

    root.render(
      createElement(
        "section",
        null,
        createElement("p", { "data-id": "a" }, "A updated"),
        createElement("span", { "data-id": "c" }, "C"),
        createElement("p", { "data-id": "d" }, "D"),
      ),
    );

    assertEqual(section.children[0] === firstParagraph, true);
    assertEqual(section.children[0].textContent, "A updated");
    assertEqual(section.children[1].tagName, "SPAN");
    assertEqual(section.children[2].textContent, "D");
    assertEqual(removedParagraph.isConnected, false);

    const lastParagraph = section.children[2];
    root.render(
      createElement(
        "section",
        null,
        createElement("p", { "data-id": "a" }, "A updated"),
      ),
    );

    assertEqual(section.children.length, 1);
    assertEqual(lastParagraph.isConnected, false);
  } finally {
    root.unmount();
    fixture.remove();
  }
});

test("roots replace and unmount only their own containers", () => {
  const firstFixture = createFixture();
  const secondFixture = createFixture();
  const firstRoot = createRoot(firstFixture);
  const secondRoot = createRoot(secondFixture);
  try {
    firstRoot.render(createElement("p", null, "First"));
    secondRoot.render(createElement("p", null, "Second"));
    firstRoot.unmount();

    assertEqual(firstFixture.children.length, 0);
    assertEqual(secondFixture.textContent, "Second");
  } finally {
    firstRoot.unmount();
    secondRoot.unmount();
    firstFixture.remove();
    secondFixture.remove();
  }
});

test("rendering after unmount throws a focused error", () => {
  const fixture = createFixture();
  const root = createRoot(fixture);
  try {
    root.unmount();
    root.unmount();

    assertThrows(
      () => root.render(createElement("p", null, "Too late")),
      Error,
      "Cannot render an unmounted root",
    );
  } finally {
    fixture.remove();
  }
});

test("positional matching reuses the wrong logical row after a front insertion", () => {
  const fixture = createFixture();
  const root = createRoot(fixture);

  function TaskRow({ id, title }) {
    return createElement("li", { "data-task-id": id }, title);
  }

  function TaskList({ tasks }) {
    return createElement(
      "ul",
      null,
      tasks.map((task) => createElement(TaskRow, task)),
    );
  }

  try {
    root.render(
      createElement(TaskList, {
        tasks: [
          { id: "a", title: "Task A" },
          { id: "b", title: "Task B" },
        ],
      }),
    );

    const formerTaskARow = fixture.querySelector('[data-task-id="a"]');
    formerTaskARow.browserOwnedDraft = "belongs to task A";

    root.render(
      createElement(TaskList, {
        tasks: [
          { id: "x", title: "Task X" },
          { id: "a", title: "Task A" },
          { id: "b", title: "Task B" },
        ],
      }),
    );

    const firstRow = fixture.querySelector("li");
    assertEqual(firstRow === formerTaskARow, true);
    assertEqual(firstRow.dataset.taskId, "x");
    assertEqual(firstRow.browserOwnedDraft, "belongs to task A");
  } finally {
    root.unmount();
    fixture.remove();
  }
});

run();
