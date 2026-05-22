export const resolveArtist = (input: any): string => {
  if (!input) return 'Unknown Artist';

  const valueCandidates: Array<unknown> = [
    (input as any).artist,
    (input as any).artistName,
    (input as any).primaryArtists,
    (input as any).singers,
    (input as any).metadata?.artist,
    (input as any).owner?.display_name,
    (input as any).createdBy?.fullName,
  ];

  // If artists array exists (Mavrixfy or others)
  const artistsField: unknown = (input as any).artists || (input as any).track?.artists;
  if (Array.isArray(artistsField)) {
    const names = (artistsField as any[]).reduce<string[]>((acc, a) => {
      const name = typeof a === 'string' ? a : (a && (a as any).name) || '';
      if (typeof name === 'string' && name.trim().length > 0) {
        acc.push(name);
      }
      return acc;
    }, []);
    if (names.length > 0) return names.join(', ');
  }

  // JioSaavn: artistMap.primary is an array of { name }
  const artistMap = (input as any).artistMap || (input as any).artists;
  if (artistMap && Array.isArray((artistMap as any).primary)) {
    const names = ((artistMap as any).primary as any[]).reduce<string[]>((acc, a) => {
      const n = a?.name;
      if (typeof n === 'string' && n.trim().length > 0) {
        acc.push(n);
      }
      return acc;
    }, []);
    if (names.length > 0) return names.join(', ');
  }

  for (const candidate of valueCandidates) {
    if (typeof candidate === 'string' && candidate.trim().length > 0) {
      return candidate.trim();
    }
  }

  return 'Unknown Artist';
};

export default resolveArtist;



