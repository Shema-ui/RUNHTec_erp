/// <reference path="../pb_data/types.d.ts" />

migrate(
  (app) => {
    const quotations = app.findCollectionByNameOrId("quotations");

    const ensureField = (name, field) => {
      if (!quotations.fields.getByName(name)) {
        quotations.fields.add(field);
      }
    };

    // Bill-to snapshot — mirrors the pattern already used on `invoices` so a
    // quotation still shows correct client details even if the linked
    // client record is edited or removed later.
    ensureField("bill_to_name", new TextField({ name: "bill_to_name", max: 200 }));
    ensureField("bill_to_company", new TextField({ name: "bill_to_company", max: 200 }));
    ensureField("bill_to_address", new TextField({ name: "bill_to_address", max: 500 }));
    ensureField("bill_to_email", new TextField({ name: "bill_to_email", max: 200 }));
    ensureField("bill_to_phone", new TextField({ name: "bill_to_phone", max: 50 }));

    ensureField("discount_amount", new NumberField({ name: "discount_amount" }));
    ensureField("terms_conditions", new TextField({ name: "terms_conditions", max: 5000 }));

    app.save(quotations);
  },
  (app) => {
    const quotations = app.findCollectionByNameOrId("quotations");
    [
      "bill_to_name",
      "bill_to_company",
      "bill_to_address",
      "bill_to_email",
      "bill_to_phone",
      "discount_amount",
      "terms_conditions",
    ].forEach((name) => {
      if (quotations.fields.getByName(name)) {
        quotations.fields.removeByName(name);
      }
    });
    app.save(quotations);
  }
);
