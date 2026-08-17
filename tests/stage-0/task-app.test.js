import { assert, assertEqual, run, test } from "../browser/harness.js";
import { mountTaskApp } from "../../src/stage-0/app.js";

function mountFixture() {
  const fixture = document.createElement("div");
  document.body.append(fixture);
  const app = mountTaskApp(fixture);
  return {
    fixture,
    cleanup() {
      app.destroy();
      fixture.remove();
    },
  };
}

test("mounts the empty task interface", () => {
  const { fixture, cleanup } = mountFixture();
  try {
    assert(fixture.querySelector("[data-task-form]"), "task form is missing");
    assert(fixture.querySelector("[data-task-input]"), "task input is missing");
    assert(fixture.querySelector("[data-task-list]"), "task list is missing");
    assertEqual(
      fixture.querySelector("[data-task-summary]").textContent.trim(),
      "0 of 0 completed",
      "initial summary is incorrect",
    );
    assertEqual(fixture.querySelectorAll("[data-task-row]").length, 0);
  } finally {
    cleanup();
  }
});

test("rejects a non-element mount target", () => {
  let thrown;
  try {
    mountTaskApp(null);
  } catch (error) {
    thrown = error;
  }
  assert(thrown instanceof TypeError, "expected a TypeError");
  assertEqual(thrown.message, "mountTaskApp requires an HTMLElement container");
});

run();
