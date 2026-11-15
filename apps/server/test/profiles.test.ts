import { beforeEach, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import { inviteUser, makeApp, setupAdmin, type Client } from "./helpers.js";

let app: FastifyInstance;
let boris: Client;
let alice: Client;

beforeEach(async () => {
  app = await makeApp();
  boris = await setupAdmin(app);
  alice = await inviteUser(app, boris, { name: "Alice", email: "alice@example.com", password: "alice-password" });
});

describe("profiles", () => {
  it("shows a user's profile to another signed-in user", async () => {
    const aliceId = await alice.id();
    const response = await boris.get(`/api/profiles/${aliceId}`);
    expect(response.statusCode).toBe(200);
    const profile = response.json().profile;
    expect(profile).toMatchObject({
      user: { id: aliceId, name: "Alice" },
      page: { id: expect.any(String), title: "Alice" },
    });
    expect((await boris.get(`/api/pages/${profile.page.id}`)).statusCode).toBe(200);
    expect((await boris.get(`/api/pages/${profile.page.id}/content`)).statusCode).toBe(200);
    expect((await boris.put(`/api/pages/${profile.page.id}/content`, { markdown: "Boris cannot edit Alice's profile" })).statusCode).toBe(404);
    expect((await alice.put(`/api/pages/${profile.page.id}/content`, { markdown: "Alice's profile content" })).statusCode).toBe(200);
    expect((await alice.patch("/api/auth/me", { name: "Alice Cooper" })).statusCode).toBe(200);
    expect((await boris.get(`/api/profiles/${aliceId}`)).json().profile.page.title).toBe("Alice Cooper");
  });
});
