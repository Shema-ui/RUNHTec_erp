/// <reference path="../pb_data/types.d.ts" />

// Replaces the old two-tier role model (super_admin/admin) with five
// specific roles: super_admin, sales, project_manager, accountant,
// technician. Collection-level access rules for each role are defined in
// the companion migration 1790000005_rbac_collection_rules.js.

migrate(
  (app) => {
    const users = app.findCollectionByNameOrId("users");

    // Any account still holding the old generic "admin" role is downgraded
    // to "sales" as a conservative default — it is not a guess at what that
    // person should have access to. A Super Administrator must review each
    // migrated account in User Management and assign the correct role
    // (Sales / Project Manager / Accountant / Technician) after this runs.
    const legacyAdmins = app.findRecordsByFilter("users", "role = 'admin'", "", 0, 0);
    legacyAdmins.forEach((rec) => {
      rec.set("role", "sales");
      app.save(rec);
    });

    const roleField = users.fields.getByName("role");
    roleField.values = ["super_admin", "sales", "project_manager", "accountant", "technician"];
    app.save(users);
  },
  (app) => {
    const users = app.findCollectionByNameOrId("users");

    // Best-effort revert: collapse every non-super_admin role back to the
    // old generic "admin" before restoring the smaller enum, since values
    // outside the reverted enum would otherwise fail validation.
    const nonSuperAdmins = app.findRecordsByFilter("users", "role != 'super_admin'", "", 0, 0);
    nonSuperAdmins.forEach((rec) => {
      rec.set("role", "admin");
      app.save(rec);
    });

    const roleField = users.fields.getByName("role");
    roleField.values = ["super_admin", "admin"];
    app.save(users);
  }
);
