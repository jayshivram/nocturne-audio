import type { Track, Album, Artist, EQPreset } from './types';

// Mock tracks for initial display when library is empty
export const MOCK_TRACKS: Track[] = [
  {
    id: '1',
    title: 'Midnight Moonlight',
    artist: 'Lofi Girl',
    album: 'Lofi Hip Hop Radio',
    duration: '3:42',
    durationMs: 222000,
    coverUrl: 'https://picsum.photos/seed/music1/400/400',
    color: '#8B5CF6',
    filePath: '',
    playCount: 0,
    addedAt: Date.now(),
  },
  {
    id: '2',
    title: 'Celestial Echoes',
    artist: 'Etheric Drift',
    album: 'Stellar Journeys',
    duration: '5:18',
    durationMs: 318000,
    coverUrl: 'https://picsum.photos/seed/music2/400/400',
    color: '#3B82F6',
    filePath: '',
    playCount: 0,
    addedAt: Date.now(),
  },
  {
    id: '3',
    title: 'Analog Dreams',
    artist: 'Vinyl Voyager',
    album: 'Retro Waves',
    duration: '4:05',
    durationMs: 245000,
    coverUrl: 'https://picsum.photos/seed/music3/400/400',
    color: '#EC4899',
    filePath: '',
    playCount: 0,
    addedAt: Date.now(),
  },
  {
    id: '4',
    title: 'Electric Pulse',
    artist: 'Neon Knights',
    album: 'Cyber City',
    duration: '2:59',
    durationMs: 179000,
    coverUrl: 'https://picsum.photos/seed/music4/400/400',
    color: '#10B981',
    filePath: '',
    playCount: 0,
    addedAt: Date.now(),
  },
  {
    id: '5',
    title: 'Forest Whisper',
    artist: 'Nature Bloom',
    album: 'Organic Textures',
    duration: '6:22',
    durationMs: 382000,
    coverUrl: 'https://picsum.photos/seed/music5/400/400',
    color: '#F59E0B',
    filePath: '',
    playCount: 0,
    addedAt: Date.now(),
  },
  {
    id: '6',
    title: 'Deep Space',
    artist: 'Cosmic Void',
    album: 'Infinity',
    duration: '7:10',
    durationMs: 430000,
    coverUrl: 'https://picsum.photos/seed/music6/400/400',
    color: '#6366F1',
    filePath: '',
    playCount: 0,
    addedAt: Date.now(),
  },
];

export const MOCK_ALBUMS: Album[] = [
  { id: 'a1', title: 'Stellar Journeys', artist: 'Etheric Drift', coverUrl: 'https://picsum.photos/seed/album1/400/400', year: 2023, trackCount: 12, trackIds: [] },
  { id: 'a2', title: 'Retro Waves', artist: 'Vinyl Voyager', coverUrl: 'https://picsum.photos/seed/album2/400/400', year: 2022, trackCount: 10, trackIds: [] },
  { id: 'a3', title: 'Cyber City', artist: 'Neon Knights', coverUrl: 'https://picsum.photos/seed/album3/400/400', year: 2024, trackCount: 8, trackIds: [] },
  { id: 'a4', title: 'Organic Textures', artist: 'Nature Bloom', coverUrl: 'https://picsum.photos/seed/album4/400/400', year: 2021, trackCount: 14, trackIds: [] },
];

export const MOCK_ARTISTS: Artist[] = [
  { id: 'ar1', name: 'Lofi Girl', imageUrl: 'https://picsum.photos/seed/artist1/400/400', trackCount: 124, albumCount: 3 },
  { id: 'ar2', name: 'Etheric Drift', imageUrl: 'https://picsum.photos/seed/artist2/400/400', trackCount: 42, albumCount: 2 },
  { id: 'ar3', name: 'Neon Knights', imageUrl: 'https://picsum.photos/seed/artist3/400/400', trackCount: 18, albumCount: 1 },
];

export const EQ_FREQUENCY_LABELS = [
  '32Hz', '64Hz', '125Hz', '250Hz', '500Hz', '1kHz', '2kHz', '4kHz', '8kHz', '16kHz',
];
