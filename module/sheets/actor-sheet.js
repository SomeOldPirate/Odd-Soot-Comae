import { rollComae } from "../dice/roll.js";

export class OddSootCharacterSheet extends ActorSheet {
  
  /** @override */
  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      classes: ["oddsoot", "sheet", "character"],
      template: "systems/oddsoot-comae/templates/actor/character-sheet.hbs",
      width: 800,
      height: 900,
      tabs: [{ navSelector: ".sheet-tabs", contentSelector: ".sheet-body", initial: "main" }]
    });
  }

  /** @override */
  getData() {
    const context = super.getData();
    const actorData = context.actor;

    // Use a safe copy of the system data
    context.system = actorData.system;
    context.config = CONFIG.ODDSOOT; 
    
    // Organize Items
    this._prepareItems(context);

    return context;
  }

  /**
   * Organize and classify Items for the Sheet.
   */
  _prepareItems(context) {
    const focuses = {}; 
    const weapons = []; 
    const armor = [];   
    const gear = [];
    const peculiarities = [];

    // Initialize arrays for skills to prevent errors if empty
    if (context.system.skills) {
      for (let skillKey of Object.keys(context.system.skills)) {
        focuses[skillKey] = [];
      }
    }

    for (let i of context.items) {
      i.img = i.img || Item.DEFAULT_ICON;
      
      if (i.type === 'focus') {
        const skill = i.system.associatedSkill || 'combat'; 
        if (focuses[skill]) focuses[skill].push(i);
      }
      else if (i.type === 'weapon') {
        weapons.push(i);
      }
      else if (i.type === 'armor') {
        armor.push(i);
      }
      else if (i.type === 'gear') {
        gear.push(i);
      }
      else if (i.type === 'peculiarity') {
        peculiarities.push(i);
      }
    }

    context.focuses = focuses;
    context.weapons = weapons;
    context.armor = armor;
    context.gear = gear;
    context.peculiarities = peculiarities;
  }

  /** @override */
  activateListeners(html) {
    super.activateListeners(html);

    if (!this.isEditable) return;

    // 1. SKILL ROLLS
    html.find('.roll-skill').click(ev => {
      ev.preventDefault();
      const skillKey = ev.currentTarget.dataset.key;
      rollComae(this.actor, skillKey);
    });

    // 2. WEAPON ROLLS (Clicking the row)
    html.find('.roll-weapon').click(ev => {
      ev.preventDefault();
      const li = $(ev.currentTarget).closest("[data-item-id]");
      const itemId = li.data("itemId");
      const item = this.actor.items.get(itemId);
      
      // Pass the specific weapon item to the roller to pre-select it
      rollComae(this.actor, 'combat', item); 
    });

    // 3. SOOT TEST
    html.find('.roll-soot').click(ev => {
      ev.preventDefault();
      let sootValue = this.actor.system.soot.value;
      
      new Dialog({
        title: "Soot Test",
        content: `<p>Roll against current Soot (${sootValue}%)?</p><p style="font-size:0.8em; color:#666;">Rolling UNDER your Soot level typically means the infection manifests.</p>`,
        buttons: {
          roll: {
            label: "Roll",
            callback: async () => {
              const roll = new Roll("1d100");
              await roll.evaluate();
              
              // In Odd Soot: 
              // Roll <= Soot = Success (BAD / Manifestation)
              // Roll > Soot = Failure (GOOD / Resist)
              let result = "failure"; 
              if (roll.total <= sootValue) result = "success"; 
              if (roll.total >= 99) result = "fumble"; // Fumble usually means very good luck in this context (auto-resist) or very bad depending on GM interpretation. Let's keep it standard.

              // Determine visual flavor
              // If Result is Success (hit the soot), we style it as Danger/Failure visually
              const isManifest = (result === "success" || result === "critical");
              
              const templateData = {
                actor: this.actor.name,
                img: this.actor.img,
                skill: "Soot Test",
                roll: roll.total,
                target: sootValue,
                // If we rolled under, we say "MANIFEST" and use the Red 'failure' CSS to indicate danger
                result: isManifest ? "MANIFEST" : "RESIST", 
                css: isManifest ? "failure" : "success", 
                breakdown: `Target: Current Soot (${sootValue})`
              };
              
              const chatContent = await renderTemplate("systems/oddsoot-comae/templates/chat/roll-card.hbs", templateData);
              
              ChatMessage.create({
                user: game.user.id,
                speaker: ChatMessage.getSpeaker({ actor: this.actor }),
                content: chatContent,
                rolls: [roll],
                type: CONST.CHAT_MESSAGE_TYPES.ROLL
              });
            }
          }
        },
        default: "roll"
      }).render(true);
    });

    // 4. ITEM MANAGEMENT (Delete/Edit)
    html.find('.item-delete').click(ev => {
      ev.preventDefault();
      ev.stopPropagation(); // Stop click from bubbling up to roll-weapon
      const target = $(ev.currentTarget);
      const li = target.parents("[data-item-id]"); 
      const itemId = li.data("itemId");
      
      if (itemId) {
        this.actor.deleteEmbeddedDocuments("Item", [itemId]);
      }
    });

    html.find('.item-edit').click(ev => {
      ev.preventDefault();
      ev.stopPropagation(); // Stop click from bubbling up to roll-weapon
      const target = $(ev.currentTarget);
      const li = target.parents("[data-item-id]");
      const itemId = li.data("itemId");
      
      if (itemId) {
        const item = this.actor.items.get(itemId);
        item.sheet.render(true);
      }
    });
  }
}