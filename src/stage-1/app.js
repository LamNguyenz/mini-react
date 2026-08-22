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

  function handleSubmit(event) {
    event.preventDefault();

    const input = event.currentTarget.querySelector("[data-task-input]");
    const title = input.value.trim();

    if (!title) {
      errorMessage = "Enter a task.";
      renderApp();
      return;
    }

    const task = {
      id: nextTaskId++,
      title,
      completed: false,
    };

    tasks.push(task);
    errorMessage = "";
    renderApp();
  }

  function renderApp() {
    root.render(
      createElement(TaskApp, {
        tasks,
        activeFilter,
        errorMessage,
        onSubmit: handleSubmit,
      }),
    );
  }
}

function TaskApp({ tasks, activeFilter, errorMessage, onSubmit }) {
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
      onSubmit,
    },
    input,
    submitButton,
  );

  const error = createElement(
    "p",
    {
      hidden: errorMessage === "",
      "data-task-error": "",
    },
    errorMessage,
  );

  const filterOptions = [
    { value: "all", label: "All" },
    { value: "active", label: "Active" },
    { value: "completed", label: "Completed" },
  ];
  const filterButtons = filterOptions.map((option) =>
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
    ...filterButtons,
  );

  const completedCount = tasks.filter((task) => task.completed).length;
  const summaryContent = `${completedCount} of ${tasks.length} completed`;
  const summary = createElement(
    "span",
    {
      "data-task-summary": "",
    },
    summaryContent,
  );

  const taskRows = tasks.map((task) => createElement(TaskRow, { task }));
  const list = createElement(
    "ul",
    {
      "data-task-list": "",
    },
    taskRows,
  );

  return createElement("div", null, form, error, filters, summary, list);
}

function TaskRow({ task }) {
  const inputId = `task-${task.id}`;
  const checkbox = createElement("input", {
    type: "checkbox",
    id: inputId,
    "data-task-toggle": "",
    checked: task.completed,
  });
  const titleNode = createElement(
    "label",
    {
      htmlFor: inputId,
      "data-task-title": "",
    },
    checkbox,
    task.title,
  );
  const row = createElement(
    "li",
    {
      "data-task-row": "",
      "data-task-id": String(task.id),
      "data-completed": String(task.completed),
    },
    titleNode,
  );
  return row;
}
