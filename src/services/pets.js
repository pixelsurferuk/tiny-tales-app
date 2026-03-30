// src/services/pets.js
import AsyncStorage from "@react-native-async-storage/async-storage";

const KEY_PETS = "tiny_tales_pets_v1";
const KEY_ACTIVE = "tiny_tales_active_pet_id_v1";

function mergeDefined(base, patch) {
    const out = { ...(base || {}) };
    Object.keys(patch || {}).forEach((k) => {
        const v = patch[k];
        if (v !== undefined) out[k] = v;
    });
    return out;
}

function safeJsonParse(str, fallback) {
    try { return JSON.parse(str); } catch { return fallback; }
}

function makeId() {
    return `pet_${Date.now().toString(36)}_${Math.random().toString(16).slice(2, 8)}`;
}

// ─── Age helper ───────────────────────────────────────────────────────────────

export function calculateAge(birthDate) {
    if (!birthDate) return null;
    const birth = new Date(birthDate);
    const now = new Date();

    const years = now.getFullYear() - birth.getFullYear();
    const months = now.getMonth() - birth.getMonth();
    const totalMonths = years * 12 + months;

    if (totalMonths < 1) return { value: 0, unit: "months", label: "Less than 1 month" };
    if (totalMonths < 12) return { value: totalMonths, unit: "months", label: `${totalMonths} month${totalMonths !== 1 ? "s" : ""}` };

    const exactYears = Math.floor(totalMonths / 12);
    const remainingMonths = totalMonths % 12;

    if (remainingMonths === 0) return { value: exactYears, unit: "years", label: `${exactYears} year${exactYears !== 1 ? "s" : ""}` };
    return {
        value: exactYears,
        unit: "years",
        label: `${exactYears} year${exactYears !== 1 ? "s" : ""} ${remainingMonths} month${remainingMonths !== 1 ? "s" : ""}`,
    };
}

export function formatAgeForPrompt(birthDate) {
    const age = calculateAge(birthDate);
    if (!age) return null;
    return age.label;
}

// ─── CRUD ─────────────────────────────────────────────────────────────────────

export async function getPets() {
    const raw = await AsyncStorage.getItem(KEY_PETS);
    const list = safeJsonParse(raw, []);
    return Array.isArray(list) ? list : [];
}

export async function savePets(list) {
    await AsyncStorage.setItem(KEY_PETS, JSON.stringify(list || []));
}

export async function getActivePetId() {
    return (await AsyncStorage.getItem(KEY_ACTIVE)) || null;
}

export async function setActivePetId(id) {
    if (!id) {
        await AsyncStorage.removeItem(KEY_ACTIVE);
        return;
    }
    await AsyncStorage.setItem(KEY_ACTIVE, String(id));
}

export async function getActivePet() {
    const [pets, activeId] = await Promise.all([getPets(), getActivePetId()]);
    if (!pets?.length) return null;
    const found = pets.find((p) => p?.id === activeId) || null;
    return found || pets[0] || null;
}

export async function upsertPet(pet) {
    const pets = await getPets();
    const now = Date.now();

    const cleanName = String(pet?.name || "").trim();

    if (!pet?.id) {
        const created = mergeDefined(
            {
                id: makeId(),
                name: cleanName,
                avatarUri: pet?.avatarUri || null,
                vibe: pet?.vibe || null,
                breed: pet?.breed || null,
                birthDate: pet?.birthDate || null,
                createdAt: now,
                updatedAt: now,
            },
            {
                petType: pet?.petType,
                petTypeSource: pet?.petTypeSource,
                petTypeUpdatedAt: pet?.petTypeUpdatedAt,
            }
        );

        const next = [created, ...pets];
        await savePets(next);

        const activeId = await getActivePetId();
        if (!activeId) await setActivePetId(created.id);

        return created;
    }

    const next = pets.map((p) => {
        if (p.id !== pet.id) return p;

        const patched = mergeDefined(p, {
            ...pet,
            name: cleanName || p.name,
        });

        return { ...patched, updatedAt: now };
    });

    await savePets(next);
    return next.find((p) => p.id === pet.id) || null;
}

export async function deletePet(id) {
    const pets = await getPets();
    const next = pets.filter((p) => p?.id !== id);
    await savePets(next);

    const activeId = await getActivePetId();
    if (activeId === id) {
        const fallback = next[0]?.id || null;
        await setActivePetId(fallback);
    }
    return next;
}

export function summarizePetForPrompt(pet) {
    if (!pet) return null;
    const age = formatAgeForPrompt(pet.birthDate);
    return {
        id: pet.id,
        name: pet.name,
        vibe: pet.vibe || null,
        memory: pet.memory || null,
        breed: pet.breed || null,
        age: age || null,
        petType: pet.petType || null,
    };
}