import { logout } from "../../../lib/neuron-auth.mjs";

export async function POST(request: Request) {
  return logout(request);
}
