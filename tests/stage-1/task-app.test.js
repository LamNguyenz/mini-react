import {
  assert,
  assertEqual,
  assertThrows,
  run,
  test,
} from "../browser/harness.js";
import { mountTaskApp } from "../../src/stage-1/app.js";

function mountFixture() {
  const fixture = document.createElement("div");
  document.body.append(fixture);
  const app = mountTaskApp(fixture);
  return {
    fixture,
    cleanup() {
      app.unmount();
      fixture.remove();
    },
  };
}

function taskRows(fixture) {
  return [...fixture.querySelectorAll("[data-task-row]")];
}

test("mounts the declarative empty task interface", () => {
  const { fixture, cleanup } = mountFixture();
  try {
    assert(fixture.querySelector("[data-task-form]"), "task form is missing");
    assert(fixture.querySelector("[data-task-input]"), "task input is missing");
    assert(fixture.querySelector("[data-task-submit]"), "submit button is missing");
    assert(
      fixture.querySelector('button[data-task-submit][type="submit"]'),
      "submit control must be a button",
    );
    assert(fixture.querySelector("[data-task-error]"), "task error is missing");
    assert(fixture.querySelector("[data-task-filters]"), "task filters are missing");
    assert(fixture.querySelector("[data-task-list]"), "task list is missing");
    assertEqual(
      fixture.querySelector("[data-task-summary]").textContent,
      "0 of 0 completed",
    );
    assertEqual(taskRows(fixture).length, 0);
    assertEqual(fixture.querySelectorAll('[aria-pressed="true"]').length, 1);
  } finally {
    cleanup();
  }
});

test("rejects a non-element mount target", () => {
  assertThrows(
    () => mountTaskApp(null),
    TypeError,
    "mountTaskApp requires an HTMLElement container",
  );
});

run();
