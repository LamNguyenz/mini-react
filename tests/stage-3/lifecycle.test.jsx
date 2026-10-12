import { assertEqual, assertThrows, run, test } from "../browser/harness.js";
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
      calls.push(
        `child:${fixture.contains(fixture.querySelector("[data-child]"))}`,
      );
    }

    render() {
      return <span data-child="">Child</span>;
    }
  }

  class Parent extends Component {
    componentDidMount() {
      calls.push(
        `parent:${fixture.contains(fixture.querySelector("[data-parent]"))}`,
      );
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
      return (
        <p>
          {this.props.label}:{this.state.count}
        </p>
      );
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

test("lifecycle state requests wait for one follow-up render", () => {
  const fixture = createFixture();
  const root = createRoot(fixture);
  const calls = [];
  let childRenders = 0;
  let parentRenders = 0;

  function recordCalls(item) {
    calls.push(item);
  }

  class Child extends Component {
    constructor(props) {
      super(props);
      this.state = { ready: false };
    }

    componentDidMount() {
      recordCalls("child mount start");
      this.setState({ ready: true });
      recordCalls("child mount end");
    }

    componentDidUpdate() {
      recordCalls("child update");
    }

    render() {
      childRenders += 1;
      return <span>{String(this.state.ready)}</span>;
    }
  }

  class Parent extends Component {
    constructor(props) {
      super(props);
      this.state = { ready: false };
    }

    componentDidMount() {
      recordCalls("parent mount start");
      this.setState({ ready: true });
      recordCalls("parent mount end");
    }

    componentDidUpdate() {
      recordCalls("parent update");
    }

    render() {
      parentRenders += 1;
      return (
        <section data-parent-ready={this.state.ready}>
          <Child />
        </section>
      );
    }
  }

  try {
    root.render(<Parent />);

    assertEqual(
      calls.join(","),
      "child mount start,child mount end,parent mount start,parent mount end,child update,parent update",
    );
    assertEqual(childRenders, 2);
    assertEqual(parentRenders, 2);
    assertEqual(fixture.querySelector("section").dataset.parentReady, "true");
    assertEqual(fixture.querySelector("span").textContent, "true");
  } finally {
    root.unmount();
    fixture.remove();
  }
});

test("unmount runs parent before child while DOM is connected", () => {
  const fixture = createFixture();
  const root = createRoot(fixture);
  const calls = [];
  const blockedMessages = [];

  class Child extends Component {
    componentWillUnmount() {
      calls.push(`child:${fixture.contains(fixture.querySelector("[data-child]"))}`);
      blockedMessages.push(
        assertThrows(
          () => this.setState({ removed: true }),
          Error,
          "Cannot update an unmounted component",
        ).message,
      );
    }

    render() {
      return <span data-child="">Child</span>;
    }
  }

  class Parent extends Component {
    componentWillUnmount() {
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
    root.unmount();

    assertEqual(calls.join(","), "parent:true,child:true");
    assertEqual(blockedMessages.length, 1);
    assertEqual(fixture.children.length, 0);
  } finally {
    root.unmount();
    fixture.remove();
  }
});

test("replacement cleans the old component before disconnecting its DOM", () => {
  const fixture = createFixture();
  const root = createRoot(fixture);
  const calls = [];
  let oldDom;

  class Probe extends Component {
    componentWillUnmount() {
      calls.push(`${oldDom.isConnected}:${fixture.textContent}`);
    }

    render() {
      return <span>Before</span>;
    }
  }

  try {
    root.render(<Probe />);
    oldDom = fixture.querySelector("span");

    root.render(<section>After</section>);

    assertEqual(calls.join(","), "true:Before");
    assertEqual(oldDom.isConnected, false);
    assertEqual(fixture.querySelector("section").textContent, "After");

    root.unmount();
    assertEqual(calls.length, 1);
  } finally {
    root.unmount();
    fixture.remove();
  }
});

test("deleting a keyed component cleans it once and retains its sibling", () => {
  const fixture = createFixture();
  const root = createRoot(fixture);
  const cleanup = [];
  const nodes = new Map();

  class Probe extends Component {
    componentWillUnmount() {
      cleanup.push(`${this.props.id}:${nodes.get(this.props.id).isConnected}`);
    }

    render() {
      return <span data-id={this.props.id}>{this.props.id}</span>;
    }
  }

  try {
    root.render(
      <div>
        <Probe key="a" id="a" />
        <Probe key="b" id="b" />
      </div>,
    );
    nodes.set("a", fixture.querySelector('[data-id="a"]'));
    nodes.set("b", fixture.querySelector('[data-id="b"]'));

    root.render(
      <div>
        <Probe key="b" id="b" />
      </div>,
    );

    assertEqual(cleanup.join(","), "a:true");
    assertEqual(nodes.get("a").isConnected, false);
    assertEqual(fixture.querySelector('[data-id="b"]'), nodes.get("b"));
    assertEqual(nodes.get("b").isConnected, true);

    root.unmount();
    assertEqual(cleanup.join(","), "a:true,b:true");
    root.unmount();
    assertEqual(cleanup.length, 2);
  } finally {
    root.unmount();
    fixture.remove();
  }
});

test("a lifecycle error propagates without trapping later root work", () => {
  const fixture = createFixture();
  const root = createRoot(fixture);
  let staleCallbackRuns = 0;

  class Broken extends Component {
    componentDidMount() {
      throw new Error("mount failed");
    }

    render() {
      return <span>Broken</span>;
    }
  }

  class StaleSibling extends Component {
    componentDidMount() {
      staleCallbackRuns += 1;
    }

    render() {
      return <span>Stale</span>;
    }
  }

  try {
    assertThrows(
      () =>
        root.render(
          <div>
            <Broken />
            <StaleSibling />
          </div>,
        ),
      Error,
      "mount failed",
    );

    root.render(<p>Recovered</p>);

    assertEqual(staleCallbackRuns, 0);
    assertEqual(fixture.textContent, "Recovered");
  } finally {
    root.unmount();
    fixture.remove();
  }
});

await run();
