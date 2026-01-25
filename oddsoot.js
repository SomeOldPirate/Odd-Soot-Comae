import { OddSootActor } from "./module/documents/actor.js";
import { OddSootCharacterData } from "./module/data/character.js";
import { OddSootNPCData } from "./module/data/npc.js"; 
import { OddSootItemData } from "./module/data/item.js";
import { OddSootCharacterSheet } from "./module/sheets/actor-sheet.js"; 
import { OddSootItemSheet } from "./module/sheets/item-sheet.js";
import { OddSootNPCSheet } from "./module/sheets/npc-sheet.js";

Hooks.once("init", async function() {
  console.log("ODD SOOT COMAE | Initializing System");

  // 1. Define custom Document classes
  CONFIG.Actor.documentClass = OddSootActor;

  // 2. Register Data Models
  CONFIG.Actor.dataModels.character = OddSootCharacterData;
  CONFIG.Actor.dataModels.npc = OddSootNPCData;
  CONFIG.Item.dataModels.focus = OddSootItemData;
  CONFIG.Item.dataModels.gear = OddSootItemData;
  CONFIG.Item.dataModels.weapon = OddSootItemData;
  CONFIG.Item.dataModels.armor = OddSootItemData;
  CONFIG.Item.dataModels.peculiarity = OddSootItemData;

  // 3. Register Sheets
  Actors.unregisterSheet("core", ActorSheet);
  Actors.registerSheet("oddsoot-comae", OddSootCharacterSheet, {
    types: ["character"],
    makeDefault: true
  });
  
  Actors.registerSheet("oddsoot-comae", OddSootNPCSheet, {
    types: ["npc"],
    makeDefault: true
  });

  Items.unregisterSheet("core", ItemSheet);
  Items.registerSheet("oddsoot-comae", OddSootItemSheet, {
    makeDefault: true
  });
});

/**
 * CHAT MESSAGE LISTENERS
 * Activate "Roll Damage" buttons and render the custom damage card.
 */
Hooks.on("renderChatMessage", (message, html, data) => {
  const damageBtn = html.find(".roll-damage-btn");
  
  if (damageBtn.length > 0) {
    damageBtn.click(async ev => {
      ev.preventDefault();
      const formula = damageBtn.data("formula");
      
      // 1. Roll the Dice
      const roll = new Roll(formula);
      await roll.evaluate();
      
      // 2. Prepare Data for Template
      // Default to d20 icon, attempt to find Actor image
      let img = "icons/svg/d20.svg";
      let weaponName = "Damage";

      // Try to get the actor image from the original message speaker
      if (message.speaker.actor) {
        const actor = game.actors.get(message.speaker.actor);
        if (actor) {
           img = actor.img;
        }
      }

      const templateData = {
        weaponName: weaponName,
        img: img,
        roll: roll.total,
        formula: formula
      };

      const chatContent = await renderTemplate("systems/oddsoot-comae/templates/chat/damage-card.hbs", templateData);

      // 3. Send to Chat
      ChatMessage.create({
        user: game.user.id,
        speaker: message.speaker,
        content: chatContent,
        rolls: [roll], 
        type: CONST.CHAT_MESSAGE_TYPES.ROLL
      });
    });
  }
});