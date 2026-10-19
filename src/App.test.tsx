import { render, screen } from '@testing-library/react';
import App from './App';

// Nothing on the other side of the bridge: what a person sees on a first
// launch, before any folder is chosen.
vi.mock('./data/host', async (orig) => {
  const real = await orig<typeof import('./data/host')>();
  return {
    ...real,
    readRememberedFolder: () => null,
    readMirroredFolder: async () => null,
  };
});

describe('App', () => {
  it('asks for a folder on a first launch, with no picture spent', async () => {
    render(<App />);
    expect(await screen.findByRole('button', { name: /choose my folder|choisir mon dossier|elegir mi carpeta/i })).toBeInTheDocument();
  });
});
