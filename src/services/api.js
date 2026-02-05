const API = "http://192.168.0.150:8787";

export async function sendReceiptToServer(data) {
    await fetch(`${API}/verify-purchase`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
    });
}
