/* global Vex */

// constants
const noteNames = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']

// state
let midiAccess
let currentMidiInput
let currentChord = []

// code
class ChordRenderer {
  constructor (elementId) {
    this._vf = new Vex.Flow.Factory({ renderer: { elementId } })
    this._score = this._vf.EasyScore()
  }

  render (chords, key) {
    // clear output
    this._vf.context.clear()

    // create new system
    // TODO: Chord array needs to be sorted ascending.
    var system = this._vf.System()

    const score = this._score

    let notes
    if (chords.length === 1) {
      notes = `${chords[0]}/q, B4/h/r.`
    } else if (chords.length > 1) {
      notes = `(${chords.join(' ')})/q, B4/h/r.`
    } else {
      notes = 'B4/1/r'
    }

    system.addStave({
      voices: [score.voice(score.notes(notes))]
    }).addClef('treble').setKeySignature(key)

    this._vf.draw()
  }
}

const chordRenderer = new ChordRenderer('chord-display')

chordRenderer.render(['C4', 'E4', 'G3'], 'Cm')

function showError (message) {
  const elem = document.getElementById('error-message')

  if (message) {
    elem.innerText = message
    elem.classList.remove('invisible')
  } else {
    elem.innerText = ''
    elem.classList.add('invisible')
  }
}

function onmidimessage (event) {
  const data = event.data
  if (data.length === 3) {
    // status is the first byte.
    const status = data[0]
    // command is the four most significant bits of the status byte.
    const command = status >>> 4
    // channel 0-15 is the lower four bits.
    const channel = status & 0xF
    // console.log(`$Command: ${command.toString(16)}, Channel: ${channel.toString(16)}`);
    // just look at note on and note off messages.
    if (command === 0x9 || command === 0x8) {
      // note number is the second byte.
      const note = data[1]
      // velocity is the thrid byte.
      const velocity = data[2]
      const commandName = command === 0x9 ? 'Note On ' : 'Note Off'
      // calculate octave and note name.
      const octave = Math.trunc(note / 12) - 1
      const noteName = noteNames[note % 12]
      console.log(`${commandName} ${noteName}${octave} ${velocity}`)

      const noteRepr = `${noteName}${octave}`
      if (command === 0x9 && velocity > 0) {
        // note on
        if (currentChord.indexOf(noteRepr) === -1) {
          currentChord.push(noteRepr)
        }
      } else {
        // note off
        currentChord = currentChord.filter(function (k) { return k !== noteRepr })
      }

      chordRenderer.render(currentChord, 'C')
    }
  }
}

function openMidiInput (input) {
  if (currentMidiInput) {
    currentMidiInput.close()
  }
  currentMidiInput = input

  currentMidiInput.onmidimessage = onmidimessage
}

function fetchMidiInputs () {
  if (navigator.requestMIDIAccess) {
    navigator.requestMIDIAccess()
      .then(function (m) {
        // save midi access to global state
        midiAccess = m

        let countAdded = 0

        midiAccess.inputs.forEach(function (port, key) {
          if (!port.name.startsWith('Midi Through Port-')) {
            // open the first it finds
            if (!currentMidiInput) {
              openMidiInput(port)
            }

            // add all to <select>
            var opt = document.createElement('option')
            opt.value = key
            opt.text = port.name
            document.getElementById('select-midi-input').add(opt)

            countAdded++
          }
        })

        if (countAdded === 0) {
          showError('No MIDI devices found. Please connect one.')
        }
      })
      .catch(error => showError(error))
  } else {
    showError('Sorry.. MIDI interface not supported by this browser. Try Chromium/Chrome.')
  }
}

document.getElementById('select-midi-input').onselect = function (ev) {
  openMidiInput(midiAccess[ev.target.value])
}

fetchMidiInputs()
