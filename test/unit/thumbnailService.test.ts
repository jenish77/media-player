import {
  getThumbnailForMedia,
  isImageUri,
  isSupportedThumbnailUri,
  preloadThumbnails,
} from '../../src/services/thumbnailService';
import { MediaItem } from '../../src/types/media';
import * as mediaRepo from '../../src/services/database/mediaRepository';

describe('Thumbnail Service', () => {
  const mockVideoItem: MediaItem = {
    id: 'media_test_thumb_1',
    sourceType: 'ios_photos',
    sourceReference: 'ph://ED7AC36B-A150-4C38-BB8C-B6D696F4F2ED',
    displayName: 'IMG_0047.MP4',
    durationMs: 8000,
    sizeBytes: 15000000,
    width: 1920,
    height: 1080,
    mimeType: 'video/mp4',
    container: 'MP4',
    dateAdded: Date.now(),
    lastSeenAt: Date.now(),
    availabilityStatus: 'available',
    thumbnailStatus: 'none',
    thumbnailUri: null,
    lastPositionMs: 0,
    lastPlayedAt: null,
    isFavorite: false,
    folderName: 'Camera',
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };

  it('validates image URIs and distinguishes raster images from raw video or ph:// paths', () => {
    expect(isImageUri('file:///var/mobile/thumb.jpg')).toBe(true);
    expect(isImageUri('file:///var/mobile/thumb.jpeg')).toBe(true);
    expect(isImageUri('file:///var/mobile/thumb.png')).toBe(true);
    expect(isImageUri('file:///cache/VideoThumbnails/abc123.jpg')).toBe(true);
    expect(isImageUri('data:image/jpeg;base64,xxxx')).toBe(true);

    // Rejections for raster isImageUri
    expect(isImageUri('ph://ED7AC36B-A150-4C38-BB8C-B6D696F4F2ED')).toBe(false);
    expect(isImageUri('file:///storage/video.mp4')).toBe(false);
    expect(isImageUri('file:///storage/video.mov')).toBe(false);
    expect(isImageUri('file:///storage/video.mkv')).toBe(false);
    expect(isImageUri('')).toBe(false);
    expect(isImageUri(null)).toBe(false);
    expect(isImageUri(undefined)).toBe(false);

    // Supported thumbnail URIs for expo-image (includes ph:// and raster images)
    expect(isSupportedThumbnailUri('ph://ED7AC36B-A150-4C38-BB8C-B6D696F4F2ED')).toBe(true);
    expect(isSupportedThumbnailUri('file:///var/mobile/thumb.jpg')).toBe(true);
    expect(isSupportedThumbnailUri('file:///storage/video.mp4')).toBe(false);
  });

  it('returns existing valid image thumbnail URI immediately from cache', async () => {
    const itemWithThumb: MediaItem = {
      ...mockVideoItem,
      id: 'media_existing_thumb',
      thumbnailUri: 'file:///storage/cache/existing_thumb.jpg',
      thumbnailStatus: 'ready',
    };

    const uri = await getThumbnailForMedia(itemWithThumb);
    expect(uri).toBe('file:///storage/cache/existing_thumb.jpg');
  });

  it('resolves iOS ph:// URIs instantly for native PhotoKit rendering without deprecation warnings', async () => {
    const updateSpy = jest.spyOn(mediaRepo, 'updateThumbnail').mockResolvedValue(undefined as any);

    const generatedUri = await getThumbnailForMedia(mockVideoItem);
    expect(generatedUri).toBe('ph://ED7AC36B-A150-4C38-BB8C-B6D696F4F2ED');

    // Verify cache hit on second call
    const cachedUri = await getThumbnailForMedia(mockVideoItem);
    expect(cachedUri).toBe(generatedUri);

    updateSpy.mockRestore();
  });

  it('generates a thumbnail for non-ph video files using expo-video player', async () => {
    const updateSpy = jest.spyOn(mediaRepo, 'updateThumbnail').mockResolvedValue(undefined as any);
    const localVideoItem: MediaItem = {
      ...mockVideoItem,
      id: 'media_test_local_file',
      sourceType: 'android_mediastore',
      sourceReference: 'file:///storage/emulated/0/Movies/sample.mp4',
    };

    const generatedUri = await getThumbnailForMedia(localVideoItem);
    expect(generatedUri).toBeDefined();
    expect(typeof generatedUri).toBe('string');
    expect(generatedUri?.endsWith('.jpg')).toBe(true);

    updateSpy.mockRestore();
  });

  it('safely handles batch preloading without throwing', () => {
    expect(() => {
      preloadThumbnails([mockVideoItem], 5);
      preloadThumbnails([]);
    }).not.toThrow();
  });
});
