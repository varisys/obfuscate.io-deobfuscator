import * as monaco from 'monaco-editor';
import { parse as parsePath } from 'path';
import {
  For,
  Show,
  batch,
  createMemo,
  createSignal,
  onCleanup,
} from 'solid-js';
import { createStore } from 'solid-js/store';
import Alert from './components/Alert';
import Breadcrumbs from './components/Breadcrumbs';
import FileDropZone from './components/FileDropZone';
import MonacoEditor from './components/MonacoEditor';
import ProgressBar from './components/ProgressBar';
import Sidebar from './components/Sidebar';
import Tab from './components/Tab.jsx';
import WorkspaceToolbar from './components/WorkspaceToolbar';
import Menu from './components/menu/Menu';
import { DeobfuscateContextProvider } from './context/DeobfuscateContext';
import { OBFUSCATOR_EXAMPLE } from './examples';
import { settings } from './hooks/useSettings';
import { useWorkspaces, type Workspace } from './indexeddb';
import { debounce } from './utils/debounce';
import { downloadFile } from './utils/files';
import type { DeobfuscateResult } from './webcrack.worker';

export const [config, setConfig] = createStore({
  deobfuscate: true,
  unminify: true,
  unpack: true,
  jsx: true,
  mangleRegex: null as RegExp | null,
});

