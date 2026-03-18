import * as ImageManipulator from "expo-image-manipulator";
import * as FileSystem from "expo-file-system/legacy";

async function readBase64(uri) {
    return FileSystem.readAsStringAsync(uri, {
        encoding: FileSystem.EncodingType.Base64,
    });
}

async function makeImageDataUrlSized(inputUri, { width, compress }) {
    if (!inputUri) throw new Error("Missing image uri");

    const result = await ImageManipulator.manipulateAsync(
        inputUri,
        [{ resize: { width } }],
        { compress, format: ImageManipulator.SaveFormat.JPEG }
    );

    if (!result?.uri) throw new Error("Image manipulation failed");

    try {
        const base64 = await readBase64(result.uri);
        return `data:image/jpeg;base64,${base64}`;
    } catch {
        try {
            const base64 = await readBase64(inputUri);
            return `data:image/jpeg;base64,${base64}`;
        } catch {
            throw new Error(
                "Image not readable. Try taking a new photo instead of selecting from a cloud gallery."
            );
        }
    }
}

// Module-level cache — persists across component mounts/unmounts
// Key: original URI, Value: { free, pro } data URLs
const _imageCache = new Map();
const MAX_CACHE_SIZE = 10;

function cacheGet(uri, tier) {
    return _imageCache.get(uri)?.[tier] || null;
}

function cacheSet(uri, tier, dataUrl) {
    if (_imageCache.size >= MAX_CACHE_SIZE) {
        // Evict oldest entry
        const firstKey = _imageCache.keys().next().value;
        if (firstKey) _imageCache.delete(firstKey);
    }
    const existing = _imageCache.get(uri) || {};
    _imageCache.set(uri, { ...existing, [tier]: dataUrl });
}

// Free tier: smaller upload, faster response (~30–120 KB)
export async function makeImageDataUrlFree(uri) {
    const cached = cacheGet(uri, "free");
    if (cached) return cached;
    const result = await makeImageDataUrlSized(uri, { width: 512, compress: 0.6 });
    cacheSet(uri, "free", result);
    return result;
}

// Pro tier: optimised size for quality vs upload speed (~60–180 KB)
export async function makeImageDataUrlPro(uri) {
    const cached = cacheGet(uri, "pro");
    if (cached) return cached;
    const result = await makeImageDataUrlSized(uri, { width: 700, compress: 0.75 });
    cacheSet(uri, "pro", result);
    return result;
}

// Pre-warm: start processing in background immediately after photo capture
// Call this fire-and-forget before navigating to preview
export function prewarmImageDataUrl(uri) {
    if (!uri) return;
    if (!cacheGet(uri, "pro")) {
        makeImageDataUrlPro(uri).catch(() => {});
    }
}
