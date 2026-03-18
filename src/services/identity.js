import { getCurrentUser } from "./auth";
import { getStableGuestId } from "./guestId";

export async function getAppIdentity() {
    const user = await getCurrentUser();

    if (user?.id) {
        return {
            id: `user:${user.id}`,
            type: "user",
            user,
        };
    }

    const guestId = await getStableGuestId();

    return {
        id: guestId,
        type: "guest",
        user: null,
    };
}