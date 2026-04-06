<script lang="ts">
  import ToastContainer from '$lib/components/common/ToastContainer.svelte';
  import SettingsModal from '$lib/components/common/SettingsModal.svelte';
  import ExportDialog from '$lib/components/common/ExportDialog.svelte';
  import TasksModal from '$lib/components/common/TasksModal.svelte';
  import PanelModal from '$lib/components/common/PanelModal.svelte';
  import GraphModal from '$lib/components/common/GraphModal.svelte';
  import { getUiState } from '$lib/stores/ui.svelte';

  let {
    exportDialogVisible = false,
    exportDialogPath = '',
    onExport,
    onExportCancel,
    onFileOpen,
  }: {
    exportDialogVisible: boolean;
    exportDialogPath: string;
    onExport: (format: string, includeMedia: boolean) => void;
    onExportCancel: () => void;
    onFileOpen: (path: string) => void;
  } = $props();

  const ui = getUiState();
</script>

<ToastContainer />

<SettingsModal
  visible={ui.settingsVisible}
  onclose={() => ui.hideSettings()}
/>

<ExportDialog
  visible={exportDialogVisible}
  filePath={exportDialogPath}
  onexport={onExport}
  oncancel={onExportCancel}
/>

<TasksModal
  visible={ui.tasksVisible}
  onclose={() => ui.hideTasks()}
  onfileopen={onFileOpen}
/>

<PanelModal
  visible={ui.panelModalVisible}
  onclose={() => ui.hidePanelModal()}
  onfileselect={onFileOpen}
/>

<GraphModal
  visible={ui.graphPanelVisible}
  onclose={() => ui.toggleGraphPanel()}
  onfileselect={onFileOpen}
/>
