// src/utils/ageRange.js
export function getAgeRangeFromLabel(ageLabel) {
    if (!ageLabel) return "adult";
    const lower = ageLabel.toLowerCase();
    const monthMatch = lower.match(/^(\d+)\s*month/);
    const yearMatch = lower.match(/^(\d+)\s*year/);
    if (monthMatch) {
        const m = parseInt(monthMatch[1]);
        return m < 6 ? "baby" : "young";
    }
    if (yearMatch) {
        const y = parseInt(yearMatch[1]);
        if (y < 2) return "young";
        if (y < 7) return "adult";
        return "senior";
    }
    return "adult";
}