function App() {
  const { saveModels, setWorkspaceId } = useWorkspaces();
  const [untitledCounter, setUntitledCounter] = createSignal(1);
  const [models, setModels] = createSignal<monaco.editor.ITextModel[]>([
    monaco.editor.createModel(
      '',
      'javascript',
      monaco.Uri.from({ scheme: 'untitled', path: 'Untitled-1.js' }),
    ),
  ]);
  const [tabs, setTabs] = createSignal<monaco.editor.ITextModel[]>(models());
  const [activeTab, setActiveTab] = createSignal<
    monaco.editor.ITextModel | undefined
  >(tabs()[0]);
  const [editorRevision, setEditorRevision] = createSignal(0);
  const [lastRun, setLastRun] = createSignal<
    DeobfuscateResult['report'] | null
  >(null);

  const fileModels = createMemo(() =>
    models().filter((m) => m.uri.scheme === 'file'),
  );
  const untitledModels = createMemo(() =>
    models().filter((m) => m.uri.scheme === 'untitled'),
  );
  const filePaths = createMemo(() =>
    fileModels().map((model) => model.uri.path),
  );
  const hasNonEmptyModels = () => models().some((m) => m.getValueLength() > 0);
  const activeCharacters = () => {
    editorRevision();
    return activeTab()?.getValueLength() ?? 0;
  };
  const activeLines = () => {
    editorRevision();
    return activeTab()?.getLineCount() ?? 0;
  };

  window.onbeforeunload = () => {
    if (settings.confirmOnLeave && hasNonEmptyModels()) {
      saveModels(models()).catch(console.error);
      return true;
    }
    return undefined;
  };

  const saveModelsDebounced = debounce(() => {
    if (settings.workspaceHistory) saveModels(models()).catch(console.error);
  }, 1000);

  async function restoreWorkspace(workspace: Workspace) {
    await saveModels(models());
    setWorkspaceId(workspace.id);

    batch(() => {
      models().forEach((model) => model.dispose());

      setModels(
        workspace.models.map((model) =>
          monaco.editor.createModel(
            model.value,
            model.language,
            monaco.Uri.parse(model.uri),
          ),
        ),
      );

      setTabs(untitledModels());
      setActiveTab(untitledModels()[0]);
    });
  }

  onCleanup(() => {
    models().forEach((model) => model.dispose());
  });

  function openTab(tab: monaco.editor.ITextModel) {
    if (!tabs().includes(tab)) {
      setTabs([...tabs(), tab]);
    }
    setActiveTab(tab);
  }

  function openFile(path: string) {
    const model = fileModels().find((m) => m.uri.path === '/' + path);
    if (!model) {
      return console.warn(`No model found for path: ${path}`);
    }
    openTab(model);
  }

  function closeTab(tab: monaco.editor.ITextModel) {
    const index = tabs().indexOf(tab);
    if (activeTab() === tab) {
      setActiveTab(tabs()[index > 0 ? index - 1 : 1]);
    }
    setTabs(tabs().filter((t) => t !== tab));
    if (tab.uri.scheme === 'untitled') {
      tab.dispose();
      // FIXME: resets folder expansion state
      setModels(models().filter((m) => m !== tab));
    }
  }

  function openUntitledTab() {
    setUntitledCounter(untitledCounter() + 1);
    const model = monaco.editor.createModel(
      '',
      'javascript',
      monaco.Uri.from({
        scheme: 'untitled',
        path: `Untitled-${untitledCounter()}.js`,
      }),
    );
    setModels([...models(), model]);
    openTab(model);
    return model;
  }

  function createNamedUntitledModel(suggestedPath: string, value: string) {
    const parts = parsePath(suggestedPath);
    const usedPaths = new Set(models().map((model) => model.uri.path));
    let path = suggestedPath;

    for (let index = 2; usedPaths.has('/' + path); index++) {
      path = `${parts.name}-${index}${parts.ext}`;
    }

    return monaco.editor.createModel(
      value,
      'javascript',
      monaco.Uri.from({ scheme: 'untitled', path }),
    );
  }

  function loadExample() {
    const model = createNamedUntitledModel(
      'obfuscator-example.js',
      OBFUSCATOR_EXAMPLE,
    );
    setModels([...models(), model]);
    setTabs([...tabs(), model]);
    setActiveTab(model);
    setEditorRevision((value) => value + 1);
  }

  function onDeobfuscateResult(result: DeobfuscateResult) {
    const sourceName = parsePath(activeTab()?.uri.path ?? 'output.js').name;
    const outputModel = createNamedUntitledModel(
      `${sourceName.replace(/\.deobfuscated$/, '')}.deobfuscated.js`,
      result.code,
    );
    setLastRun(result.report);

    if (result.files.length === 0) {
      setModels([...models(), outputModel]);
      setTabs([...tabs(), outputModel]);
      setActiveTab(outputModel);
      setEditorRevision((value) => value + 1);
      return;
    }

    const retainedModels = untitledModels();
    const retainedTabs = tabs().filter((tab) => tab.uri.scheme === 'untitled');
    fileModels().forEach((model) => model.dispose());

    const seenPaths = new Set<string>();
    const deduplicatedFiles = result.files.filter((file) => {
      if (seenPaths.has(file.path)) return false;
      seenPaths.add(file.path);
      return true;
    });

    const recoveredModels = deduplicatedFiles.map((file) =>
        monaco.editor.createModel(
          file.code,
          'javascript',
          monaco.Uri.file(file.path),
        ),
      );

    setModels([...retainedModels, outputModel, ...recoveredModels]);
    setTabs([...retainedTabs, outputModel]);
    setActiveTab(outputModel);
    setEditorRevision((value) => value + 1);
  }

  async function loadFromURL(url: string) {
    let parsedURL: URL;
    try {
      parsedURL = new URL(url);
    } catch {
      throw new Error('That is not a valid URL.');
    }
    if (!['http:', 'https:'].includes(parsedURL.protocol)) {
      throw new Error('Only HTTP and HTTPS URLs are supported.');
    }

    const response = await fetch(parsedURL);
    if (!response.ok) {
      throw new Error(`The server returned HTTP ${response.status}.`);
    }

    const maximumBytes = 8 * 1024 * 1024;
    const contentLength = Number(response.headers.get('content-length'));
    if (contentLength > maximumBytes) {
      throw new Error('The remote file is larger than the 8 MB safety limit.');
    }

    const content = await response.text();
    if (new TextEncoder().encode(content).byteLength > maximumBytes) {
      throw new Error('The remote file is larger than the 8 MB safety limit.');
    }

    const model = activeTab() || openUntitledTab();
    model.setValue(content);
    setEditorRevision((value) => value + 1);
  }

  {
    const queryParams = new URLSearchParams(location.search);
    const urlParam = queryParams.get('url');
    const codeParam = queryParams.get('code');

    if (urlParam !== null) {
      loadFromURL(urlParam).catch(console.error);
    } else if (codeParam !== null) {
      const model = activeTab() || openUntitledTab();
      model.setValue(codeParam);
    }
  }

  return (
    <DeobfuscateContextProvider
      code={activeTab()?.getValue()}
      options={{ ...config }}
      onResult={onDeobfuscateResult}
    >
      <ProgressBar />
      <Menu
        onFileOpen={(content) => {
          openUntitledTab().setValue(content);
        }}
        onLoadFromURL={(url) => {
          return loadFromURL(url);
        }}
        onLoadExample={loadExample}
        onSave={() => {
          if (activeTab()) downloadFile(activeTab()!);
        }}
        onSaveAll={() => {
          import('./utils/zip.js')
            .then((module) => module.downloadModelsZIP(models()))
            .catch(console.error);
        }}
        onRestore={(workspace) => {
          restoreWorkspace(workspace).catch(console.error);
        }}
      />
      {/* Page */}
      <div class="flex flex-1 overflow-hidden">
        <Sidebar paths={filePaths()} onFileClick={openFile} />

        {/* Workspace */}
        <main class="flex-1 flex flex-col overflow-hidden">
          <div class="tabs tabs-lift tabs-sm shrink-0 justify-start flex-nowrap overflow-x-auto bg-base-300">
            <For each={tabs()}>
              {(tab) => (
                <Tab
                  path={tab.uri.path}
                  active={activeTab() === tab}
                  onClick={() => setActiveTab(tab)}
                  onClose={() => closeTab(tab)}
                />
              )}
            </For>
            <div class="tab" title="New tab" onClick={openUntitledTab}>
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                stroke-width="1.5"
                stroke="currentColor"
                fill="none"
                stroke-linecap="round"
                stroke-linejoin="round"
              >
                <path stroke="none" d="M0 0h24v24H0z" fill="none" />
                <path d="M12 5l0 14" />
                <path d="M5 12l14 0" />
              </svg>
            </div>
          </div>
          <Show when={activeTab()?.uri.scheme === 'file'}>
            <Breadcrumbs path={activeTab()!.uri.path} />
          </Show>

          <WorkspaceToolbar
            filename={parsePath(activeTab()?.uri.path ?? 'No file').base}
            characters={activeCharacters()}
            lines={activeLines()}
            report={lastRun()}
            onLoadExample={loadExample}
            onCopy={() => {
              const value = activeTab()?.getValue();
              if (value) void navigator.clipboard.writeText(value);
            }}
          />

          <MonacoEditor
            models={models()}
            currentModel={activeTab()}
            onModelChange={openTab}
            onValueChange={() => {
              setEditorRevision((revision) => revision + 1);
              saveModelsDebounced();
            }}
            onFileOpen={(content) => {
              openUntitledTab().setValue(content);
            }}
          />
        </main>
      </div>
      <Alert />
      <FileDropZone
        onDrop={(files) => {
          const existingPaths = new Set(
            untitledModels().map((m) => m.uri.path),
          );

          const newModels = files.map((file) => {
            let path = file.name;
            for (let i = 1; existingPaths.has(path); i++) {
              const parts = parsePath(path);
              path = `${parts.name.replace(/ \(\d+\)$/, '')} (${i})${parts.ext}`;
            }
            return monaco.editor.createModel(
              file.content,
              'javascript',
              monaco.Uri.from({ scheme: 'untitled', path }),
            );
          });

          setModels([...models(), ...newModels]);
          setTabs([...tabs(), ...newModels]);
          openTab(newModels.at(-1)!);
        }}
      />
    </DeobfuscateContextProvider>
  );
}

export default App;
