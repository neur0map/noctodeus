let sidebarVisible = $state(true);
let rightPanelVisible = $state(false);
let quickOpenVisible = $state(false);
let commandPaletteVisible = $state(false);

export function getUiState() {
  return {
    get sidebarVisible() {
      return sidebarVisible;
    },
    get rightPanelVisible() {
      return rightPanelVisible;
    },
    get quickOpenVisible() {
      return quickOpenVisible;
    },
    get commandPaletteVisible() {
      return commandPaletteVisible;
    },

    toggleSidebar() {
      sidebarVisible = !sidebarVisible;
    },
    toggleRightPanel() {
      rightPanelVisible = !rightPanelVisible;
    },
    showQuickOpen() {
      quickOpenVisible = true;
      commandPaletteVisible = false;
    },
    hideQuickOpen() {
      quickOpenVisible = false;
    },
    showCommandPalette() {
      commandPaletteVisible = true;
      quickOpenVisible = false;
    },
    hideCommandPalette() {
      commandPaletteVisible = false;
    },
    closeAllOverlays() {
      quickOpenVisible = false;
      commandPaletteVisible = false;
    },

    reset() {
      sidebarVisible = true;
      rightPanelVisible = false;
      quickOpenVisible = false;
      commandPaletteVisible = false;
    },
  };
}
