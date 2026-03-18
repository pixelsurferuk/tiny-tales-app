import { supabase } from "./supabase";

function isMissingSessionError(error) {
    const msg = String(error?.message || "");
    return msg.toLowerCase().includes("auth session missing");
}

export async function sendLoginCode(email) {
    const cleanEmail = String(email || "").trim().toLowerCase();
    if (!cleanEmail) throw new Error("Missing email");

    const { data, error } = await supabase.auth.signInWithOtp({
        email: cleanEmail,
        options: {
            shouldCreateUser: true,
        },
    });

    if (error) throw error;
    return data;
}

export async function verifyLoginCode(email, code) {
    const cleanEmail = String(email || "").trim().toLowerCase();
    const cleanCode = String(code || "").trim();

    if (!cleanEmail) throw new Error("Missing email");
    if (!cleanCode) throw new Error("Missing code");

    const { error } = await supabase.auth.verifyOtp({
        email: cleanEmail,
        token: cleanCode,
        type: "email",
    });

    if (error) throw error;

    const {
        data: { session },
        error: sessionError,
    } = await supabase.auth.getSession();

    if (sessionError) throw sessionError;

    const {
        data: { user },
        error: userError,
    } = await supabase.auth.getUser();

    if (userError) throw userError;
    if (!user) throw new Error("Sign-in completed, but no user was found.");

    return { session, user };
}

export async function getSession() {
    const { data, error } = await supabase.auth.getSession();
    if (error) {
        if (isMissingSessionError(error)) return null;
        throw error;
    }
    return data.session ?? null;
}

export async function getCurrentUser() {
    const { data, error } = await supabase.auth.getUser();
    if (error) {
        if (isMissingSessionError(error)) return null;
        throw error;
    }
    return data.user ?? null;
}

export async function getAccessToken() {
    const session = await getSession();
    return session?.access_token || null;
}

export async function logout() {
    const { error } = await supabase.auth.signOut();
    if (error && !isMissingSessionError(error)) throw error;
}