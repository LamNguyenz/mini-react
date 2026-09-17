import {
  assertEqual,
  run,
  test,
} from "../browser/harness.js";
import {
  createElement,
  createRoot,
} from "../../src/stage-3/runtime.js";

function createFixture() {
  const fixture = document.createElement("div");
  document.body.append(fixture);
  return fixture;
}

test("JSX creates descriptions for the Mini React runtime", () => {
  const fixture = createFixture();
  const root = createRoot(fixture);

  try {
    root.render(<p data-stage="3b">Lifecycle ready</p>);

    assertEqual(fixture.querySelector("p").textContent, "Lifecycle ready");
    assertEqual(fixture.querySelector("p").dataset.stage, "3b");
  } finally {
    root.unmount();
    fixture.remove();
  }
});

await run();
