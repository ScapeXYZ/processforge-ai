const retired = () => Response.json({ error: { code: "INVITATIONS_NOT_AVAILABLE", message: "Workspace invitations are not included in this release." } }, { status: 410, headers: { "cache-control": "no-store" } });
export const GET=retired;export const POST=retired;export const PUT=retired;export const PATCH=retired;export const DELETE=retired;
