export class OddSootItemData extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    const fields = foundry.data.fields;
    return {
      description: new fields.HTMLField(),
      
      // WEAPON FIELDS
      damage: new fields.StringField({ initial: "1d6" }),
      range: new fields.StringField({ initial: "Near" }),
      skillMalus: new fields.NumberField({ initial: 0 }),
      equipped: new fields.BooleanField({ initial: true }),

      // ARMOR FIELDS
      ap: new fields.NumberField({ initial: 0 }),
      penalty: new fields.NumberField({ initial: 0 }),

      // FOCUS FIELDS
      associatedSkill: new fields.StringField({ initial: "combat" }),
      isWeapon: new fields.BooleanField({ initial: false }),
      damageBonus: new fields.NumberField({ initial: 0 }),

      // GEAR FIELDS
      quantity: new fields.NumberField({ initial: 1 }),
      weight: new fields.NumberField({ initial: 0 }),

      // PECULIARITY FIELDS
      severity: new fields.NumberField({ initial: 1 }),
      active: new fields.BooleanField({ initial: true })
    };
  }
}