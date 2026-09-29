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

test("update lifecycle receives previous values and sees updated DOM", () => {
  const fixture = createFixture();
  const root = createRoot(fixture);
  const observations = [];
  let probe;

  class Probe extends Component {
    constructor(props) {
      super(props);
      probe = this;
      this.state = { count: 0 };
    }

    componentDidUpdate(prevProps, prevState) {
      observations.push(
        [
          prevProps.label,
          prevState.count,
          this.props.label,
          this.state.count,
          fixture.textContent,
        ].join("|"),
      );
    }

    render() {
      return <p>{this.props.label}:{this.state.count}</p>;
    }
  }

  try {
    root.render(<Probe label="Before" />);
    probe.setState({ count: 1 });
    root.render(<Probe label="After" />);

    assertEqual(
      observations.join(","),
      "Before|0|Before|1|Before:1,Before|1|After|1|After:1",
    );
  } finally {
    root.unmount();
    fixture.remove();
  }
});

test("nested update lifecycles run child before parent", () => {
  const fixture = createFixture();
  const root = createRoot(fixture);
  const calls = [];

  class Child extends Component {
    componentDidUpdate() {
      calls.push(`child:${this.props.value}:${fixture.textContent}`);
    }

    render() {
      return <span>{this.props.value}</span>;
    }
  }

  class Parent extends Component {
    componentDidUpdate() {
      calls.push(`parent:${this.props.value}:${fixture.textContent}`);
    }

    render() {
      return (
        <section>
          <Child value={this.props.value} />
        </section>
      );
    }
  }

  try {
    root.render(<Parent value="one" />);
    root.render(<Parent value="two" />);

    assertEqual(calls.join(","), "child:two:two,parent:two:two");
  } finally {
    root.unmount();
    fixture.remove();
  }
});

await run();
