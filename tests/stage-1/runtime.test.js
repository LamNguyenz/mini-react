import {
  assertEqual,
  assertThrows,
  run,
  test,
} from "../browser/harness.js";
import { createRoot } from "../../src/stage-1/runtime.js";

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

run();
