import { For, Show, createSignal, onCleanup, onMount } from 'solid-js';
import { useDeobfuscateContext } from '../../context/DeobfuscateContext';
import { setSettings, settings, type Settings } from '../../hooks/useSettings';
import { useWorkspaces, type Workspace } from '../../indexeddb';
import { openFile } from '../../utils/files';
import { ctrlCmdIcon } from '../../utils/platform';
import MenuButton from './MenuButton';
import MenuDropdown from './MenuDropdown';
import MenuHeader from './MenuHeader';
import MenuSetting from './MenuSetting';

interface Props {
  onFileOpen?: (content: string) => void;
  onLoadFromURL?: (url: string) => Promise<void>;
  onLoadExample?: () => void;
  onSave?: () => void;
  onSaveAll?: () => void;
  onRestore?: (workspace: Workspace) => void;
}

export default function Menu(props: Props) {
  const { workspaces } = useWorkspaces();
  const {
    deobfuscate,
    deobfuscating,
    cancelDeobfuscate,
    progress,
    setAlert,
  } = useDeobfuscateContext();
  const [openedMenu, setOpenedMenu] = createSignal<
    'file' | 'settings' | undefined
  >();
  // eslint-disable-next-line no-unassigned-vars
  let menuRef: HTMLUListElement | undefined;

  onMount(() => document.addEventListener('click', onClickOutside));
  onCleanup(() => document.removeEventListener('click', onClickOutside));

  function onClickOutside(event: MouseEvent) {
    if (menuRef && !menuRef.contains(event.target as Node)) {
      setOpenedMenu(undefined);
    }
  }

  async function openURL() {
    const url = prompt('Enter a direct URL to a JavaScript file');
    if (!url) return;

    try {
      await props.onLoadFromURL?.(url);
    } catch (error) {
      setAlert(error instanceof Error ? error.message : String(error));
    }
  }

  return (
    <header class="app-header">
      <a class="brand" href="/" aria-label="Deobfuscator Studio home">
        <span class="brand-mark" aria-hidden="true">
          {'{ }'}
        </span>
        <span>
          <strong>Deobfuscator</strong>
          <small>STUDIO</small>
        </span>
      </a>

      <ul ref={menuRef} class="menu menu-horizontal app-menu">
        <MenuHeader
          title="File"
          open={openedMenu() === 'file'}
          onOpen={() => setOpenedMenu('file')}
        >
          <MenuButton
            shortcut={[ctrlCmdIcon, 'O']}
            onClick={() => openFile(props.onFileOpen)}
          >
            Open file…
          </MenuButton>
          <MenuButton onClick={() => void openURL()}>Open from URL…</MenuButton>
          <MenuButton onClick={props.onLoadExample}>Load example</MenuButton>
          <MenuDropdown title="Open recent">
            <For each={workspaces()} fallback={<li>No recent files</li>}>
              {(workspace) => (
                <MenuButton
                  class="whitespace-nowrap"
                  onClick={() => props.onRestore?.(workspace)}
                >
                  {new Date(workspace.timestamp).toLocaleString()} —
                  <code class="overflow-x-clip text-ellipsis max-w-36">
                    {workspace.models[0].value.slice(0, 50)}
                  </code>
                </MenuButton>
              )}
            </For>
          </MenuDropdown>
          <MenuButton shortcut={[ctrlCmdIcon, 'S']} onClick={props.onSave}>
            Save active file
          </MenuButton>
          <MenuButton onClick={props.onSaveAll}>Export workspace (.zip)</MenuButton>
        </MenuHeader>

        <MenuHeader
          title="Preferences"
          open={openedMenu() === 'settings'}
          onOpen={() => setOpenedMenu('settings')}
        >
          <MenuSetting>
            Theme
            <select
              class="select select-sm ml-auto"
              value={settings.theme}
              onChange={(event) =>
                setSettings(
                  'theme',
                  event.currentTarget.value as Settings['theme'],
                )
              }
            >
              <option value="dark">Dark</option>
              <option value="light">Light</option>
              <option value="system">System</option>
            </select>
          </MenuSetting>
          <MenuSetting>
            Confirm on leave
            <input
              type="checkbox"
              class="checkbox checkbox-sm ml-auto"
              checked={settings.confirmOnLeave}
              onChange={(event) =>
                setSettings('confirmOnLeave', event.currentTarget.checked)
              }
            />
          </MenuSetting>
          <MenuSetting>
            Workspace history
            <input
              type="checkbox"
              class="checkbox checkbox-sm ml-auto"
              checked={settings.workspaceHistory}
              onChange={(event) =>
                setSettings('workspaceHistory', event.currentTarget.checked)
              }
            />
          </MenuSetting>
          <MenuSetting>
            Word wrap
            <input
              type="checkbox"
              class="checkbox checkbox-sm ml-auto"
              checked={settings.wordWrap}
              onChange={(event) =>
                setSettings('wordWrap', event.currentTarget.checked)
              }
            />
          </MenuSetting>
          <MenuSetting>
            Sticky scroll
            <input
              type="checkbox"
              class="checkbox checkbox-sm ml-auto"
              checked={settings.stickyScroll}
              onChange={(event) =>
                setSettings('stickyScroll', event.currentTarget.checked)
              }
            />
          </MenuSetting>
        </MenuHeader>

        <li class="hidden sm:flex">
          <a href="/docs" target="_blank">
            Docs
          </a>
        </li>
      </ul>

      <div class="header-spacer" />
      <span class="local-badge hidden lg:inline-flex">
        <span /> Local-only processing
      </span>
      <Show
        when={deobfuscating()}
        fallback={
          <button class="btn btn-primary btn-sm header-run" onClick={deobfuscate}>
            Run analysis
          </button>
        }
      >
        <button
          class="btn btn-error btn-outline btn-sm header-run"
          onClick={cancelDeobfuscate}
        >
          Cancel {Math.round(progress())}%
        </button>
      </Show>
    </header>
  );
}
