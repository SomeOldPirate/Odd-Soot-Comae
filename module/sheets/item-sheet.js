export class OddSootItemSheet extends ItemSheet {
  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      classes: ["oddsoot", "sheet", "item"],
      template: "systems/oddsoot-comae/templates/item/item-sheet.hbs",
      width: 500,
      height: 400,
      tabs: [{ navSelector: ".sheet-tabs", contentSelector: ".sheet-body", initial: "description" }]
    });
  }

  getData() {
    const context = super.getData();
    context.system = context.item.system;
    context.config = CONFIG.ODDSOOT;

    // Define the list of skills for the dropdown menu
    context.skillList = {
      "awareness": "Awareness",
      "combat": "Combat",
      "cunning": "Cunning",
      "knowledge": "Knowledge",
      "move": "Move",
      "science": "Science",
      "social": "Social",
      "tech": "Tech",
      "willpower": "Willpower"
    };

    return context;
  }
}