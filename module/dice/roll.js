export async function rollComae(actor, skillKey, preSelectedWeapon = null) {
  const skills = actor.system.skills;
  const skill = skills[skillKey];
  
  // Default Target Number is the Skill Value
  let targetNum = skill ? skill.value : 0;
  let label = skillKey.charAt(0).toUpperCase() + skillKey.slice(1);

  // If this is a Combat roll, gather weapons
  let weaponOptions = "";
  if (skillKey === 'combat') {
    // 1. Correctly filter for weapons using the 'type' property
    const weapons = actor.items.filter(i => i.type === "weapon");
    
    // 2. Add Default Option
    // If we have a preSelectedWeapon that ISN'T "impro", the default is not selected.
    // If preSelectedWeapon is null, default is selected.
    let defaultSelected = preSelectedWeapon ? "" : "selected";
    weaponOptions += `<option value="impro" ${defaultSelected}>Standard / Improvised (1d6)</option>`;
    
    // 3. Add equipped weapons to list
    for (let w of weapons) {
      // Check if this is the pre-selected weapon
      const isSelected = preSelectedWeapon && preSelectedWeapon.id === w.id ? "selected" : "";
      weaponOptions += `<option value="${w.id}" ${isSelected}>${w.name} (${w.system.damage})</option>`;
    }
  }

  // Build Dialog Content
  const dialogContent = `
    <form>
      <div class="form-group">
        <label>Modifier</label>
        <input type="number" name="modifier" value="0"/>
      </div>
      <div class="form-group" style="display:flex; align-items:center; justify-content: space-between;">
        <label>Use Focus (+20%)</label>
        <input type="checkbox" name="useFocus" style="flex:0;"/>
      </div>
      ${skillKey === 'combat' ? `
      <div class="form-group">
        <label>Weapon</label>
        <select name="weaponId" style="width:100%">
          ${weaponOptions}
        </select>
      </div>` : ''}
    </form>
  `;

  // Render Dialog
  new Dialog({
    title: `Roll ${label}`,
    content: dialogContent,
    buttons: {
      roll: {
        label: "Roll",
        callback: async (html) => {
          const mod = parseInt(html.find('[name="modifier"]').val()) || 0;
          const focus = html.find('[name="useFocus"]').is(':checked');
          
          let finalTarget = targetNum + mod + (focus ? 20 : 0);
          
          // Determine Damage Formula if Combat
          let damageFormula = null;
          let weaponName = label; // "Combat"

          if (skillKey === 'combat') {
            const weaponId = html.find('[name="weaponId"]').val();
            
            if (weaponId === "impro") {
              damageFormula = "1d6";
              weaponName = "Improvised Attack";
            } else {
              // Fetch the real item to get damage
              const w = actor.items.get(weaponId);
              if (w) {
                damageFormula = w.system.damage;
                weaponName = w.name;
              }
            }
          }

          // Execute Roll
          const roll = new Roll("1d100");
          await roll.evaluate();
          const total = roll.total;

          // Determine Result
          let result = "failure";
          if (total <= finalTarget) result = "success";
          if (total <= Math.floor(finalTarget / 10) && result === "success") result = "critical";
          if (total >= 99) result = "fumble";

          // Prepare Chat Card
          const templateData = {
            actor: actor.name,
            img: actor.img,
            skill: weaponName, // Show Weapon Name instead of "Combat"
            roll: total,
            target: finalTarget,
            result: result.toUpperCase(),
            css: result,
            damageFormula: (result === "success" || result === "critical") ? damageFormula : null,
            breakdown: `Target ${targetNum} + Mod ${mod} ${focus ? '+ Focus (20)' : ''}`
          };
          
          const chatContent = await renderTemplate("systems/oddsoot-comae/templates/chat/roll-card.hbs", templateData);
          
          ChatMessage.create({
            user: game.user.id,
            speaker: ChatMessage.getSpeaker({ actor: actor }),
            content: chatContent,
            rolls: [roll],
            type: CONST.CHAT_MESSAGE_TYPES.ROLL
          });
        }
      }
    },
    default: "roll"
  }).render(true);
}