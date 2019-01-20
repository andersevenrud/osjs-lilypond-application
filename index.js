import osjs from 'osjs';
import {name as applicationName} from './metadata.json';
import {createEditorWindow} from './src/editor-window.js';

const register = (core, args, options, metadata) => {
  const proc = core.make('osjs/application', {args, options, metadata});
  const sock = proc.socket('/socket');

  sock.on('message', ev => {
    const {event, args} = JSON.parse(ev.data);

    console.log({event, args});

    proc.emit('lilypond:' + event, ...args);
  });

  const sendMessage = (event, ...args) => sock.send(JSON.stringify({
    event,
    args
  }));

  createEditorWindow(core, proc, sock);

  proc.on('lilypond:compile', file => {
    console.info('Compiling', file);
    sendMessage('compile', file);
  });

  proc.on('lilypond:open-result', file => {
    osjs.run('PDFReader', {file});
  });

  return proc;
};

osjs.register(applicationName, register);
