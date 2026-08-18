export function mountTaskApp(container) {
  if (!(container instanceof HTMLElement)) {
    throw new TypeError("mountTaskApp requires an HTMLElement container");
  }
  const tasks = [];
  let nextTaskId = 1;

  const form = document.createElement("form");
  form.dataset.taskForm = "";

  const error = document.createElement("p");
  error.dataset.taskError = "";
  error.hidden = true;

  const input = document.createElement("input");
  input.dataset.taskInput = "";
  form.append(input);

  const summary = document.createElement("p");
  summary.dataset.taskSummary = "";
  summary.textContent = "0 of 0 completed";

  const list = document.createElement("ul");
  list.dataset.taskList = "";

  container.append(form, error, summary, list);

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

    const titleNode = document.createElement("span");
    titleNode.dataset.taskTitle = "";
    titleNode.textContent = task.title;

    row.append(checkbox, titleNode);
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
    list.appendChild(row);
    updateSummary();

    input.value = "";
    input.focus();
  }
  form.addEventListener("submit", handleSubmit);

  return {
    destroy() {
      form.removeEventListener("submit", handleSubmit);
      container.replaceChildren();
    },
  };
}
