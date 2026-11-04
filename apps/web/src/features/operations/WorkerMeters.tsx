import { ReadingsWorkspace } from "../business/ReadingsWorkspace";
export function WorkerMeters({ userId }: { token: string; userId: string }) {
  return (
    <article
      className="workspace-surface worker-meters"
      aria-label="Мои показания"
    >
      <ReadingsWorkspace workerId={userId} />
    </article>
  );
}
