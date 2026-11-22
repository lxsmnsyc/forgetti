// One gate object shared by the throw cases. Components read `gate.left` and throw while it is above 0.
const gate = { left: 0 };

// Sets how many times the gate makes the component throw, and returns the gate.
export function armGate(left) {
  gate.left = left;
  return gate;
}

export function disarmGate() {
  gate.left = 0;
}
