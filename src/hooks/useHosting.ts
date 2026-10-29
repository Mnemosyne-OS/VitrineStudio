import { useCallback, useEffect, useRef, useState } from 'react';
import { addSiteDomain, readHosting, readTraffic, removeSiteDomain, type HostingState, type Traffic } from '../data/host';
import { describeError } from '../components/errors';

export type Shown = { key: string; raw?: string };
export type Loadable<T> = { kind: 'idle' } | { kind: 'loading' } | { kind: 'error'; error: Shown } | { kind: 'ready'; data: T };

/** The visit counts' spans, in days. */
export const TRAFFIC_SPANS = [7, 30, 90] as const;
export type TrafficSpan = (typeof TRAFFIC_SPANS)[number];

/**
 * Site › Online's two reads (doc 145 §10.14): the project's addresses, and
 * its visits. The addresses are read once the studio opens connected and
 * published (the site bar shows her own domain once Vercel says it points
 * there, §10.20), then each time the screen opens; the visits only on the
 * screen. A domain added or removed reads the addresses again. Each read has
 * its own state, so a refused visit count never hides the addresses.
 */
export function useHosting(project: string, open: boolean, connected: boolean, published: boolean) {
  const [hosting, setHosting] = useState<Loadable<HostingState>>({ kind: 'idle' });
  const [traffic, setTraffic] = useState<Loadable<Traffic>>({ kind: 'idle' });
  const [span, setSpan] = useState<TrafficSpan>(30);
  const [busyDomain, setBusyDomain] = useState<string | null>(null);
  const [domainError, setDomainError] = useState<Shown | null>(null);
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => { alive.current = false; };
  }, []);
  // A read that comes back after another one started is dropped: the newer one speaks.
  const hostingRun = useRef(0);
  const trafficRun = useRef(0);

  const refresh = useCallback(async () => {
    if (!project) return;
    const run = ++hostingRun.current;
    setHosting({ kind: 'loading' });
    try {
      const data = await readHosting(project);
      if (alive.current && run === hostingRun.current) setHosting({ kind: 'ready', data });
    } catch (err) {
      console.warn('[vitrine-studio] hosting unreadable:', err);
      if (alive.current && run === hostingRun.current) setHosting({ kind: 'error', error: describeError(err) });
    }
  }, [project]);

  const loadTraffic = useCallback(async (days: TrafficSpan) => {
    if (!project) return;
    const run = ++trafficRun.current;
    setTraffic({ kind: 'loading' });
    try {
      const data = await readTraffic(project, days);
      if (alive.current && run === trafficRun.current) setTraffic({ kind: 'ready', data });
    } catch (err) {
      console.warn('[vitrine-studio] visits unreadable:', err);
      if (alive.current && run === trafficRun.current) setTraffic({ kind: 'error', error: describeError(err) });
    }
  }, [project]);

  const readOnce = useRef(false);
  useEffect(() => {
    if (!connected || !published) return;
    if (!open && readOnce.current) return;
    readOnce.current = true;
    void refresh();
  }, [open, connected, published, refresh]);
  useEffect(() => {
    if (!open || !connected || !published) return;
    void loadTraffic(span);
  }, [open, connected, published, span, loadTraffic]);

  /** A domain attached or detached, then the addresses read again: what Vercel says now. */
  const change = async (domain: string, add: boolean): Promise<boolean> => {
    setBusyDomain(domain);
    setDomainError(null);
    try {
      await (add ? addSiteDomain(project, domain) : removeSiteDomain(project, domain));
      await refresh();
      return true;
    } catch (err) {
      console.warn('[vitrine-studio] domain not changed:', domain, err);
      if (alive.current) setDomainError(describeError(err));
      return false;
    } finally {
      if (alive.current) setBusyDomain(null);
    }
  };

  // Her own domains Vercel says point at the site: the bar's address once there is one.
  const liveDomains = hosting.kind === 'ready' ? hosting.data.domains.filter((d) => d.verified && d.configured === true).map((d) => d.name) : [];

  return {
    hosting, traffic, span, setSpan, refresh, busyDomain, domainError, liveDomains,
    addDomain: (d: string) => change(d, true),
    removeDomain: (d: string) => change(d, false),
  };
}
