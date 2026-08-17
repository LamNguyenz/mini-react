const tests = [];

export function test(name, callback) {
  tests.push({ name, callback });
}

export function assert(condition, message) {
  if (!condition) throw new Error(message);
}

export function assertEqual(actual, expected, message = "Values differ") {
  if (!Object.is(actual, expected)) {
    throw new Error(
      `${message}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`,
    );
  }
}

export async function run() {
  const results = document.querySelector("[data-test-results]");
  let failures = 0;

  for (const { name, callback } of tests) {
    const item = document.createElement("li");
    try {
      await callback();
      item.textContent = `PASS: ${name}`;
      item.dataset.result = "pass";
    } catch (error) {
      failures += 1;
      item.textContent = `FAIL: ${name} — ${error.message}`;
      item.dataset.result = "fail";
      console.error(error);
    }
    results.append(item);
  }

  document.body.dataset.testStatus = failures === 0 ? "passed" : "failed";
  document.querySelector("[data-test-summary]").textContent =
    `${tests.length - failures}/${tests.length} tests passed`;
}
