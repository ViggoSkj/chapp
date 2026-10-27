import { login } from "../../../lib/neuron-auth.mjs";

export async function POST(request: Request) {
  return login(request);
}
