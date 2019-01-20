const {spawn} = require('child_process');
const fs = require('fs');
const path = require('path');

const executeLily = (i, o, emit) => new Promise((resolve, reject) => {
  const p = spawn('/usr/bin/lilypond', [
    '-o',
    o.replace(/\.pdf$/, ''),
    '--pdf',
    i
  ]);

  p.stdout.on('data', data => emit('stdout', data.toString()));
  p.stderr.on('data', data => emit('stderr', data.toString()));

  p.on('error', error => reject(error));
  p.on('exit', code => {
    console.log(code)
    return !code ? resolve() : reject('Failed');
  });
});

const createConnection = (core, proc) => (ws, req) => {
  const sendMessage = (event, ...args) => ws.send(JSON.stringify({
    event,
    args
  }));

  const createPath = (...args) => path.resolve(core.options.root, 'vfs', req.session.user.username, ...args);

  const methods = {
    compile: file => {
      // TODO: Use the OS.js VFS here. Requires getting "realpath", which is not available yet.
      const realOutput = {path: 'home:/test.pdf', filename: 'test.pdf'};
      const outputFile = createPath('test.pdf');
      const inputFile = createPath(file.path.replace(/^home:\//, ''));
      const log = (...args) => sendMessage('compile:log', ...args);

      console.log(file.path, {outputFile, inputFile});

      return executeLily(inputFile, outputFile, log)
        .then(() => sendMessage('compile:success', realOutput))
        .catch(err => {
          console.warn(err);
          return sendMessage('compile:error', err.toString());
        })
    }
  };

  ws.on('message', msg => {
    const {event, args} = JSON.parse(msg);
    console.log(event);
    if (methods[event]) {
      methods[event](...args);
    } else {
      console.warn('Invalid method', event);
    }
  });
};

module.exports = (core, proc) => ({
  init: async () => {
    core.app.ws(
      proc.resource('/socket'),
      createConnection(core, proc)
    );
  },

  start: () => {},
  destroy: () => {},
  onmessage: (ws, respond, args) => {}
});
