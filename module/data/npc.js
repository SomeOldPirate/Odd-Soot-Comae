export class OddSootNPCData extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    const fields = foundry.data.fields;

    const pool = (initial = 10) => new fields.SchemaField({
      value: new fields.NumberField({ required: true, integer: true, initial: initial }),
      max: new fields.NumberField({ required: true, integer: true, initial: initial })
    });

    return {
      // 1. RANK (Common, Skilled, Master) - Determines base stats
      rank: new fields.StringField({ initial: "common", choices: ["common", "skilled", "master"] }),

      // 2. CONFLICT POOLS (Simpler defaults)
      pools: new fields.SchemaField({
        body: pool(6),
        int: pool(6),
        pow: pool(8),
        cha: pool(10)
      }),

      // 3. SKILLS (NPCs use simplified tiers)
      skills: new fields.SchemaField({
        primary: new fields.NumberField({ initial: 50, label: "Primary Skill" }),
        secondary: new fields.NumberField({ initial: 30, label: "Secondary Skill" }),
        tertiary: new fields.NumberField({ initial: 30, label: "Tertiary Skill" })
      }),

      // 4. CODE BLOCKS (The narrative engine)
      codeblock: new fields.SchemaField({
        personality: new fields.StringField({ initial: "" }),
        motivation: new fields.StringField({ initial: "" }),
        disposition: new fields.StringField({ initial: "Neutral" }),
        event: new fields.StringField({ initial: "" })
      }),

      // 5. NOTES
      details: new fields.SchemaField({
        notes: new fields.HTMLField({ initial: "" })
      })
    };
  }
}