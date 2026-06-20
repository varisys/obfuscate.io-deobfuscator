import type { JSX } from 'solid-js';
import { Show, createEffect, createSignal } from 'solid-js';
import { config, setConfig } from '../App';
import { useDeobfuscateContext } from '../context/DeobfuscateContext';
import FileTree from './FileTree';

interface Props {
  paths: string[];
  onFileClick?: (path: string) => void;
}

type MangleMode = 'off' | 'all' | 'hex' | 'short' | 'custom';
type Preset = 'balanced' | 'decode' | 'bundle' | 'readable' | 'custom';

const presets: Record<Exclude<Preset, 'custom'>, typeof config> = {
  balanced: {
    deobfuscate: true,
    unminify: true,
    unpack: true,
    jsx: true,
    mangleRegex: null,
  },
  decode: {
    deobfuscate: true,
    unminify: true,
    unpack: false,
    jsx: false,
    mangleRegex: null,
  },
  bundle: {
    deobfuscate: true,
    unminify: true,
    unpack: true,
    jsx: false,
    mangleRegex: null,
  },
  readable: {
    deobfuscate: false,
    unminify: true,
    unpack: false,
    jsx: true,
    mangleRegex: null,
  },
};

interface PipelineOptionProps {
  step: string;
  label: string;
  description: string;
  checked: boolean;
  onChange: JSX.EventHandler<HTMLInputElement, Event>;
}

function PipelineOption(props: PipelineOptionProps) {
  return (
    <label class="pipeline-option">
      <span class="pipeline-step">{props.step}</span>
      <span class="min-w-0 flex-1">
        <span class="pipeline-label">{props.label}</span>
        <span class="pipeline-description">{props.description}</span>
      </span>
      <input
        type="checkbox"
        class="toggle toggle-primary toggle-sm"
        checked={props.checked}
        onChange={props.onChange}
      />
    </label>
  );
}

export default function Sidebar(props: Props) {
  const { deobfuscate, deobfuscating, cancelDeobfuscate, progress } =
    useDeobfuscateContext();

  const [preset, setPreset] = createSignal<Preset>('balanced');
  const [mangleMode, setMangleMode] = createSignal<MangleMode>('off');
  const [mangleString, setMangleString] = createSignal('');
  const [mangleFlags, setMangleFlags] = createSignal('');

  function markCustom() {
    setPreset('custom');
  }

  function applyPreset(value: Preset) {
    setPreset(value);
    if (value !== 'custom') {
      setConfig(presets[value]);
      setMangleMode('off');
    }
  }

  createEffect(() => {
    if (mangleMode() === 'off') {
      setConfig('mangleRegex', null);
    } else if (mangleMode() === 'all') {
      setConfig('mangleRegex', /./);
    } else if (mangleMode() === 'hex') {
      setConfig('mangleRegex', /_0x[a-f\d]+/i);
    } else if (mangleMode() === 'short') {
      setConfig('mangleRegex', /^.{1,2}$/);
    } else {
      try {
        setConfig('mangleRegex', new RegExp(mangleString(), mangleFlags()));
      } catch {
        setConfig('mangleRegex', null);
      }
    }
  });

  return (
    <aside class="studio-sidebar">
      <div class="sidebar-heading">
        <span class="eyebrow">Analysis pipeline</span>
        <span class="sidebar-title">Recovery controls</span>
      </div>

      <label class="preset-field">
        <span>Preset</span>
        <select
          class="select select-sm select-bordered"
          value={preset()}
          onChange={(event) =>
            applyPreset(event.currentTarget.value as Preset)
          }
        >
          <option value="balanced">Balanced</option>
          <option value="decode">Decode only</option>
          <option value="bundle">Bundle recovery</option>
          <option value="readable">Readability pass</option>
          <option value="custom" disabled>
            Custom
          </option>
        </select>
      </label>

      <div class="pipeline-list">
        <PipelineOption
          step="01"
          label="Deobfuscate"
          description="Decode arrays, wrappers, and control flow"
          checked={config.deobfuscate}
          onChange={(event) => {
            markCustom();
            setConfig('deobfuscate', event.currentTarget.checked);
          }}
        />
        <PipelineOption
          step="02"
          label="Unminify"
          description="Restore readable expressions and blocks"
          checked={config.unminify}
          onChange={(event) => {
            markCustom();
            setConfig('unminify', event.currentTarget.checked);
          }}
        />
        <PipelineOption
          step="03"
          label="Unpack bundle"
          description="Recover webpack and browserify modules"
          checked={config.unpack}
          onChange={(event) => {
            markCustom();
            setConfig('unpack', event.currentTarget.checked);
          }}
        />
        <PipelineOption
          step="04"
          label="Decompile JSX"
          description="Rebuild React element calls as JSX"
          checked={config.jsx}
          onChange={(event) => {
            markCustom();
            setConfig('jsx', event.currentTarget.checked);
          }}
        />
      </div>

      <div class="rename-control">
        <label for="rename-mode">Rename identifiers</label>
        <select
          id="rename-mode"
          class="select select-sm select-bordered w-full"
          value={mangleMode()}
          onChange={(event) => {
            markCustom();
            setMangleMode(event.currentTarget.value as MangleMode);
          }}
        >
          <option value="off">Keep original names</option>
          <option value="hex">Rename _0x names</option>
          <option value="short">Rename 1–2 character names</option>
          <option value="all">Rename every local</option>
          <option value="custom">Custom regular expression</option>
        </select>
      </div>

      <Show when={mangleMode() === 'custom'}>
        <div class="custom-regex">
          <span>/</span>
          <input
            class="input input-sm"
            aria-label="Rename regular expression"
            placeholder="pattern"
            value={mangleString()}
            onInput={(event) => setMangleString(event.currentTarget.value)}
          />
          <span>/</span>
          <input
            class="input input-sm regex-flags"
            aria-label="Regular expression flags"
            placeholder="gi"
            value={mangleFlags()}
            onInput={(event) => {
              const value = event.currentTarget.value.replace(/[^gimuy]/g, '');
              setMangleFlags(value);
              event.currentTarget.value = value;
            }}
          />
        </div>
      </Show>

      <Show when={props.paths.length > 0}>
        <div class="recovered-files">
          <span class="eyebrow">Recovered modules</span>
          <FileTree
            paths={props.paths}
            onFileClick={(node) => props.onFileClick?.(node.path)}
          />
        </div>
      </Show>

      <div class="sidebar-run">
        <Show
          when={deobfuscating()}
          fallback={
            <button class="btn btn-primary run-button" onClick={deobfuscate}>
              <span class="run-icon">▶</span>
              Run analysis
              <kbd>Alt ↵</kbd>
            </button>
          }
        >
          <button
            class="btn btn-error btn-outline run-button"
            onClick={cancelDeobfuscate}
          >
            <span class="loading loading-spinner loading-sm" />
            Cancel · {Math.round(progress())}%
          </button>
        </Show>
        <p>Runs locally in this browser. Your code is not uploaded.</p>
      </div>
    </aside>
  );
}
