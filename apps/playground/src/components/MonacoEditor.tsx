import * as monaco from 'monaco-editor';
import { createEffect, onCleanup, onMount } from 'solid-js';
import { useDeobfuscateContext } from '../context/DeobfuscateContext';
import { settings } from '../hooks/useSettings.js';
import { theme } from '../hooks/useTheme';
import { registerEvalSelection } from '../monaco/eval-selection';
import { PlaceholderContentWidget } from '../monaco/placeholder-widget';
import { downloadFile, openFile } from '../utils/files';

interface Props {
  models: monaco.editor.ITextModel[];
  currentModel?: monaco.editor.ITextModel;
  onModelChange?: (model: monaco.editor.ITextModel) => void;
  onValueChange?: (value: string) => void;
  onFileOpen?: (content: string) => void;
  onSave?: (value: string) => void;
}

monaco.editor.defineTheme('dark', {
  base: 'vs-dark',
  inherit: true,
  rules: [
    { token: 'comment', foreground: '65736A', fontStyle: 'italic' },
    { token: 'keyword', foreground: 'B8E94F' },
  ],
  colors: {
    'editor.background': '#101412',
    'editor.lineHighlightBackground': '#151A17',
    'editorCursor.foreground': '#B8E94F',
    'editorLineNumber.foreground': '#465047',
    'editorLineNumber.activeForeground': '#8E9A90',
    'editor.selectionBackground': '#34451E',
  },
});

export default function MonacoEditor(props: Props) {
  const { deobfuscate } = useDeobfuscateContext();
  const viewStates = new WeakMap<
    monaco.editor.ITextModel,
    monaco.editor.ICodeEditorViewState
  >();
  // eslint-disable-next-line no-unassigned-vars
  let container: HTMLDivElement | undefined;

  onMount(() => {
    const editor = monaco.editor.create(container!, {
      language: 'javascript',
      automaticLayout: true,
      wordWrap: 'on',
      tabSize: 2,
      fontSize: 13,
      lineHeight: 21,
      fontLigatures: true,
      padding: { top: 12 },
      minimap: { enabled: true, scale: 0.75 },
      smoothScrolling: true,
    });

    createEffect(() => {
      setModel(props.currentModel);
    });

    createEffect(() => {
      monaco.editor.setTheme(theme());
    });

    createEffect(() => {
      editor.updateOptions({
        stickyScroll: { enabled: settings.stickyScroll },
        wordWrap: settings.wordWrap ? 'on' : 'off',
      });
    });

    createEffect(() => {
      // TODO: only update current model, or model where the deobfuscation started from
      //
      // editor.updateOptions({ readOnly: deobfuscating() });
    });

    function setModel(model?: monaco.editor.ITextModel) {
      const currentModel = editor.getModel();
      if (currentModel) viewStates.set(currentModel, editor.saveViewState()!);
      editor.setModel(model ?? null);
      if (model) editor.restoreViewState(viewStates.get(model) ?? null);
      editor.focus();
    }

    editor.onDidChangeModelContent(() => {
      const model = editor.getModel();
      if (model) props.onValueChange?.(model.getValue());
    });

    // Go to definition
    const editorOpener = monaco.editor.registerEditorOpener({
      openCodeEditor(_source, resource, selectionOrPosition) {
        const newModel = props.models.find(
          (model) => model.uri.path === resource.path,
        );
        if (!newModel) return false;

        setModel(newModel);

        if (monaco.Range.isIRange(selectionOrPosition)) {
          editor.revealRangeInCenterIfOutsideViewport(selectionOrPosition);
          editor.setSelection(selectionOrPosition);
        } else if (monaco.Selection.isISelection(selectionOrPosition)) {
          editor.revealPositionInCenterIfOutsideViewport(selectionOrPosition);
          editor.setPosition(selectionOrPosition);
        }

        props.onModelChange?.(newModel);

        return true;
      },
    });

    // Enable IntelliSense for multiple files
    monaco.languages.typescript.javascriptDefaults.setEagerModelSync(true);

    const placeholder = new PlaceholderContentWidget(
      '// Paste obfuscated JavaScript here, open a file, or load the example',
      editor,
    );

    const deobfuscateAction = editor.addAction({
      id: 'editor.action.deobfuscate',
      label: 'Deobfuscate',
      keybindings: [monaco.KeyMod.Alt | monaco.KeyCode.Enter],
      run() {
        deobfuscate();
      },
    });

    const openAction = editor.addAction({
      id: 'editor.action.open',
      label: 'File: Open',
      keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyO],
      run() {
        openFile(props.onFileOpen);
      },
    });

    const saveAction = editor.addAction({
      id: 'editor.action.save',
      label: 'File: Save',
      keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS],
      run() {
        const model = editor.getModel();
        if (model) {
          downloadFile(model);
        }
      },
    });

    const evalAction = registerEvalSelection(editor);

    const commandPalette = editor.getAction('editor.action.quickCommand')!;
    editor.addCommand(
      monaco.KeyMod.CtrlCmd | monaco.KeyMod.Shift | monaco.KeyCode.KeyP,
      () => void commandPalette.run(),
    );

    onCleanup(() => {
      editorOpener.dispose();
      placeholder.dispose();
      deobfuscateAction.dispose();
      openAction.dispose();
      saveAction.dispose();
      evalAction.dispose();
      saveAction.dispose();
    });
  });

  return <div ref={container} class="editor flex-1 overflow-y-auto" />;
}
