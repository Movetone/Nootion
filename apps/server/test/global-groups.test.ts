import { beforeEach, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import { inviteUser, makeApp, setupAdmin, type Client } from "./helpers.js";

let app: FastifyInstance;
let admin: Client;
let alice: Client;

beforeEach(async () => {
  app = await makeApp();
  admin = await setupAdmin(app);
  alice = await inviteUser(app, admin, { name: "Alice", email: "alice@example.com", password: "alice-password" });
});

describe("global groups", () => {
  it("lets administrators create groups, roles and memberships, then exposes them on profiles", async () => {
    const aliceId = await alice.id();
    const created = await admin.post("/api/admin/groups", { name: "Design", description: "Product design" });
    expect(created.statusCode).toBe(200);
    const group = created.json().group;
    expect(group).toMatchObject({ name: "Design", description: "Product design", members: [], roles: [] });

    const roleResponse = await admin.post(`/api/admin/groups/${group.id}/roles`, { name: "Lead" });
    expect(roleResponse.statusCode).toBe(200);
    const role = roleResponse.json().role;

    const memberResponse = await admin.post(`/api/admin/groups/${group.id}/members`, { userId: aliceId, roleIds: [role.id] });
    expect(memberResponse.statusCode).toBe(200);
    expect(memberResponse.json().member).toMatchObject({ userId: aliceId, roles: [{ id: role.id, name: "Lead" }] });

    const profile = (await admin.get(`/api/profiles/${aliceId}`)).json().profile;
    expect(profile.groups).toEqual([
      { id: group.id, name: "Design", description: "Product design", icon: null, color: null, roles: [{ id: role.id, name: "Lead" }] },
    ]);

    expect((await alice.delete(`/api/admin/groups/${group.id}`)).statusCode).toBe(403);
    expect((await admin.delete(`/api/admin/groups/${group.id}/members/${aliceId}`)).statusCode).toBe(200);
    expect((await admin.get(`/api/profiles/${aliceId}`)).json().profile.groups).toEqual([]);
  });
});
