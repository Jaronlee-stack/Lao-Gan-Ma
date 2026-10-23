/**
 * Turn thrown errors into copy a person can act on. The API's json() helper
 * throws `Error("<status> <statusText>")`; network failures throw TypeError.
 * Never show a raw stringified exception to the user.
 */
export interface FriendlyError {
  title: string;
  detail: string;
}

export function friendlyError(e: unknown): FriendlyError {
  const raw = e instanceof Error ? e.message : String(e);

  // fetch() network failure (backend down, proxy not reachable).
  if (e instanceof TypeError || /failed to fetch|networkerror/i.test(raw)) {
    return {
      title: "Can't reach the agent",
      detail:
        "The backend isn't responding. Make sure it's running on port 8000, then try again.",
    };
  }

  const status = Number(raw.match(/^(\d{3})\b/)?.[1]);
  if (status === 404) {
    return { title: "Not found", detail: "That plan no longer exists. Generate a new one to continue." };
  }
  if (status === 422) {
    return { title: "Check your input", detail: "The idea couldn't be understood. Add a little more detail and try again." };
  }
  if (status && status >= 500) {
    return { title: "The agent hit a snag", detail: "Something broke while planning. Give it another try in a moment." };
  }

  return { title: "Something went wrong", detail: "The request didn't go through. Try again, and check the backend if it keeps happening." };
}
