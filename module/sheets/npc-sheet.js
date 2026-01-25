export class OddSootNPCSheet extends ActorSheet {
  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      classes: ["oddsoot", "sheet", "npc"],
      template: "systems/oddsoot-comae/templates/actor/npc-sheet.hbs",
      width: 600,
      height: 720
    });
  }

  getData() {
    const context = super.getData();
    context.system = context.actor.system;
    
    // Filter items
    context.weapons = context.items.filter(i => i.type === 'weapon');

    // Rank Definitions
    context.ranks = {
      "common": "Common",
      "skilled": "Skilled",
      "master": "Master"
    };

    return context;
  }

  activateListeners(html) {
    super.activateListeners(html);
    if (!this.isEditable) return;

    // 1. GENERATE CODE BLOCK
    html.find('.generate-btn').click(async ev => {
      ev.preventDefault();
      await this._generateCodeBlock();
    });

    // 2. APPLY RANK STATS
    html.find('.rank-select').change(async ev => {
      const rank = ev.target.value;
      await this._applyRankStats(rank);
    });

    // 3. ROLL STANDARD SKILL (Primary/Secondary)
    html.find('.roll-npc-skill').click(ev => {
      ev.preventDefault();
      const val = parseInt(ev.currentTarget.dataset.value);
      const label = ev.currentTarget.dataset.label;
      this._rollNPC(label, val);
    });

    // 4. ROLL WEAPON
    html.find('.roll-npc-weapon').click(ev => {
      ev.preventDefault();
      const itemId = ev.currentTarget.dataset.itemId;
      const item = this.actor.items.get(itemId);
      this._rollNPCWeapon(item);
    });
  }

  // --- LOGIC ---

  async _generateCodeBlock() {
    const personalities = ["Manipulative", "Charming", "Cheerful", "Moody", "Correct", "Talkative", "Inquisitive", "Bitter", "Lying", "Boring"];
    const motivations = ["Money", "Status", "Order & Logic", "Enjoy Life", "Altruism", "Faith", "Expertise", "Health"];
    const dispositions = ["Affectionate (+40%)", "Friendly (+20%)", "Neutral", "Unfriendly (-20%)", "Malicious (-40%)"];
    const events = ["Financial Gain", "New Love", "Family Event", "Health Improvement", "New Enemy", "Business Success"];

    await this.actor.update({
      "system.codeblock.personality": personalities[Math.floor(Math.random() * personalities.length)],
      "system.codeblock.motivation": motivations[Math.floor(Math.random() * motivations.length)],
      "system.codeblock.disposition": dispositions[Math.floor(Math.random() * dispositions.length)],
      "system.codeblock.event": events[Math.floor(Math.random() * events.length)]
    });
  }

  async _applyRankStats(rank) {
    let stats = {
      common:  { skills: [50, 30, 30], pools: [6, 6, 8, 10] },
      skilled: { skills: [70, 50, 50], pools: [6, 8, 10, 12] },
      master:  { skills: [90, 70, 70], pools: [10, 12, 14, 16] }
    };

    const s = stats[rank];
    if (!s) return;

    await this.actor.update({
      "system.skills.primary": s.skills[0],
      "system.skills.secondary": s.skills[1],
      "system.skills.tertiary": s.skills[2],
      "system.pools.body.max": s.pools[0], "system.pools.body.value": s.pools[0],
      "system.pools.int.max": s.pools[1],  "system.pools.int.value": s.pools[1],
      "system.pools.pow.max": s.pools[2],  "system.pools.pow.value": s.pools[2],
      "system.pools.cha.max": s.pools[3],  "system.pools.cha.value": s.pools[3]
    });
  }
  
  /**
   * Opens a dialog to select the skill used for the attack, then rolls.
   */
  async _rollNPCWeapon(item) {
    const skills = this.actor.system.skills;
    const damage = item.system.damage;
    const name = item.name;

    const content = `
      <form>
        <div class="form-group">
          <label>Attack Skill</label>
          <select name="skillMode">
            <option value="primary" selected>Primary (${skills.primary}%)</option>
            <option value="secondary">Secondary (${skills.secondary}%)</option>
            <option value="tertiary">Tertiary (${skills.tertiary}%)</option>
          </select>
        </div>
        <div class="form-group">
          <label>Modifier</label>
          <input type="number" name="modifier" value="0"/>
        </div>
      </form>
    `;

    new Dialog({
      title: `Attack: ${name}`,
      content: content,
      buttons: {
        attack: {
          label: "Attack",
          callback: async (html) => {
            const mode = html.find('[name="skillMode"]').val();
            const mod = parseInt(html.find('[name="modifier"]').val()) || 0;
            const target = skills[mode] + mod;

            this._rollNPC(name, target, damage);
          }
        }
      },
      default: "attack"
    }).render(true);
  }

  /**
   * The actual Dice Rolling function that renders the Chat Card
   */
  async _rollNPC(label, target, damageFormula = null) {
     const roll = new Roll("1d100");
     await roll.evaluate();
     const total = roll.total;

     // Determine Result
     let result = "failure";
     if (total <= target) result = "success";
     if (total <= Math.floor(target / 10) && result === "success") result = "critical";
     if (total >= 99) result = "fumble";

     // Render the Chat Card
     const templateData = {
       actor: this.actor.name,
       img: this.actor.img,
       skill: label,             
       roll: total,
       target: target,
       result: result.toUpperCase(),
       css: result,
       
       // Damage Button Logic
       damageFormula: (result === "success" || result === "critical") ? damageFormula : null,
       weaponName: label,
       
       breakdown: `Target ${target} (NPC Roll)`
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