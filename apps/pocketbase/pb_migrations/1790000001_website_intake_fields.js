/// <reference path="../pb_data/types.d.ts" />

migrate(
  (app) => {
    const rfqs = app.findCollectionByNameOrId("rfqs");
    const clients = app.findCollectionByNameOrId("clients");

    const ensureField = (name, field) => {
      if (!rfqs.fields.getByName(name)) {
        rfqs.fields.add(field);
      }
    };

    ensureField(
      "client",
      new RelationField({
        name: "client",
        maxSelect: 1,
        collectionId: clients.id,
        cascadeDelete: false,
      })
    );

    ensureField(
      "request_type",
      new SelectField({
        name: "request_type",
        maxSelect: 1,
        values: ["quote_request", "service_request", "contact_enquiry"],
      })
    );

    ensureField(
      "request_status",
      new SelectField({
        name: "request_status",
        maxSelect: 1,
        values: ["new", "reviewing", "scheduled", "in_progress", "completed", "closed"],
      })
    );

    app.save(rfqs);
  },
  (app) => {
    try {
      const rfqs = app.findCollectionByNameOrId("rfqs");
      ["client", "request_type", "request_status"].forEach((name) => {
        if (rfqs.fields.getByName(name)) {
          rfqs.fields.removeByName(name);
        }
      });
      app.save(rfqs);
    } catch (_) {}
  }
);
