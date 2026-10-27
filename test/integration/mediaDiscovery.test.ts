import {
  scanDeviceVideos,
  pickVideoFromDocumentPicker,
  pickSubtitleFile,
} from '../../src/services/mediaDiscovery/mediaDiscoveryService';
import { getAllMediaItems } from '../../src/services/database/mediaRepository';

describe('Media Discovery Integration', () => {
  it('scans device media and indexes items into the database', async () => {
    const result = await scanDeviceVideos();
    expect(result.addedCount).toBe(2);
    expect(result.errors).toHaveLength(0);

    const items = await getAllMediaItems();
    expect(items.some((i) => i.displayName === 'sample_matrix.mp4')).toBe(true);
    expect(items.some((i) => i.displayName === 'anime_ep1.mkv')).toBe(true);
  });

  it('handles external document picking for video files', async () => {
    const media = await pickVideoFromDocumentPicker();
    expect(media).not.toBeNull();
    expect(media?.displayName).toBe('external_video.mp4');
    expect(media?.container).toBe('MP4');

    const all = await getAllMediaItems();
    expect(all.some((i) => i.id === media?.id)).toBe(true);
  });

  it('handles subtitle file picker', async () => {
    const sub = await pickSubtitleFile();
    expect(sub).not.toBeNull();
    expect(sub?.name).toBe('external_video.mp4'); // mock returns asset
    expect(sub?.uri).toBeDefined();
  });
});
