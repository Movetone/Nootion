import { beforeEach, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import { inviteUser, makeApp, setupAdmin, type Client } from "./helpers.js";

let app: FastifyInstance;
let admin: Client;

beforeEach(async () => {
  app = await makeApp();
  admin = await setupAdmin(app);
  await inviteUser(app, admin, { name: "Alice", email: "alice@example.com", password: "alice-password" });
});

describe("user directory", () => {
  it("lists every active user for profile discovery", async () => {
    const response = await admin.get("/api/users/directory");
    expect(response.statusCode).toBe(200);
    expect(response.json().users.map((user: { name: string }) => user.name)).toEqual(["Alice", "Boris"]);
  });
});
