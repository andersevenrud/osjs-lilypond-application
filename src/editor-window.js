import {h, app} from 'hyperapp';
import {Box, BoxContainer, Menubar, MenubarItem, Toolbar, Button, TextareaField} from '@osjs/gui';
import * as ace from 'brace';
import 'brace/theme/monokai';

const createMainMenu = (current, actions, _) => ([
  {label: _('LBL_NEW'), onclick: () => actions.menuNew()},
  {label: _('LBL_OPEN'), onclick: () => actions.menuOpen()},
  {label: _('LBL_SAVE'), disabled: !current, onclick: () => actions.menuSave()},
  {label: _('LBL_SAVEAS'), onclick: () => actions.menuSaveAs()},
  {label: _('LBL_QUIT'), onclick: () => actions.menuQuit()}
]);

const createViewMenu = (state, actions, _) => ([{
  label: _('LBL_SHOW_LOG'),
  checked: state.showLog,
  onclick: () => actions.toggleLog(!state.showLog)
}]);

const createEditorInterface = (core, proc, sock, win, $content) => {
  let editor;

  const _ = core.make('osjs/locale').translate;
  const vfs = core.make('osjs/vfs');
  const contextmenu = core.make('osjs/contextmenu').show;
  const basic = core.make('osjs/basic-application', proc, win, {
    defaultFilename: 'New Score.ily'
  });

  const setText = contents => editor.setValue(contents);
  const getText = () => editor.getValue();

  const view = (state, actions) =>  h(Box, {}, [
    h(Menubar, {}, [
      h(MenubarItem, {
        onclick: ev => actions.openMainMenu(ev)
      }, _('LBL_FILE')),
      h(MenubarItem, {
        onclick: ev => actions.openViewMenu(ev)
      }, _('LBL_VIEW'))
    ]),
    h(Toolbar, {}, [
      h(Button, {
        onclick: () => actions.compile()
      }, 'Compile')
    ]),
    h(BoxContainer, {
      grow: 3,
      shrink: 1,
      oncreate: el => {
        editor = ace.edit(el);
        editor.setTheme('ace/theme/monokai');
      }
    }),
    h(TextareaField, {
      class: 'lilypond__log',
      readonly: true,
      onupdate: el => {
        el.scrollTop = el.scrollHeight;
      },
      style: {
        fontFamily: 'monospace'
      },
      box: {
        grow: 1,
        shrink: 1,
        style: {
          display: state.showLog ? undefined : 'none'
        }
      },
      value: state.log
    })
  ]);

  const hyperapp = app({
    log: '',
    showLog: false
  }, {
    openMainMenu: ev => (state, actions) => {
      contextmenu({
        position: ev.target,
        menu: createMainMenu(proc.args.file, actions, _)
      });
    },

    openViewMenu: ev => (state, actions) => {
      contextmenu({
        position: ev.target,
        menu: createViewMenu(state, actions, _)
      });
    },

    compile: () => (state, actions) => {
      proc.emit('lilypond:compile', proc.args.file);
      actions.toggleLog(true);
    },

    toggleLog: showLog => ({showLog}),
    appendLog: append => state => ({log: state.log + append + '\n'}),

    menuNew: () => basic.createNew(),
    menuOpen: () => basic.createOpenDialog(),
    menuSave: () => (state, actions) => basic.emit('save-file'),
    menuSaveAs: () => basic.createSaveDialog(),
    menuQuit: () => proc.destroy()
  }, view, $content);

  proc.on('destroy', () => basic.destroy());

  proc.on('lilypond:compile:log', (type, string) => {
    hyperapp.appendLog(`[${type}] ${string}`);
  });

  proc.on('lilypond:compile:success', file => {
    proc.emit('lilypond:open-result', file);

    hyperapp.appendLog('*** COMPILATION SUCCESSFUL ***');

    setTimeout(() => {
      hyperapp.toggleLog(false);
    }, 5000);
  });

  proc.on('lilypond:compile:error', (error) => {
    hyperapp.appendLog('*** FAILED TO COMPILE ***');
    hyperapp.appendLog(error);
  });

  basic.on('new-file', () => {
    setText('');
  });

  basic.on('save-file', () => {
    if (proc.args.file) {
      const contents = getText();

      vfs.writefile(proc.args.file, contents)
        .then(() => console.info('done'))
        .catch(error => console.error(error)); // FIXME: Dialog
    }
  });

  basic.on('open-file', (file) => {
    vfs.readfile(file)
      .then(contents => setText(contents))
      .catch(error => console.error(error)); // FIXME: Dialog
  });

  basic.init();

  win.on('resized', () => editor.resize());
  win.on('blur', () => editor.blur());
  win.on('focus', () => editor.focus());

  return hyperapp;
};

export const createEditorWindow = (core, proc, sock) =>
  proc.createWindow({
    id: 'LilypondEditorWindow',
    title: proc.metadata.title.en_EN,
    icon: proc.resource(proc.metadata.icon),
    dimension: {width: 400, height: 400}
  })
    .on('destroy', () => proc.destroy())
    .render(($content, win) => {
      createEditorInterface(core, proc, sock, win, $content);
    });

