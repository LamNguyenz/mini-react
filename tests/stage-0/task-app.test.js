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

function submitTitle(fixture, title) {
  const input = fixture.querySelector("[data-task-input]");
  input.value = title;
  fixture.querySelector("[data-task-form]").dispatchEvent(
    new SubmitEvent("submit", { bubbles: true, cancelable: true }),
  );
}

function taskRows(fixture) {
  return [...fixture.querySelectorAll("[data-task-row]")];
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

test("submitting a title appends an active task", () => {
  const { fixture, cleanup } = mountFixture();
  try {
    submitTitle(fixture, "Read React source");
    const rows = taskRows(fixture);
    assertEqual(rows.length, 1);
    assertEqual(rows[0].querySelector("[data-task-title]").textContent, "Read React source");
    assertEqual(rows[0].dataset.completed, "false");
    assertEqual(rows[0].querySelector("[data-task-toggle]").checked, false);
    assertEqual(fixture.querySelector("[data-task-summary]").textContent, "0 of 1 completed");
    assertEqual(fixture.querySelector("[data-task-input]").value, "");
  } finally {
    cleanup();
  }
});

test("blank input leaves state and DOM unchanged", () => {
  const { fixture, cleanup } = mountFixture();
  try {
    submitTitle(fixture, "   ");
    assertEqual(taskRows(fixture).length, 0);
    const error = fixture.querySelector("[data-task-error]");
    assert(error, "validation message is missing");
    assertEqual(error.hidden, false);
    assertEqual(error.textContent, "Enter a task.");
    assertEqual(fixture.querySelector("[data-task-summary]").textContent, "0 of 0 completed");
  } finally {
    cleanup();
  }
});

run();
