import { Thumb } from './Thumb';

/** The light behind the glass: soft colour fields, and the latest picture blurred when there is one. */
export function Ambient({ path }: { path?: string }) {
  return (
    <div className="ambient" aria-hidden>
      <span className="blob a" />
      <span className="blob b" />
      {path && <div className="ambient-photo"><Thumb path={path} alt="" /></div>}
    </div>
  );
}
