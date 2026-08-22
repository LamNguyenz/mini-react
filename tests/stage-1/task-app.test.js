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

function submitTitle(fixture, title) {
  const input = fixture.querySelector("[data-task-input]");
  const form = fixture.querySelector("[data-task-form]");
  input.value = title;
  form.addEventListener("submit", (event) => event.preventDefault(), {
    once: true,
  });
  form.dispatchEvent(
    new SubmitEvent("submit", { bubbles: true, cancelable: true }),
  );
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

test("submitting a title rerenders one active task", () => {
  const { fixture, cleanup } = mountFixture();
  try {
    submitTitle(fixture, "Describe the UI");
    const rows = taskRows(fixture);
    assertEqual(rows.length, 1);
    assertEqual(rows[0].dataset.taskId, "1");
    assertEqual(
      rows[0].querySelector("[data-task-title]").textContent,
      "Describe the UI",
    );
    assertEqual(rows[0].dataset.completed, "false");
    assertEqual(rows[0].querySelector("[data-task-toggle]").checked, false);
    assertEqual(
      fixture.querySelector("[data-task-summary]").textContent,
      "0 of 1 completed",
    );
    assertEqual(fixture.querySelector("[data-task-input]").value, "");
  } finally {
    cleanup();
  }
});

test("clicking the visible submit control adds a task", () => {
  const { fixture, cleanup } = mountFixture();
  try {
    fixture.querySelector("[data-task-input]").value =
      "Use declarative controls";
    const form = fixture.querySelector("[data-task-form]");
    form.addEventListener("submit", (event) => event.preventDefault(), {
      once: true,
    });
    fixture.querySelector('button[type="submit"]').click();
    assertEqual(taskRows(fixture).length, 1);
  } finally {
    cleanup();
  }
});

test("blank input rerenders a visible validation error without a task", () => {
  const { fixture, cleanup } = mountFixture();
  try {
    submitTitle(fixture, "   ");
    assertEqual(taskRows(fixture).length, 0);
    const error = fixture.querySelector("[data-task-error]");
    assertEqual(error.hidden, false);
    assertEqual(error.textContent, "Enter a task.");
    assertEqual(
      fixture.querySelector("[data-task-summary]").textContent,
      "0 of 0 completed",
    );
  } finally {
    cleanup();
  }
});

run();
