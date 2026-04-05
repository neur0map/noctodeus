let sidebarVisible = $state(true);
let rightPanelVisible = $state(false);
let quickOpenVisible = $state(false);
let commandPaletteVisible = $state(false);
let sidebarCollapsed = $state(false);
let settingsVisible = $state(false);

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
    get sidebarCollapsed() {
      return sidebarCollapsed;
    },
    get settingsVisible() {
      return settingsVisible;
    },

    toggleSidebar() {
      sidebarVisible = !sidebarVisible;
    },
    toggleRightPanel() {
      rightPanelVisible = !rightPanelVisible;
    },
    toggleSidebarCollapse() {
      sidebarCollapsed = !sidebarCollapsed;
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
    showSettings() {
      settingsVisible = true;
      quickOpenVisible = false;
      commandPaletteVisible = false;
    },
    hideSettings() {
      settingsVisible = false;
    },
    closeAllOverlays() {
      quickOpenVisible = false;
      commandPaletteVisible = false;
      settingsVisible = false;
    },

    reset() {
      sidebarVisible = true;
      rightPanelVisible = false;
      quickOpenVisible = false;
      commandPaletteVisible = false;
      sidebarCollapsed = false;
      settingsVisible = false;
    },
  };
}
