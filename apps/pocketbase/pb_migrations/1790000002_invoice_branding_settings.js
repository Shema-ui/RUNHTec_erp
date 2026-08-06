/// <reference path="../pb_data/types.d.ts" />

migrate(
  (app) => {
    const collection = app.findCollectionByNameOrId("company_settings");

    const ensureField = (name, field) => {
      if (!collection.fields.getByName(name)) {
        collection.fields.add(field);
      }
    };

    // Identity
    ensureField("company_name", new TextField({ name: "company_name", max: 200 }));
    ensureField("company_tagline", new TextField({ name: "company_tagline", max: 200 }));
    ensureField("company_registration_number", new TextField({ name: "company_registration_number", max: 100 }));

    // Branding uploads
    ensureField(
      "logo",
      new FileField({
        name: "logo",
        maxSelect: 1,
        maxSize: 2097152, // 2 MB
        mimeTypes: ["image/jpeg", "image/png", "image/webp", "image/svg+xml"],
      })
    );
    ensureField(
      "stamp",
      new FileField({
        name: "stamp",
        maxSelect: 1,
        maxSize: 2097152, // 2 MB
        mimeTypes: ["image/jpeg", "image/png", "image/webp"],
      })
    );

    // Signature metadata + display toggles
    ensureField("signature_name", new TextField({ name: "signature_name", max: 200 }));
    ensureField("signature_position", new TextField({ name: "signature_position", max: 200 }));
    ensureField("show_signature", new BoolField({ name: "show_signature" }));
    ensureField("show_stamp", new BoolField({ name: "show_stamp" }));

    // Invoice document defaults
    ensureField("invoice_footer_text", new TextField({ name: "invoice_footer_text", max: 1000 }));
    ensureField("default_terms_conditions", new TextField({ name: "default_terms_conditions", max: 5000 }));
    ensureField("default_payment_instructions", new TextField({ name: "default_payment_instructions", max: 2000 }));

    app.save(collection);

    // Default the two toggles to "on" for any existing settings record so
    // previously-uploaded signatures keep showing without an admin having to
    // revisit Settings after this migration runs.
    try {
      const rec = app.findFirstRecordByFilter("company_settings", "id != ''");
      if (rec) {
        rec.set("show_signature", true);
        rec.set("show_stamp", true);
        app.save(rec);
      }
    } catch (_) {}
  },
  (app) => {
    const collection = app.findCollectionByNameOrId("company_settings");
    [
      "company_name",
      "company_tagline",
      "company_registration_number",
      "logo",
      "stamp",
      "signature_name",
      "signature_position",
      "show_signature",
      "show_stamp",
      "invoice_footer_text",
      "default_terms_conditions",
      "default_payment_instructions",
    ].forEach((name) => {
      if (collection.fields.getByName(name)) {
        collection.fields.removeByName(name);
      }
    });
    app.save(collection);
  }
);
