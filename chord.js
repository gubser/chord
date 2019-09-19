/* global Vex */

// constants
const noteNames = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']

// state
let midiAccess
let currentMidiInput

// code

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

class ChordRenderer {
  constructor (elementId) {
    this._vf = new Vex.Flow.Factory({ renderer: { elementId } })
    this._score = this._vf.EasyScore()

    this.chord = []

    this.render()
  }

  _ensureSortedChord () {
    // first sort by octave and then by note name
    this.chord.sort(function ([noteNameA, octaveA], [noteNameB, octaveB]) {
      if (octaveA < octaveB) {
        return -1
      } else if (octaveA > octaveB) {
        return 1
      } else {
        // same octave, sort by note name
        const noteNameIndexA = noteNames.indexOf(noteNameA)
        const noteNameIndexB = noteNames.indexOf(noteNameB)
        if (noteNameIndexA < noteNameIndexB) {
          return -1
        } else if (noteNameIndexA > noteNameIndexB) {
          return 1
        } else {
          return 0
        }
      }
    })
  }

  addNote (noteName, octave) {
    const alreadyContains = this.chord.some(function ([n, o]) {
      return n === noteName && o === octave
    })

    if (!alreadyContains) {
      this.chord.push([noteName, octave])
    }

    // vexflow requires chord array to be sorted ascending
    this._ensureSortedChord()
    this.render()
  }

  removeNote (noteName, octave) {
    this.chord = this.chord.filter(function ([n, o]) {
      return !(n === noteName && o === octave)
    })
    this.render()
  }

  _noteNameOctaveTupleToString (t) {
    return `${t[0]}${t[1]}`
  }

  render () {
    // clear output
    this._vf.context.clear()

    // create new system
    var system = this._vf.System()

    const score = this._score

    let notes
    if (this.chord.length === 1) {
      notes = `${this._noteNameOctaveTupleToString(this.chord[0])}/q, B4/h/r.`
    } else if (this.chord.length > 1) {
      notes = `(${this.chord.map(this._noteNameOctaveTupleToString).join(' ')})/q, B4/h/r.`
    } else {
      notes = 'B4/1/r'
    }

    system.addStave({
      voices: [score.voice(score.notes(notes))]
    }).addClef('treble')

    this._vf.draw()
  }
}

const chordRenderer = new ChordRenderer('chord-display')

function onmidimessage (event) {
  const data = event.data
  if (data.length === 3) {
    // status is the first byte.
    const status = data[0]

    // command is the four most significant bits of the status byte.
    const command = status >>> 4

    // just look at note on and note off messages.
    if (command === 0x9 || command === 0x8) {
      const note = data[1]
      const velocity = data[2]

      // calculate octave and note name.
      const octave = Math.trunc(note / 12) - 1
      const noteName = noteNames[note % 12]
      console.log(`${command === 0x9 ? 'Note On ' : 'Note Off'} ${noteName}${octave} ${velocity}`)

      // some devices model the 'note off' command by giving 'note on' command with velocity == 0
      if (command === 0x9 && velocity > 0) {
        // note on, add to chord set
        chordRenderer.addNote(noteName, octave)
      } else {
        // note off, remove from chord set
        chordRenderer.removeNote(noteName, octave)
      }
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
