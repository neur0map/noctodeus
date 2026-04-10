let sidebarVisible = $state(true);
let rightPanelVisible = $state(false);
let graphPanelVisible = $state(false);
let quickOpenVisible = $state(false);
let commandPaletteVisible = $state(false);
let sidebarCollapsed = $state(false);
let settingsVisible = $state(false);
let tasksVisible = $state(false);
let panelModalVisible = $state(false);
let aiChatVisible = $state(false);
let researchVisible = $state(false);
let shareExportVisible = $state(false);

export function getUiState() {
  return {
    get sidebarVisible() {
      return sidebarVisible;
    },
    get rightPanelVisible() {
      return rightPanelVisible;
    },
    get graphPanelVisible() {
      return graphPanelVisible;
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
    get tasksVisible() {
      return tasksVisible;
    },
    get panelModalVisible() {
      return panelModalVisible;
    },
    get aiChatVisible() {
      return aiChatVisible;
    },
    get researchVisible() {
      return researchVisible;
    },
    get shareExportVisible() {
      return shareExportVisible;
    },

    toggleSidebar() {
      sidebarVisible = !sidebarVisible;
    },
    toggleRightPanel() {
      rightPanelVisible = !rightPanelVisible;
    },
    toggleGraphPanel() {
      graphPanelVisible = !graphPanelVisible;
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
    showTasks() {
      tasksVisible = true;
      quickOpenVisible = false;
      commandPaletteVisible = false;
    },
    hideTasks() {
      tasksVisible = false;
    },
    showPanelModal() {
      panelModalVisible = true;
      quickOpenVisible = false;
      commandPaletteVisible = false;
    },
    hidePanelModal() {
      panelModalVisible = false;
    },
    toggleAiChat() {
      aiChatVisible = !aiChatVisible;
    },
    showAiChat() {
      aiChatVisible = true;
      quickOpenVisible = false;
      commandPaletteVisible = false;
    },
    hideAiChat() {
      aiChatVisible = false;
    },
    showResearch() {
      researchVisible = true;
      quickOpenVisible = false;
      commandPaletteVisible = false;
    },
    hideResearch() {
      researchVisible = false;
    },
    toggleResearch() {
      researchVisible = !researchVisible;
    },
    showShareExport() {
      shareExportVisible = true;
      quickOpenVisible = false;
      commandPaletteVisible = false;
    },
    hideShareExport() {
      shareExportVisible = false;
    },
    closeAllOverlays() {
      quickOpenVisible = false;
      commandPaletteVisible = false;
      settingsVisible = false;
      tasksVisible = false;
      panelModalVisible = false;
      graphPanelVisible = false;
      shareExportVisible = false;
      // Note: aiChatVisible is NOT closed here — it's a persistent side panel, not a modal overlay
    },

    reset() {
      sidebarVisible = true;
      rightPanelVisible = false;
      graphPanelVisible = false;
      quickOpenVisible = false;
      commandPaletteVisible = false;
      sidebarCollapsed = false;
      settingsVisible = false;
      tasksVisible = false;
      panelModalVisible = false;
      aiChatVisible = false;
      researchVisible = false;
      shareExportVisible = false;
    },
  };
}
