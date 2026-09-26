import {
  assertEqual,
  run,
  test,
} from "../browser/harness.js";
import {
  Component,
  createElement,
  createRoot,
} from "../../src/stage-3/runtime.js";

function createFixture() {
  const fixture = document.createElement("div");
  document.body.append(fixture);
  return fixture;
}

test("JSX creates descriptions for the Mini React runtime", () => {
  const fixture = createFixture();
  const root = createRoot(fixture);

  try {
    root.render(<p data-stage="3b">Lifecycle ready</p>);

    assertEqual(fixture.querySelector("p").textContent, "Lifecycle ready");
    assertEqual(fixture.querySelector("p").dataset.stage, "3b");
  } finally {
    root.unmount();
    fixture.remove();
  }
});

test("mount lifecycles see connected DOM and run child before parent", () => {
  const fixture = createFixture();
  const root = createRoot(fixture);
  const calls = [];

  class Child extends Component {
    componentDidMount() {
      calls.push(`child:${fixture.contains(fixture.querySelector("[data-child]"))}`);
    }

    render() {
      return <span data-child="">Child</span>;
    }
  }

  class Parent extends Component {
    componentDidMount() {
      calls.push(`parent:${fixture.contains(fixture.querySelector("[data-parent]"))}`);
    }

    render() {
      return (
        <section data-parent="">
          <Child />
        </section>
      );
    }
  }

  try {
    root.render(<Parent />);
    assertEqual(calls.join(","), "child:true,parent:true");
  } finally {
    root.unmount();
    fixture.remove();
  }
});

test("keyed movement does not mount a retained component again", () => {
  const fixture = createFixture();
  const root = createRoot(fixture);
  let mounts = 0;

  class Row extends Component {
    componentDidMount() {
      mounts += 1;
    }

    render() {
      return <li data-id={this.props.id}>{this.props.id}</li>;
    }
  }

  try {
    root.render(
      <ul>
        <Row key="a" id="a" />
        <Row key="b" id="b" />
      </ul>,
    );
    const rowA = fixture.querySelector('[data-id="a"]');

    root.render(
      <ul>
        <Row key="b" id="b" />
        <Row key="a" id="a" />
      </ul>,
    );

    assertEqual(mounts, 2);
    assertEqual(fixture.querySelectorAll("li")[1], rowA);
  } finally {
    root.unmount();
    fixture.remove();
  }
});

await run();
