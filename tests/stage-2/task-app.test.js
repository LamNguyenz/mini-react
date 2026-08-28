import {
  assert,
  assertEqual,
  assertThrows,
  run,
  test,
} from "../browser/harness.js";
import { mountTaskApp } from "../../src/stage-2/app.js";

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

test("toggling a task rerenders completion and the derived summary", () => {
  const { fixture, cleanup } = mountFixture();
  try {
    submitTitle(fixture, "Render descriptions");
    submitTitle(fixture, "Observe identity");
    taskRows(fixture)[0].querySelector("[data-task-toggle]").click();

    const rowsAfterRender = taskRows(fixture);
    assertEqual(rowsAfterRender[0].dataset.completed, "true");
    assertEqual(
      rowsAfterRender[0].querySelector("[data-task-toggle]").checked,
      true,
    );
    assertEqual(
      fixture.querySelector("[data-task-summary]").textContent,
      "1 of 2 completed",
    );
  } finally {
    cleanup();
  }
});

test("filters and completion derive a synchronized next description", () => {
  const { fixture, cleanup } = mountFixture();
  try {
    submitTitle(fixture, "Active task");
    submitTitle(fixture, "Completed task");
    taskRows(fixture)[1].querySelector("[data-task-toggle]").click();

    fixture.querySelector('[data-filter="active"]').click();
    let rows = taskRows(fixture);
    assertEqual(rows[0].hidden, false);
    assertEqual(rows[1].hidden, true);
    assertEqual(
      fixture
        .querySelector('[data-filter="active"]')
        .getAttribute("aria-pressed"),
      "true",
    );

    fixture.querySelector('[data-filter="completed"]').click();
    rows = taskRows(fixture);
    assertEqual(rows[0].hidden, true);
    assertEqual(rows[1].hidden, false);
    assertEqual(
      fixture
        .querySelector('[data-filter="completed"]')
        .getAttribute("aria-pressed"),
      "true",
    );
    assertEqual(
      fixture.querySelector("[data-task-summary]").textContent,
      "1 of 2 completed",
    );

    fixture.querySelector('[data-filter="all"]').click();
    rows = taskRows(fixture);
    assertEqual(rows[0].hidden, false);
    assertEqual(rows[1].hidden, false);
    assertEqual(fixture.querySelectorAll('[aria-pressed="true"]').length, 1);
  } finally {
    cleanup();
  }
});

test("a declarative rerender preserves DOM identity, draft, and focus", () => {
  const { fixture, cleanup } = mountFixture();
  try {
    const firstInput = fixture.querySelector("[data-task-input]");
    firstInput.value = "Uncommitted draft";
    firstInput.focus();

    fixture.querySelector('[data-filter="active"]').click();
    const nextInput = fixture.querySelector("[data-task-input]");

    assertEqual(firstInput === nextInput, true);
    assertEqual(firstInput.isConnected, true);
    assertEqual(nextInput.value, "Uncommitted draft");
    assertEqual(document.activeElement === nextInput, true);
  } finally {
    cleanup();
  }
});

run();
