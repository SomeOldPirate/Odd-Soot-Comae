export class OddSootCharacterData extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    const fields = foundry.data.fields;

    // Helper: Creates a standard Resource (Value / Max)
    const resource = (initial = 10) => new fields.SchemaField({
      value: new fields.NumberField({ required: true, integer: true, initial: initial }),
      max: new fields.NumberField({ required: true, integer: true, initial: initial })
    });

    // Helper: Creates a Skill (Value + XP Checkbox)
    const skill = (initial = 30) => new fields.SchemaField({
      value: new fields.NumberField({ required: true, integer: true, initial: initial, min: 0, max: 100 }),
      xp: new fields.BooleanField({ initial: false }) 
    });

    return {
      // 1. CONFLICT POOLS
      pools: new fields.SchemaField({
        body: resource(10), // Physical
        int: resource(10),  // Investigation
        pow: resource(10),  // Magic/Sanity
        cha: resource(10)   // Social
      }),

      // 2. THE SOOT & PECULIARITIES
      soot: new fields.SchemaField({
        value: new fields.NumberField({ required: true, integer: true, initial: 0, min: 0, max: 100, label: "Soot Level" }),
        thresholds: new fields.ArrayField(new fields.NumberField(), { initial: [25, 50, 75, 100] })
      }),

      // 3. ATTRIBUTES
      luck: new fields.SchemaField({
        value: new fields.NumberField({ initial: 2, min: 0 }),
        max: new fields.NumberField({ initial: 3 })
      }),

      // 4. SKILLS (The Fixed List from Comae)
      skills: new fields.SchemaField({
        awareness: skill(30),
        combat:    skill(30),
        cunning:   skill(30),
        knowledge: skill(30),
        move:      skill(30),
        science:   skill(5),  // Lower default for specialized
        social:    skill(30),
        tech:      skill(5),
        willpower: skill(30)
      }),
      
      // Biographical / Narrative Data
      details: new fields.SchemaField({
        concept: new fields.StringField({ initial: "" }),
        drive: new fields.StringField({ initial: "" }),
        notes: new fields.HTMLField({ initial: "" })
      })
    };
  }
}