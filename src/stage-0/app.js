export function mountTaskApp(container) {
  // Implementation
  if (!(container instanceof HTMLElement)) {
    throw new TypeError("mountTaskApp requires an HTMLElement container");
  }
  const form = document.createElement("form");
  form.dataset.taskForm = "";

  const input = document.createElement("input");
  input.dataset.taskInput = "";
  form.append(input);

  const summary = document.createElement("p");
  summary.dataset.taskSummary = "";
  summary.textContent = "0 of 0 completed";

  const list = document.createElement("ul");
  list.dataset.taskList = "";

  container.append(form, summary, list);

  return {
    destroy() {
      container.replaceChildren();
    },
  };
}
