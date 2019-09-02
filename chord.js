// constants
const noteNames = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];

// state
var midiAccess = undefined;
var currentMidiInput = undefined;
var currentChord = [];

// code
var vf = new Vex.Flow.Factory({renderer: {elementId: 'chord-display'}});
var score = vf.EasyScore();

function redraw(chords) {
  vf.context.clear();
  var system = vf.System();

  var voice;
  if(chords.length === 1) {
    voice = score.voice(score.notes(chords[0]+'/q, B4/h/r.'));
  } else if(chords.length > 1) {
    voice = score.voice(score.notes('(' + chords.join(' ') + ')/q, B4/h/r.'));
  } else {
    voice = score.voice(score.notes('B4/1/r'));
  }

  system.addStave({
    voices: [voice]
  }).addClef('treble').addTimeSignature('4/4');

  vf.draw();
}

redraw([]);

function showError(message) {
  alert(message);
}

function onmidimessage(event) {
  let data = event.data;
  if (data.length === 3) {
    // status is the first byte.
    let status = data[0];
    // command is the four most significant bits of the status byte.
    let command = status >>> 4;
    // channel 0-15 is the lower four bits.
    let channel = status & 0xF;
    //console.log(`$Command: ${command.toString(16)}, Channel: ${channel.toString(16)}`);
    // just look at note on and note off messages.
    if (command === 0x9 || command === 0x8) {
      // note number is the second byte.
      let note = data[1];
      // velocity is the thrid byte.
      let velocity = data[2];
      let commandName = command === 0x9 ? "Note On " : "Note Off";
      // calculate octave and note name.
      let octave = Math.trunc(note / 12) - 1;
      let noteName = noteNames[note % 12];
      console.log(`${commandName} ${noteName}${octave} ${velocity}`);

      var noteRepr = `${noteName}${octave}`;
      if(command === 0x9 && velocity > 0) {
        // note on
        if(currentChord.indexOf(noteRepr) === -1) {
          currentChord.push(noteRepr);
        }
      } else {
        // note off
        currentChord = currentChord.filter(function (k) { return k !== noteRepr; });
      }

      redraw(currentChord);
    }
  }
}

function openMidiInput(input) {
  if(currentMidiInput) {
    currentMidiInput.close();
  }
  currentMidiInput = input;

  currentMidiInput.onmidimessage = onmidimessage;
}

function fetchMidiInputs() {
  if(navigator.requestMIDIAccess) {
    navigator.requestMIDIAccess()
      .then(function (m) {
        // save midi access to global state
        midiAccess = m;

        midiAccess.inputs.forEach( function( port, key ) {
          if(!port.name.startsWith('Midi Through Port-')) {
            // open the first it finds
            if(!currentMidiInput) {
              openMidiInput(port);
            }

            // add all to <select>
            var opt = document.createElement("option");
            opt.value = key;
            opt.text = port.name;
            document.getElementById("select-midi-input").add(opt);
          }
        });
      })
      .catch(error => showError(error));
  } else {
    alert('Sorry.. MIDI interface not supported by this browser. Try Chromium/Chrome.');
  }
}

document.getElementById('select-midi-input').onselect = function (ev) {
  openMidiInput(midiAccess[ev.target.value]);
}

fetchMidiInputs();
