import { Show } from 'solid-js';
import type { DeobfuscateResult } from '../webcrack.worker';

interface Props {
  filename: string;
  characters: number;
  lines: number;
  report: DeobfuscateResult['report'] | null;
  onCopy: () => void;
  onLoadExample: () => void;
}

function formatBytes(value: number) {
  if (value < 1024) return `${value} B`;
  return `${(value / 1024).toFixed(value < 10240 ? 1 : 0)} KB`;
}

export default function WorkspaceToolbar(props: Props) {
  return (
    <div class="workspace-toolbar">
      <div class="workspace-file">
        <span class="language-dot" aria-hidden="true" />
        <span class="workspace-filename">{props.filename}</span>
        <span class="workspace-meta">
          {props.lines} lines · {props.characters.toLocaleString()} chars
        </span>
      </div>

      <Show
        when={props.report}
        fallback={
          <button class="toolbar-action" onClick={props.onLoadExample}>
            Load example
          </button>
        }
      >
        {(report) => (
          <div class="run-report" aria-label="Last run summary">
            <span>{report().durationMs.toLocaleString()} ms</span>
            <span>
              {formatBytes(report().inputBytes)} →{' '}
              {formatBytes(report().outputBytes)}
            </span>
            <Show when={report().filesRecovered > 0}>
              <span>{report().filesRecovered} modules</span>
            </Show>
          </div>
        )}
      </Show>

      <button
        class="toolbar-action"
        disabled={props.characters === 0}
        onClick={props.onCopy}
      >
        Copy code
      </button>
    </div>
  );
}
