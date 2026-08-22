import { createElement, createRoot } from "./runtime.js";

export function mountTaskApp(container) {
  if (!(container instanceof HTMLElement)) {
    throw new TypeError("mountTaskApp requires an HTMLElement container");
  }
  const tasks = [];
  let activeFilter = "all";
  let nextTaskId = 1;
  let errorMessage = "";

  const root = createRoot(container);
  renderApp();
  return {
    unmount() {
      root.unmount();
    },
  };

  function renderApp() {
    root.render(createElement(TaskApp, { tasks, activeFilter, errorMessage }));
  }
}

function TaskApp({ tasks, activeFilter, errorMessage }) {
  const input = createElement("input", {
    "data-task-input": "",
  });
  const submitButton = createElement(
    "button",
    {
      type: "submit",
      "data-task-submit": "",
    },
    "Add task",
  );
  const form = createElement(
    "form",
    {
      "data-task-form": "",
    },
    input,
    submitButton,
  );

  const error = createElement("p", {
    hidden: errorMessage === "",
    "data-task-error": "",
  });

  const filterOptions = [
    { value: "all", label: "All" },
    { value: "active", label: "Active" },
    { value: "completed", label: "Completed" },
  ];
  const buttons = filterOptions.map((option) =>
    createElement(
      "button",
      {
        type: "button",
        "data-filter": option.value,
        "aria-pressed": String(option.value === activeFilter),
      },
      option.label,
    ),
  );
  const filters = createElement(
    "div",
    {
      "data-task-filters": "",
    },
    ...buttons,
  );

  const summary = createElement(
    "span",
    {
      "data-task-summary": "",
    },
    "0 of 0 completed",
  );

  const list = createElement("ul", {
    "data-task-list": "",
  });

  return createElement("div", null, form, error, filters, summary, list);
}
