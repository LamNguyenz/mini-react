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

test("toggling a task synchronizes its row and the derived summary", () => {
  const { fixture, cleanup } = mountFixture();
  try {
    submitTitle(fixture, "Trace createRoot");
    submitTitle(fixture, "Trace commitRoot");
    const [firstRow] = taskRows(fixture);
    firstRow.querySelector("[data-task-toggle]").click();

    assertEqual(firstRow.dataset.completed, "true");
    assertEqual(firstRow.querySelector("[data-task-toggle]").checked, true);
    assertEqual(fixture.querySelector("[data-task-summary]").textContent, "1 of 2 completed");
  } finally {
    cleanup();
  }
});

test("filters stay synchronized when completion changes", () => {
  const { fixture, cleanup } = mountFixture();
  try {
    submitTitle(fixture, "Read beginWork");
    submitTitle(fixture, "Read completeWork");
    const [firstRow, secondRow] = taskRows(fixture);

    fixture.querySelector('[data-filter="active"]').click();
    firstRow.querySelector("[data-task-toggle]").click();
    assertEqual(firstRow.hidden, true, "completed row should leave the active view");
    assertEqual(secondRow.hidden, false, "active row should remain visible");
    assertEqual(fixture.querySelector("[data-task-summary]").textContent, "1 of 2 completed");

    fixture.querySelector('[data-filter="completed"]').click();
    assertEqual(firstRow.hidden, false, "completed row should be visible");
    assertEqual(secondRow.hidden, true, "active row should be hidden");
    assertEqual(
      fixture.querySelector('[data-filter="completed"]').getAttribute("aria-pressed"),
      "true",
    );

    fixture.querySelector('[data-filter="all"]').click();
    assertEqual(firstRow.hidden, false);
    assertEqual(secondRow.hidden, false);
    assertEqual(fixture.querySelectorAll('[aria-pressed="true"]').length, 1);
  } finally {
    cleanup();
  }
});

run();
