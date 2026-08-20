export function mountTaskApp(container) {
  if (!(container instanceof HTMLElement)) {
    throw new TypeError("mountTaskApp requires an HTMLElement container");
  }
  const tasks = [];
  let nextTaskId = 1;
  let activeFilter = "all";

  const form = document.createElement("form");
  form.dataset.taskForm = "";

  const error = document.createElement("p");
  error.dataset.taskError = "";
  error.hidden = true;

  const input = document.createElement("input");
  input.dataset.taskInput = "";
  form.append(input);

  const submitButton = document.createElement("button");
  submitButton.type = "submit";
  submitButton.dataset.taskSubmit = "";
  submitButton.textContent = "Add task";
  form.append(submitButton);

  const summary = document.createElement("p");
  summary.dataset.taskSummary = "";
  summary.textContent = "0 of 0 completed";

  const list = document.createElement("ul");
  list.dataset.taskList = "";

  const filters = document.createElement("div");
  filters.dataset.taskFilters = "";

  const filterOptions = [
    { value: "all", label: "All" },
    { value: "active", label: "Active" },
    { value: "completed", label: "Completed" },
  ];

  for (const option of filterOptions) {
    const button = document.createElement("button");

    button.type = "button";
    button.dataset.filter = option.value;
    button.textContent = option.label;
    button.setAttribute("aria-pressed", String(option.value === activeFilter));

    filters.append(button);
  }

  container.append(form, error, filters, summary, list);

  function updateSummary() {
    const countComplete = tasks.filter((task) => task.completed).length;
    summary.textContent = `${countComplete} of ${tasks.length} completed`;
  }

  function createTaskRow(task) {
    const row = document.createElement("li");
    row.dataset.taskRow = "";
    row.dataset.taskId = String(task.id);
    row.dataset.completed = String(task.completed);

    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.dataset.taskToggle = "";
    checkbox.id = `task-${task.id}`;

    const titleNode = document.createElement("label");
    titleNode.htmlFor = checkbox.id;
    titleNode.dataset.taskTitle = "";
    titleNode.append(checkbox, task.title);

    row.append(titleNode);
    return row;
  }

  function createTask(title) {
    const task = {
      id: nextTaskId++,
      title,
      completed: false,
    };
    tasks.push(task);
    return task;
  }

  function handleSubmit(event) {
    event.preventDefault();

    const title = input.value.trim();
    if (title === "") {
      error.textContent = "Enter a task.";
      error.hidden = false;
      return;
    }

    error.textContent = "";
    error.hidden = true;
    const task = createTask(title);
    const row = createTaskRow(task);

    row.hidden = !taskMatchesFilter(task);
    list.appendChild(row);
    updateSummary();

    input.value = "";
    input.focus();
  }

  const validFilters = ["all", "completed", "active"];
  function taskMatchesFilter(task) {
    if (activeFilter === "all") return true;
    if (activeFilter === "active") return !task.completed;
    return task.completed;
  }

  function handleTaskChange(event) {
    const checkbox = event.target;
    if (!checkbox.matches("[data-task-toggle]")) return;

    const row = checkbox.closest("[data-task-row]");
    const taskId = row.dataset.taskId;
    const task = getTaskById(taskId);

    task.completed = checkbox.checked;
    row.dataset.completed = String(task.completed);
    row.hidden = !taskMatchesFilter(task);
    updateSummary();
  }

  function getTaskById(taskId) {
    const task = tasks.find((task) => task.id === Number(taskId));
    if (!task) {
      throw new Error(`Unknown task id: ${taskId}`);
    }
    return task;
  }

  function handleFilterClick(event) {
    const button = event.target;
    if (!button.matches("[data-filter]")) return;

    const filter = button.dataset.filter;

    if (!validFilters.includes(filter)) {
      throw new Error(`Unknown filter: ${filter}`);
    }

    activeFilter = filter;

    for (const filterButton of filters.querySelectorAll("[data-filter]")) {
      filterButton.setAttribute(
        "aria-pressed",
        String(filterButton.dataset.filter === activeFilter),
      );
    }

    for (const row of list.querySelectorAll("[data-task-row]")) {
      const taskId = Number(row.dataset.taskId);
      const task = getTaskById(taskId);

      row.hidden = !taskMatchesFilter(task);
    }
  }

  form.addEventListener("submit", handleSubmit);
  list.addEventListener("change", handleTaskChange);
  filters.addEventListener("click", handleFilterClick);

  return {
    destroy() {
      form.removeEventListener("submit", handleSubmit);
      list.removeEventListener("change", handleTaskChange);
      filters.removeEventListener("click", handleFilterClick);
      container.replaceChildren();
    },
  };
}
