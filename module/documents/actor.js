/**
 * Extend the base Actor document to support Odd Soot specific logic.
 */
export class OddSootActor extends Actor {

  /** @override */
  prepareData() {
    // Prepare data for the actor. Data preparation involves three steps:
    // 1. Prepare data embedded in documents (e.g. Items)
    // 2. Prepare data defined by the system (TypeDataModels)
    // 3. Prepare derived data (this function)
    super.prepareData();
  }

  /** @override */
  prepareDerivedData() {
    const actorData = this;
    const system = actorData.system;
    
    // ---------------------------------------------------------
    // 1. Soot Calculation
    // ---------------------------------------------------------
    // Example: Check thresholds for status labels
    if (system.soot.value >= 50) {
      // We can add temporary status flags here
      this.labels = { status: "Corrupted" };
    }

    // ---------------------------------------------------------
    // 2. Armor & Shield Calculations
    // ---------------------------------------------------------
    let totalAP = 0;      // Total Armour Points (Damage Reduction)
    let totalPenalty = 0; // Skill Penalty (e.g. -20% from Heavy Armor)

    // Iterate through items to find equipped Armor
    for (const item of this.items) {
      // Check if it is Armor and if it is Equipped
      if (item.type === 'armor' && item.system.equipped) {
        totalAP += (item.system.ap || 0);
        totalPenalty += (item.system.penalty || 0);
      }
    }

    // Attach these derived stats to the system data object
    // We create a container 'combat' to hold them for the sheet to display
    system.combat = {
      ap: totalAP,
      armorPenalty: totalPenalty
    };

    // ---------------------------------------------------------
    // 3. Apply Armor Penalty to Skills
    // ---------------------------------------------------------
    // Per Comae Rules (p.36), Heavy Armor reduces Move and Awareness.
    // We modify the *derived* value here. This does not change the database,
    // only the value used for rolls and display during this session.
    if (totalPenalty > 0) {
      if (system.skills.move) {
        system.skills.move.value -= totalPenalty;
        // Clamp to 0 so it doesn't go negative
        if (system.skills.move.value < 0) system.skills.move.value = 0;
      }
      
      if (system.skills.awareness) {
        system.skills.awareness.value -= totalPenalty;
        if (system.skills.awareness.value < 0) system.skills.awareness.value = 0;
      }
    }
  }

  /**
   * Roll Data is what allows us to write [[/roll @pools.body.value]] in chat.
   * @override 
   */
  getRollData() {
    const data = super.getRollData();
    
    // Copy the system data to the top level for easier access
    // E.g. allow @skills.combat.value instead of @system.skills.combat.value
    return { ...data, ...data.system };
  }
}